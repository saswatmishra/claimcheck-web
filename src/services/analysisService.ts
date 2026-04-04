import { analyzeMock } from "../mock/analyze";
import type { AnalysisResult } from "../types/analysis";
import { APP_CONFIG } from "../config";

export type DemoScenario = "RED_OWNER" | "GREEN" | "RED_VEHICLE_NO";

export async function analyzeWithApi(rcFile: File, policyFile: File) {
  const fd = new FormData();
  fd.append("rc", rcFile);        // MUST be "rc"
  fd.append("policy", policyFile); // MUST be "policy"

  const resp = await fetch(`${APP_CONFIG.apiBaseUrl}/analyze`, {
    method: "POST",
    body: fd,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Analyze failed (${resp.status}). ${text}`);
  }

  return resp.json();
}



export async function analyzeDocuments(args: {
  scenario?: DemoScenario;
  rcFile: File;
  policyFile: File;
}): Promise<AnalysisResult> {
  const { scenario, rcFile, policyFile } = args;

  // If scenario is provided => demo mode
  if (scenario) {
    if (scenario === "GREEN") {
      return analyzeMock({
        rcOwnerName: "Your Name",
        policyHolderName: "Your Name",
        vehicleNumberMatch: true,
      });
    }
    if (scenario === "RED_VEHICLE_NO") {
      return analyzeMock({
        rcOwnerName: "Your Name",
        policyHolderName: "Your Name",
        vehicleNumberMatch: false,
      });
    }
    return analyzeMock({
      rcOwnerName: "Father Name",
      policyHolderName: "Your Name",
      vehicleNumberMatch: true,
    });
  }

  // ✅ Real-file mode (no OCR yet): be honest + show filenames
  return {
    risk: "AMBER",
    summary: "Files received. Automatic extraction is coming next.",
    findings: [
      {
        code: "EXTRACTION_PENDING",
        title: "We haven’t extracted names from your documents yet",
        detail:
          "Right now ClaimCheck can validate uploads and show what was uploaded. Next, we’ll extract RC owner / policyholder fields from the documents.",
        severity: "warning",
      },
    ],
    fixes: [
      {
        title: "Next step",
        steps: [
          "We’ll add OCR/PDF extraction to read RC owner and policyholder automatically.",
          "Once enabled, ClaimCheck will detect mismatches from your actual documents.",
        ],
      },
    ],
    checked: [
      { label: "RC File", value: rcFile.name },
      { label: "Policy File", value: policyFile.name },
      { label: "File Types", value: `${rcFile.type || "unknown"}, ${policyFile.type || "unknown"}` },
    ],
  };
}
