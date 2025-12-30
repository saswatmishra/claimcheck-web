import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import UploadCard from "../components/UploadCard";
import { saveLastResult } from "../services/storage";
import type { AnalysisResult } from "../types/analysis";
import { loadVehicles, removeVehicle } from "../services/vehicles";

type DemoScenario = "RED_OWNER" | "GREEN" | "RED_VEHICLE_NO";

function validateFile(file: File | null): string | null {
  if (!file) return null;

  const isImage = file.type.startsWith("image/");
  const isPdf = file.type === "application/pdf";

  if (!isImage && !isPdf) {
    return "Only image (JPG/PNG) or PDF files are allowed.";
  }

  const maxMB = 8;
  if (file.size > maxMB * 1024 * 1024) {
    return `File must be under ${maxMB}MB.`;
  }
  return null;
}

async function analyzeViaApi(
  rc: File,
  policy: File,
  dlFile: File
): Promise<AnalysisResult> {
  const form = new FormData();
  form.append("rc", rc);
  form.append("policy", policy);
  if (dlFile) form.append("dl", dlFile);

  const res = await fetch("http://localhost:3001/analyze", {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Analyze failed (${res.status}). ${txt}`);
  }
  return (await res.json()) as AnalysisResult;
}

// Local demo analyzer (no upload required)
function analyzeDemo(scenario: DemoScenario): AnalysisResult {
  if (scenario === "GREEN") {
    return {
      risk: "GREEN",
      summary: "No major claim-blocking issues found (demo).",
      checked: [
        { label: "RC Owner", value: "YOUR NAME" },
        { label: "Policyholder", value: "YOUR NAME" },
        { label: "Policy Expiry", value: "Valid" },
        { label: "Vehicle Number Match", value: "Yes" },
      ],
      findings: [],
      fixes: [{ title: "Keep it healthy", steps: ["Set renewal reminders."] }],
    };
  }

  if (scenario === "RED_VEHICLE_NO") {
    return {
      risk: "RED",
      summary: "High claim rejection risk detected (demo).",
      checked: [
        { label: "RC Owner", value: "YOUR NAME" },
        { label: "Policyholder", value: "YOUR NAME" },
        { label: "Vehicle Number Match", value: "No" },
        { label: "Policy Expiry", value: "Not checked" },
      ],
      findings: [
        {
          code: "VEHICLE_NO_MISMATCH",
          title: "Vehicle number mismatch",
          detail: "Vehicle number mismatch can create claim issues.",
          severity: "critical",
        },
      ],
      fixes: [
        {
          title: "Fix vehicle number mismatch",
          steps: ["Request correction from insurer.", "Re-run ClaimCheck."],
        },
      ],
    };
  }

  // RED_OWNER default
  return {
    risk: "RED",
    summary: "High claim rejection risk detected (demo).",
    checked: [
      { label: "RC Owner", value: "FATHER NAME" },
      { label: "Policyholder", value: "YOUR NAME" },
      { label: "Policy Expiry", value: "Not checked" },
      { label: "Vehicle Number Match", value: "Yes / Not checked" },
    ],
    findings: [
      {
        code: "OWNER_MISMATCH",
        title: "RC owner and policyholder don’t match",
        detail:
          "Your vehicle RC is in a different person’s name than the insurance policy. This can create claim rejection risk.",
        severity: "critical",
      },
    ],
    fixes: [
      {
        title: "Fix ownership mismatch",
        steps: [
          "Confirm whose name is on the RC (registered owner).",
          "Request endorsement / name transfer with insurer if RC transferred.",
          "Otherwise transfer RC first or keep policy in RC owner name.",
        ],
      },
    ],
  };
}

export default function Check() {
  const saved = loadVehicles();

  const navigate = useNavigate();

  const [demoMode, setDemoMode] = useState(false);
  const [dlUpload, setDlUpload] = useState(false);
  const [scenario, setScenario] = useState<DemoScenario>("RED_OWNER");

  const [rcFile, setRcFile] = useState<File | null>(null);
  const [policyFile, setPolicyFile] = useState<File | null>(null);
  const [dlFile, setDlFile] = useState<File | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const rcError = validateFile(rcFile);
  const policyError = validateFile(policyFile);

  const canAnalyze = useMemo(() => {
    if (isAnalyzing) return false;
    if (demoMode) return true;
    return !!rcFile && !!policyFile && !rcError && !policyError;
  }, [demoMode, isAnalyzing, rcFile, policyFile, rcError, policyError]);

  const onAnalyze = async () => {
    setIsAnalyzing(true);
    setApiError(null);

    try {
      const result = demoMode
        ? analyzeDemo(scenario)
        : await analyzeViaApi(rcFile!, policyFile!, dlFile!);

      saveLastResult(result);
      navigate("/result", { state: { result } });
    } catch (e: any) {
      setApiError(e?.message ?? "Analyze failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-xl mx-auto px-6 py-12">
        <p className="text-slate-600 mt-2">
          Check if your insurance claim is ready before you file it
        </p>
        {saved.length > 0 && (
          <div className="mt-6 border rounded-xl bg-white p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Saved Vehicles</h3>
              <span className="text-xs text-slate-500">{saved.length}</span>
            </div>

            <div className="mt-3 space-y-2">
              {saved.map((v) => (
                <div
                  key={v.vehicleNo}
                  className="flex items-center justify-between border rounded-lg p-3 bg-slate-50"
                >
                  <div>
                    <p className="font-medium text-slate-900">{v.vehicleNo}</p>
                    <p className="text-xs text-slate-600">
                      {v.insurer} • {v.policyType} • Expiry:{" "}
                      {v.expiryIso ?? "Unknown"}
                    </p>
                  </div>

                  <button
                    className="text-sm text-red-600"
                    onClick={() => {
                      removeVehicle(v.vehicleNo);
                      window.location.reload();
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900">
            Upload your documents
          </h2>

          <label className="text-sm text-slate-700 flex items-center gap-2">
            <input
              type="checkbox"
              checked={demoMode}
              onChange={(e) => setDemoMode(e.target.checked)}
            />
            Demo mode
          </label>
          <label className="text-sm text-slate-700 flex items-center gap-2">
            <input
              type="checkbox"
              checked={dlUpload}
              onChange={(e) => setDlUpload(e.target.checked)}
            />
            Upload DL
          </label>
        </div>

        {demoMode && (
          <div className="mt-4">
            <label className="text-sm font-medium text-slate-700">
              Demo scenario
            </label>
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value as DemoScenario)}
              className="mt-2 w-full border rounded-lg bg-white p-3"
            >
              <option value="RED_OWNER">RED: Owner mismatch</option>
              <option value="GREEN">GREEN: All good</option>
              <option value="RED_VEHICLE_NO">
                RED: Vehicle number mismatch
              </option>
            </select>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border p-6 mt-6 space-y-4">
          <UploadCard
            label="Registration Certificate (RC)"
            hint="Upload a clear photo (JPG/PNG) or PDF."
            onFile={setRcFile}
            file={rcFile}
            error={!demoMode && rcFile ? rcError : null}
          />

          <UploadCard
            label="Insurance Policy"
            hint="Upload a clear photo (JPG/PNG) or PDF."
            onFile={setPolicyFile}
            file={policyFile}
            error={!demoMode && policyFile ? policyError : null}
          />

          {dlUpload && (
            <UploadCard
              label="Driving License (Optional)"
              hint="Upload DL photo/PDF for mismatch checks"
              onFile={setDlFile}
              file={dlFile}
            />
          )}

          <button
            onClick={onAnalyze}
            disabled={!canAnalyze}
            className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2"
          >
            {isAnalyzing ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Analyzing…
              </>
            ) : (
              "Analyze Claim Readiness"
            )}
          </button>

          {apiError && <p className="text-sm text-red-600">{apiError}</p>}

          <p className="text-xs text-slate-500">
            We don’t sell insurance. This is a read-only compliance check.
          </p>
        </div>
      </div>
    </div>
  );
}
