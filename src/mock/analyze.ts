import type { AnalysisResult } from "../types/analysis";

type Inputs = {
  rcOwnerName?: string;       // later will come from OCR/AI
  policyHolderName?: string;  // later will come from OCR/AI
  policyExpiry?: string;      // ISO date string, optional
  vehicleNumberMatch?: boolean;
};

export function analyzeMock(inputs: Inputs): AnalysisResult {
  const findings: AnalysisResult["findings"] = [];
  const fixes: AnalysisResult["fixes"] = [];

  const rcOwner = (inputs.rcOwnerName ?? "FATHER NAME").trim().toUpperCase();
  const policyHolder = (inputs.policyHolderName ?? "YOUR NAME").trim().toUpperCase();

  // Rule 1: Owner mismatch
  if (rcOwner !== policyHolder) {
    findings.push({
      code: "OWNER_MISMATCH",
      title: "RC owner and policyholder don’t match",
      detail:
        "Your vehicle RC is in a different person’s name than the insurance policy. This can create claim rejection risk.",
      severity: "critical",
    });

    fixes.push({
      title: "Fix ownership mismatch",
      steps: [
        "Confirm whose name is on the RC (registered owner).",
        "If RC has already been transferred, request an endorsement / name transfer with the insurer.",
        "If RC is not transferred, keep policy in RC owner’s name (or transfer RC first).",
        "Re-run ClaimCheck after updates.",
      ],
    });
  }

  // Rule 2: Vehicle number mismatch (simulated)
  if (inputs.vehicleNumberMatch === false) {
    findings.push({
      code: "VEHICLE_NO_MISMATCH",
      title: "Vehicle number mismatch",
      detail:
        "The vehicle number on the policy does not match the RC. Claims can be rejected if the number is incorrect.",
      severity: "critical",
    });

    fixes.push({
      title: "Fix vehicle number mismatch",
      steps: [
        "Check the vehicle number on your RC and insurance policy.",
        "Request correction from the insurer if the policy has an incorrect registration number.",
      ],
    });
  }

  // Rule 3: Expiry check (optional)
  if (inputs.policyExpiry) {
    const exp = new Date(inputs.policyExpiry).getTime();
    if (!Number.isNaN(exp) && exp < Date.now()) {
      findings.push({
        code: "POLICY_EXPIRED",
        title: "Policy appears expired",
        detail: "Your insurance policy expiry date is in the past.",
        severity: "critical",
      });

      fixes.push({
        title: "Renew your policy",
        steps: [
          "Renew your insurance policy immediately.",
          "After renewal, re-run ClaimCheck to confirm status.",
        ],
      });
    }
  }

  // Compute risk
  const hasCritical = findings.some((f) => f.severity === "critical");
  const hasWarning = findings.some((f) => f.severity === "warning");

  const risk: AnalysisResult["risk"] = hasCritical ? "RED" : hasWarning ? "AMBER" : "GREEN";

  const summary =
    risk === "RED"
      ? "High claim rejection risk detected."
      : risk === "AMBER"
      ? "Some issues may affect claim smoothness."
      : "No major claim-blocking issues found (based on provided info).";

  // If nothing found, add a friendly green fix section
  if (risk === "GREEN") {
    fixes.push({
      title: "Keep it healthy",
      steps: [
        "Set a reminder 15 days before expiry.",
        "Keep RC and policy PDFs accessible.",
        "Re-check after any ownership transfer or address change.",
      ],
    });
  }

  const checked = [
  { label: "RC Owner", value: inputs.rcOwnerName ?? "Not provided" },
  { label: "Policyholder", value: inputs.policyHolderName ?? "Not provided" },
  { label: "Vehicle Number Match", value: inputs.vehicleNumberMatch === false ? "No" : "Yes / Not checked" },
  { label: "Policy Expiry", value: inputs.policyExpiry ?? "Not checked" },
];
  return { risk, summary, findings, fixes , checked};
}
