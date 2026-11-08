// @vitest-environment node
import { once } from "node:events";
import { request } from "node:http";
import { setImmediate } from "node:timers/promises";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const clock = vi.hoisted(() => ({ time: 1000 }));
vi.mock("./load-env.js", () => ({}));
vi.mock("./ocr.js", () => ({ ocrBuffer: vi.fn() }));
vi.mock("./ai-extract.js", async (importOriginal) => ({
  ...await importOriginal(),
  extractDocumentFieldsAi: vi.fn(),
}));
vi.mock("./shared-reports-repository.js", () => ({
  SharedReportsRepository: vi.fn(function () { this.create = vi.fn(); }),
}));
// Use short, deterministic quotas while retaining the real middleware and routes.
vi.mock("./abuse-guards.js", async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    createApiAbuseGuards: () => Object.fromEntries(["analyze", "extractAi", "shares"].map((name) => [
      name, original.createAbuseGuard({ maxRequests: 4, maxConcurrent: 1, windowMs: 1000, now: () => clock.time }),
    ])),
  };
});

import { app } from "./server.js";
import { ocrBuffer } from "./ocr.js";
import { extractDocumentFieldsAi } from "./ai-extract.js";
import { SharedReportsRepository } from "./shared-reports-repository.js";

const report = { risk: "GREEN", summary: "ok", findings: [], fixes: [] };
const createShare = SharedReportsRepository.mock.instances[0].create;
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
  clock.time += 1000;
  vi.stubEnv("AI_EXTRACTION_ENABLED", "false");
  vi.mocked(ocrBuffer).mockReset().mockResolvedValue("Readable document content");
  vi.mocked(extractDocumentFieldsAi).mockReset().mockResolvedValue({ extraction: { fields: {} } });
  createShare.mockReset().mockResolvedValue({ id: "test1234", report });
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

function validRequest(path) {
  let body;
  const headers = {};
  if (path === "/analyze") {
    body = new FormData();
    const image = new Blob([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), "document"], { type: "image/png" });
    body.append("rc", image, "rc.png");
    body.append("policy", image, "policy.png");
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(path === "/shares" ? { report } : { ocrText: "document" });
  }
  return new Request(`${baseUrl}${path}`, { method: "POST", headers, body });
}

describe("API abuse protection over HTTP", () => {
  it.each(["/analyze", "/extract-policy-ai", "/shares"])("rate-limits %s before parsing the body, even with forged forwarding headers", async (path) => {
    for (let i = 0; i < 4; i += 1) {
      const response = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": `203.0.113.${i}` },
        body: "{",
      });
      expect(response.status).toBe(400);
      await response.json();
    }
    const blocked = await fetch(`${baseUrl}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("1");
    expect(blocked.headers.get("ratelimit-remaining")).toBe("0");
    expect(blocked.headers.get("cache-control")).toBe("no-store");
    await blocked.json();
    expect(ocrBuffer).not.toHaveBeenCalled();
    expect(extractDocumentFieldsAi).not.toHaveBeenCalled();
    expect(createShare).not.toHaveBeenCalled();
    clock.time += 1000;
    const restored = await fetch(validRequest(path));
    expect(restored.status).toBe(path === "/shares" ? 201 : 200);
    await restored.json();
  });

  it.each([
    ["/analyze", () => vi.mocked(ocrBuffer), "Readable document content"],
    ["/extract-policy-ai", () => vi.mocked(extractDocumentFieldsAi), { extraction: { fields: {} } }],
    ["/shares", () => createShare, { id: "test1234", report }],
  ])("keeps %s work counted after a client disconnects", async (path, getProvider, result) => {
    const started = Promise.withResolvers();
    const completed = Promise.withResolvers();
    const closed = Promise.withResolvers();
    const provider = getProvider();
    provider.mockImplementationOnce(() => { started.resolve(); return completed.promise; });
    const upload = validRequest(path);
    const body = Buffer.from(await upload.arrayBuffer());
    server.once("request", (_req, res) => res.once("close", closed.resolve));
    const client = request(upload.url, { method: "POST", headers: Object.fromEntries(upload.headers) });
    client.on("error", () => {});
    client.end(body);
    await started.promise;
    client.destroy();
    await closed.promise;
    try {
      const calls = provider.mock.calls.length;
      const blocked = await fetch(validRequest(path));
      expect(blocked.status).toBe(503);
      expect(blocked.headers.get("retry-after")).toBe("5");
      await blocked.json();
      expect(provider).toHaveBeenCalledTimes(calls);
    } finally {
      completed.resolve(result);
      await setImmediate();
    }
    const restored = await fetch(validRequest(path));
    expect(restored.status).toBe(path === "/shares" ? 201 : 200);
    await restored.json();
  });

  it("keeps remaining OCR work counted when another document fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const started = Promise.withResolvers();
    const completed = Promise.withResolvers();
    vi.mocked(ocrBuffer)
      .mockRejectedValueOnce(new Error("provider failed"))
      .mockImplementationOnce(() => { started.resolve(); return completed.promise; });
    const first = fetch(validRequest("/analyze"));
    await started.promise;
    await setImmediate();
    try {
      const blocked = await fetch(validRequest("/analyze"));
      expect(blocked.status).toBe(503);
      await blocked.json();
      expect(ocrBuffer).toHaveBeenCalledTimes(2);
    } finally {
      completed.resolve("Readable document content");
      const response = await first;
      expect(response.status).toBe(500);
      await response.json();
    }
    const restored = await fetch(validRequest("/analyze"));
    expect(restored.status).toBe(200);
    await restored.json();
  });
});
