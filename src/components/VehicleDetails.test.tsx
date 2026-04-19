import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AnalysisResult } from "../types/analysis";
import { VehicleDetails } from "./VehicleDetails";

function baseResult(): AnalysisResult {
  return {
    risk: "AMBER",
    summary: "Test summary",
    findings: [],
    fixes: [],
    extracted: {
      rc: { vehicleNumber: "OD02AB1234", ownerName: "Rahul Sharma" } as any,
      policy: { insurer: "ACKO", policyType: "Comprehensive" },
    },
  };
}

describe("VehicleDetails", () => {
  it("shows driving license section when DL data is present", () => {
    const data: AnalysisResult = {
      ...baseResult(),
      extracted: {
        ...baseResult().extracted,
        dl: {
          provided: true,
          holderName: "Rahul Sharma",
          validUpto: "30 Nov 2030",
        },
      },
    };

    render(<VehicleDetails data={data} />);

    expect(screen.getByText("Driving License")).toBeInTheDocument();
    expect(screen.getByText("DL Holder")).toBeInTheDocument();
    expect(screen.getAllByText("Rahul Sharma").length).toBeGreaterThan(0);
    expect(screen.getByText(/DL vs RC Owner:/)).toBeInTheDocument();
  });

  it("hides driving license section when DL data is absent", () => {
    render(<VehicleDetails data={baseResult()} />);
    expect(screen.queryByText("Driving License")).not.toBeInTheDocument();
  });
});
