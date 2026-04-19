import { describe, expect, it } from "vitest";
import type { AnalysisResult } from "../types/analysis";
import {
  compareNames,
  extractVehicleDetails,
  formatDateLike,
} from "./vehicle-details";

function baseResult(): AnalysisResult {
  return {
    risk: "GREEN",
    summary: "ok",
    findings: [],
    fixes: [],
  };
}

describe("compareNames", () => {
  it("returns match for normalized identical names", () => {
    expect(compareNames("Mr. John A Doe", "john a doe")).toBe("match");
  });

  it("returns partial for strong token overlap", () => {
    expect(compareNames("John Michael Doe", "John Doe")).toBe("partial");
  });

  it("returns mismatch when overlap is weak", () => {
    expect(compareNames("John Doe", "Priya Singh")).toBe("mismatch");
  });

  it("returns unknown when either side missing", () => {
    expect(compareNames(undefined, "John Doe")).toBe("unknown");
  });
});

describe("extractVehicleDetails", () => {
  it("extracts DL fields from extracted.dl and computes DL vs RC owner match", () => {
    const data: AnalysisResult = {
      ...baseResult(),
      extracted: {
        rc: { vehicleNumber: "OD02AB1234", ownerName: "Rahul Sharma" } as any,
        dl: {
          provided: true,
          holderName: "Rahul Sharma",
          validUpto: "30 Nov 2030",
          validUptoIso: "2030-11-30",
        },
      },
    };

    const view = extractVehicleDetails(data);

    expect(view.dl.provided).toBe(true);
    expect(view.dl.holderName).toBe("Rahul Sharma");
    expect(view.dl.validUpto).toBe("30 Nov 2030");
    expect(view.dl.matchToRcOwner).toBe("match");
  });

  it("falls back to checked fields for DL values when extracted.dl is absent", () => {
    const data: AnalysisResult = {
      ...baseResult(),
      checked: [
        { label: "RC Owner", value: "Anita Verma" },
        { label: "DL Holder", value: "Anita Verma" },
        { label: "DL Valid Upto", value: "14 Jan 2031" },
      ],
    };

    const view = extractVehicleDetails(data);

    expect(view.dl.provided).toBe(true);
    expect(view.dl.holderName).toBe("Anita Verma");
    expect(view.dl.validUpto).toBe("14 Jan 2031");
    expect(view.dl.matchToRcOwner).toBe("match");
  });
});

describe("formatDateLike", () => {
  it("formats ISO-like values", () => {
    const formatted = formatDateLike("2026-04-25");
    expect(formatted).toBeTruthy();
    expect(formatted).not.toBe("2026-04-25");
    expect(formatted).toContain("2026");
  });

  it("returns original value for non-date strings", () => {
    expect(formatDateLike("Not checked")).toBe("Not checked");
  });
});
