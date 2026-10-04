import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisResult } from "../types/analysis";
import { clearLastResult, loadLastResult, saveLastResult } from "./storage";

const STORAGE_KEY = "claimcheck:lastResult";

function sampleResult(): AnalysisResult {
  return {
    risk: "AMBER",
    summary: "Sample",
    findings: [],
    fixes: [],
    extracted: {
      rc: { vehicleNumber: "OD02AB1234" },
      policy: { policyType: "Comprehensive" },
    },
  };
}

describe("storage service", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("saves and loads last result", () => {
    saveLastResult(sampleResult());
    const loaded = loadLastResult();
    expect(loaded?.risk).toBe("AMBER");
    expect(loaded?.extracted?.rc?.vehicleNumber).toBe("OD02AB1234");
  });

  it("removes heavy rawText fields before saving", () => {
    const withRaw = {
      ...sampleResult(),
      extracted: {
        rc: { vehicleNumber: "OD02AB1234", rawText: "BIG RC TEXT" },
        policy: { policyType: "Comprehensive", rawText: "BIG POLICY TEXT" },
      },
    } as AnalysisResult;

    saveLastResult(withRaw);
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(parsed.extracted?.rc?.rawText).toBeUndefined();
    expect(parsed.extracted?.policy?.rawText).toBeUndefined();
  });

  it("returns null for malformed JSON in localStorage", () => {
    localStorage.setItem(STORAGE_KEY, "{");
    expect(loadLastResult()).toBeNull();
  });

  it("does not throw when localStorage setItem fails", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    expect(() => saveLastResult(sampleResult())).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("clears stored result", () => {
    saveLastResult(sampleResult());
    clearLastResult();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
