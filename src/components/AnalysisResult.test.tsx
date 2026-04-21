import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AnalysisResult } from "../types/analysis";
import { AnalysisResult as AnalysisResultView } from "./AnalysisResult";

function sample(risk: "GREEN" | "AMBER" | "RED" = "GREEN"): AnalysisResult {
  return {
    isDemo: true,
    risk,
    headline: "Low claim-risk signals detected",
    summary: "All key details are consistent. No major issues detected.",
    whyThisRisk: "Documents are aligned on key checks.",
    checked: [
      { label: "Vehicle Number", value: "OD02AB1234" },
      { label: "Owner Name", value: "Rohit Sharma" },
    ],
    documents: [
      { label: "RC", status: "UPLOADED" },
      { label: "Policy", status: "UPLOADED" },
    ],
    findings: [
      {
        code: "OWNER_MATCH",
        title: "Owner name matches",
        detail: "RC owner and policyholder match.",
        severity: risk,
      },
    ],
    fixes: [{ title: "Keep ready", steps: ["Keep documents available."] }],
    disclaimer: "ClaimCheck is a read-only document consistency check.",
  };
}

describe("AnalysisResult layout", () => {
  it("renders required section headings and demo banner", () => {
    render(<AnalysisResultView data={sample()} />);

    expect(screen.getByText(/Demo Result:/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Why this risk" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What we checked" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Document completeness" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Findings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What to do next" })).toBeInTheDocument();
  });

  it("renders risk-severity badge values from RiskLevel", () => {
    render(<AnalysisResultView data={sample("RED")} />);
    expect(screen.getAllByText("High Risk").length).toBeGreaterThan(0);
    expect(screen.getAllByText("RED").length).toBeGreaterThan(0);
  });
});
