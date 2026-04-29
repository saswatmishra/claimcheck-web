import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createVehicleShareUrl,
  createVehicleShareId,
  getVehicleShareUrlById,
  loadSharedReport,
  getVehicleSharePath,
  parseVehicleShareId,
} from "./share-links";
import type { AnalysisResult } from "../types/analysis";

const result: AnalysisResult = {
  risk: "AMBER",
  summary: "Renewal due soon.",
  findings: [
    {
      code: "RENEWAL_DUE_SOON",
      title: "Policy expires soon",
      detail: "Policy expires in 7 days.",
      severity: "AMBER",
    },
  ],
  fixes: [{ title: "Renew soon", steps: ["Renew before expiry."] }],
  extracted: {
    rc: { vehicleNumber: "MH12AB1234", makeModel: "Maruti Swift" },
  },
};

describe("share-links", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("round-trips a vehicle report through a URL-safe id", () => {
    const id = createVehicleShareId(result, {
      regNumber: "MH12AB1234",
      nickname: "Swift",
    });

    expect(id).not.toMatch(/[+/=]/);
    expect(getVehicleSharePath(result)).toMatch(/^\/v\//);

    const parsed = parseVehicleShareId(id);
    expect(parsed?.regNumber).toBe("MH12AB1234");
    expect(parsed?.nickname).toBe("Swift");
    expect(parsed?.analysis.summary).toBe(result.summary);
  });

  it("rejects invalid share ids", () => {
    expect(parseVehicleShareId("not-a-report")).toBeNull();
  });

  it("creates a short share url from the API response id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "AbC123xY" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const url = await createVehicleShareUrl(result, {
      regNumber: "MH12AB1234",
      nickname: "Swift",
    });

    expect(url).toBe(getVehicleShareUrlById("AbC123xY"));
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/shares",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report: result,
          regNumber: "MH12AB1234",
          nickname: "Swift",
        }),
      }),
    );
  });

  it("infers regNumber and nickname from the report when creating a share", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "AbC123xY" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await createVehicleShareUrl(result);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/shares",
      expect.objectContaining({
        body: JSON.stringify({
          report: result,
          regNumber: "MH12AB1234",
          nickname: "Maruti Swift",
        }),
      }),
    );
  });

  it("loads a shared report from the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: "AbC123xY",
          report: result,
          regNumber: "MH12AB1234",
          nickname: "Swift",
          createdAt: "2026-04-29T00:00:00.000Z",
          expiresAt: null,
        }),
      }),
    );

    const share = await loadSharedReport("AbC123xY");

    expect(share?.id).toBe("AbC123xY");
    expect(share?.report.summary).toBe(result.summary);
    expect(share?.regNumber).toBe("MH12AB1234");
  });

  it("returns null when shared report API returns 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      }),
    );

    await expect(loadSharedReport("missing")).resolves.toBeNull();
  });
});
