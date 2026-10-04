// @vitest-environment node
import { once } from "node:events";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { jsPDF } from "jspdf";

// Tests must never load local credentials or contact document providers.
vi.mock("./load-env.js", () => ({}));
vi.mock("./ocr.js", () => ({ ocrBuffer: vi.fn(async (buffer) => buffer.subarray(8).toString()) }));
vi.mock("./shared-reports-repository.js", () => ({ SharedReportsRepository: vi.fn(function () {}) }));

import { app } from "./server.js";
import { ocrBuffer } from "./ocr.js";

const rc = "REG NO : OD02AB1234\nNAME : RAHUL SHARMA\nMODEL : SWIFT\nFUEL : PETROL";
const policy = "Car Owner Rahul Sharma Policy Starts 2026-01-01 Policy Expires 24 December 2030 Comprehensive Plan Reg No: OD02AB1234";
const pngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const image = (text) => new Blob([pngHeader, text], { type: "image/png" });
let server;
let baseUrl;

beforeAll(async () => {
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => {
  server?.closeAllConnections();
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
});
beforeEach(() => {
  vi.stubEnv("AI_EXTRACTION_ENABLED", "false");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-03T12:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

async function analyze(rcFile = image(rc), policyFile = image(policy), dl = null) {
  const form = new FormData();
  form.append("rc", rcFile, "rc.png");
  form.append("policy", policyFile, "policy.pdf");
  if (dl) form.append("dl", dl, "dl.png");
  const response = await fetch(`${baseUrl}/analyze`, { method: "POST", body: form });
  return { status: response.status, body: await response.json() };
}

describe("document analysis API", () => {
  it("returns green for complete, matching documents", async () => {
    const result = await analyze();
    expect(result.status).toBe(200);
    expect(result.body.risk).toBe("GREEN");
    expect(result.body.extracted.meta).not.toHaveProperty("aiExtractions");
    expect(result.body.documents.find((doc) => doc.label === "Permit").status).toBe("NOT_CHECKED");
  });

  it("does not return green for long but unrecognizable document text", async () => {
    const { body } = await analyze(image("A perfectly readable but unrelated document"), image("Another readable but unrelated document"));
    expect(body.risk).toBe("AMBER");
    expect(body.findings).toEqual(expect.arrayContaining([expect.objectContaining({ code: "MISSING_CRITICAL_FIELDS" })]));
    expect(body.whyThisRisk).toContain("couldn’t reliably read");
  });

  it.each([
    ["expiry", policy.replace("Policy Expires 24 December 2030", "")],
    ["invalid expiry", policy.replace("24 December 2030", "31 February 2030")],
    ["vehicle", policy.replace("Reg No: OD02AB1234", "")],
    ["coverage", policy.replace("Comprehensive Plan", "")],
  ])("flags missing or invalid %s instead of passing the check", async (_label, text) => {
    expect((await analyze(image(rc), image(text))).body.risk).toBe("AMBER");
  });

  it("keeps a vehicle mismatch red even when other fields are missing", async () => {
    const { body } = await analyze(image(rc), image(policy.replace("OD02AB1234", "OD02AB9999").replace("Policy Expires 24 December 2030", "")));
    expect(body.risk).toBe("RED");
    expect(body.findings[0].code).toBe("VEHICLE_NO_MISMATCH");
    expect(body.whyThisRisk).toContain("mismatch between the vehicle number");
  });

  it("does not expire a DL on its final calendar day", async () => {
    const { status, body } = await analyze(image(rc), image(policy), image("Name : Rahul Sharma DOB 01/01/1980 Valid Upto: 03/10/2026"));
    expect(status).toBe(200);
    expect(body.findings.some((finding) => finding.code === "DL_EXPIRED")).toBe(false);
    expect(body.extracted.dl.validUptoIso).toBe("2026-10-03");
  });

  it("does not classify a standalone own-damage policy as comprehensive", async () => {
    const { body } = await analyze(image(rc), image(policy.replace("Comprehensive Plan", "Standalone Own Damage Policy")));
    expect(body.risk).toBe("AMBER");
    expect(body.extracted.policy.policyType).toBe("Own Damage Only");
  });

  it("does not mistake formatting differences in names for a mismatch", async () => {
    const { body } = await analyze(image(rc.replace("RAHUL SHARMA", "Mr. RAHUL   SHARMA")));
    expect(body.findings.some((finding) => finding.code === "OWNER_MISMATCH")).toBe(false);
  });

  it("uses the Indian calendar date at midnight boundaries", async () => {
    vi.setSystemTime(new Date("2026-10-03T19:00:00Z"));
    const { body } = await analyze(image(rc), image(policy.replace("24 December 2030", "3 October 2026")));
    expect(body.findings.some((finding) => finding.code === "POLICY_EXPIRED")).toBe(true);
  });

  it("flags an unreadable uploaded license as incomplete", async () => {
    const { body } = await analyze(image(rc), image(policy), image("unreadable"));
    expect(body.risk).toBe("AMBER");
    expect(body.findings.find((finding) => finding.code === "MISSING_CRITICAL_FIELDS").detail).toContain("driving license");
  });

  it("reads policy information after page two of a PDF", async () => {
    const pdf = new jsPDF();
    pdf.text("Insurance policy introduction", 10, 10);
    pdf.addPage(); pdf.text("Terms and conditions", 10, 10);
    pdf.addPage();
    pdf.text(["Car Owner Rahul Sharma", "Policy Starts 2026-01-01", "Policy Expires 24 December 2030", "Comprehensive Plan", "Reg No: OD02AB1234"], 10, 10);
    const { status, body } = await analyze(image(rc), new Blob([pdf.output("arraybuffer")], { type: "application/pdf" }));
    expect(status).toBe(200);
    expect(body.extracted.policy.expiryIso).toBe("2030-12-24");
    expect(body.risk).toBe("GREEN");
  });

  it("returns actionable JSON for scanned PDFs", async () => {
    const pdf = new jsPDF();
    const { status, body } = await analyze(image(rc), new Blob([pdf.output("arraybuffer")], { type: "application/pdf" }));
    expect(status).toBe(422);
    expect(body.error).toContain("selectable text");
  });

  it("rejects PDFs above the page limit without silently skipping pages", async () => {
    const pdf = new jsPDF();
    for (let page = 1; page < 31; page += 1) pdf.addPage();
    const { status, body } = await analyze(image(rc), new Blob([pdf.output("arraybuffer")], { type: "application/pdf" }));
    expect(status).toBe(422);
    expect(body.error).toContain("30 pages");
  });

  it("explains when a PDF is password-protected", async () => {
    const pdf = new jsPDF({ encryption: { userPassword: "test-password" } });
    pdf.text("Policy information", 10, 10);
    const { status, body } = await analyze(image(rc), new Blob([pdf.output("arraybuffer")], { type: "application/pdf" }));
    expect(status).toBe(422);
    expect(body.error).toContain("password-protected");
  });

  it("enforces the 8 MB per-document limit", async () => {
    const { status, body } = await analyze(new Blob([new Uint8Array(8 * 1024 * 1024 + 1)], { type: "image/png" }));
    expect(status).toBe(413);
    expect(body.error).toContain("8 MB");
  });

  it("rejects unsupported, empty and incorrectly labelled files", async () => {
    for (const file of [new Blob(["text"], { type: "text/plain" }), new Blob([], { type: "image/png" }), new Blob(["not an image"], { type: "image/png" })]) {
      expect((await analyze(file)).status).toBe(400);
    }
  });

  it("does not expose provider errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(ocrBuffer).mockRejectedValueOnce(new Error("private provider diagnostic"));
    const { status, body } = await analyze();
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("private provider diagnostic");
    expect(body).not.toHaveProperty("details");
  });

  it("rejects malformed share findings before accessing storage", async () => {
    const response = await fetch(`${baseUrl}/shares`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ report: { risk: "GREEN", summary: "test", findings: [null], fixes: [] } }) });
    expect(response.status).toBe(400);
  });
});
