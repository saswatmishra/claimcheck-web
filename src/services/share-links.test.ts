import { describe, expect, it } from "vitest";
import {
  createVehicleShareId,
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
};

describe("share-links", () => {
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
});
