import { useMemo, useRef, useState } from "react";
import { FiAlertTriangle, FiLoader, FiStar } from "react-icons/fi";
import { toast } from "react-toastify";
import AnalysisResult from "../components/AnalysisResult";
import FileDropzone from "../components/FileDropzone";
import ResultActions from "../components/ResultActions";
import SavedVehiclesList from "../components/SavedVehiclesList";
import SaveVehicleDialog from "../components/SaveVehicleDialog";
import { APP_CONFIG } from "../config";
import type { AnalysisResult as AnalysisData } from "../types/analysis";
import { useSavedVehicles } from "../hooks/use-saved-vehicles";

type DemoScenario = "RED_OWNER" | "GREEN" | "RED_VEHICLE_NO";

async function analyzeViaApi(
  rcFile: File,
  policyFile: File,
  dlFile?: File | null,
): Promise<AnalysisData> {
  const formData = new FormData();
  formData.append("rc", rcFile);
  formData.append("policy", policyFile);
  if (dlFile) formData.append("dl", dlFile);

  const res = await fetch(`${APP_CONFIG.apiBaseUrl}/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Analysis failed (${res.status}). ${txt}`);
  }

  return (await res.json()) as AnalysisData;
}

function analyzeDemo(scenario: DemoScenario): AnalysisData {
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

function extractRegNumber(data: AnalysisData): string {
  const anyData = data as unknown as Record<string, unknown>;
  const candidates = [
    anyData.regNumber,
    anyData.registrationNumber,
    (anyData.vehicle as Record<string, unknown> | undefined)?.regNumber,
    (anyData.vehicle as Record<string, unknown> | undefined)?.registrationNumber,
    (anyData.rc as Record<string, unknown> | undefined)?.regNumber,
    data.extracted?.rc?.vehicleNumber,
    data.extracted?.policy?.vehicleNumber,
  ];
  const found = candidates.find((c) => typeof c === "string" && c.length > 0);
  return typeof found === "string" ? found.toUpperCase() : "";
}

export default function Check() {
  const [demoMode, setDemoMode] = useState(false);
  const [dlUpload, setDlUpload] = useState(false);
  const [scenario, setScenario] = useState<DemoScenario>("RED_OWNER");

  const [rcFile, setRcFile] = useState<File | null>(null);
  const [policyFile, setPolicyFile] = useState<File | null>(null);
  const [dlFile, setDlFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisData | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [savedRegNumber, setSavedRegNumber] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const { vehicles, save, remove, setReminderEnabled } = useSavedVehicles();

  const canAnalyze = !loading && (demoMode || (!!rcFile && !!policyFile));
  const defaultReg = useMemo(
    () => (result ? extractRegNumber(result) : ""),
    [result],
  );
  const filenameBase = savedRegNumber
    ? `claimcheck-${savedRegNumber.replace(/\s+/g, "-")}`
    : "claimcheck-report";

  const handleAnalyze = async () => {
    if (!demoMode && (!rcFile || !policyFile)) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSavedRegNumber(null);

    try {
      const data = demoMode
        ? analyzeDemo(scenario)
        : await analyzeViaApi(rcFile!, policyFile!, dlFile);
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setRcFile(null);
    setPolicyFile(null);
    setDlFile(null);
    setResult(null);
    setError(null);
    setSavedRegNumber(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-16">
        <section className="mx-auto mb-10 max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
            <FiStar className="h-3.5 w-3.5 text-slate-900" />
            AI-powered verification
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Verify your RC & Insurance
            <span className="block text-slate-700">in seconds.</span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Upload your Registration Certificate and Insurance Policy. We detect
            mismatches, highlight risks, and tell you exactly how to fix them.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
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
            <div className="mb-6">
              <label className="text-sm font-medium text-slate-700">
                Demo scenario
              </label>
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value as DemoScenario)}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm"
              >
                <option value="RED_OWNER">RED: Owner mismatch</option>
                <option value="GREEN">GREEN: All good</option>
                <option value="RED_VEHICLE_NO">RED: Vehicle number mismatch</option>
              </select>
            </div>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            <FileDropzone
              label="Registration Certificate (RC)"
              description="Vehicle registration document issued by RTO"
              file={rcFile}
              onFileChange={setRcFile}
            />
            <FileDropzone
              label="Insurance Policy"
              description="Active insurance policy document"
              file={policyFile}
              onFileChange={setPolicyFile}
            />
            {dlUpload && (
              <div className="sm:col-span-2">
                <FileDropzone
                  label="Driving License (Optional)"
                  description="Upload DL photo/PDF for mismatch checks"
                  file={dlFile}
                  onFileChange={setDlFile}
                />
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col items-stretch gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              {demoMode
                ? "Demo mode is enabled. Click Analyze to load sample output."
                : canAnalyze
                ? "Both documents ready. Click Analyze to begin."
                : "Upload both documents to enable analysis."}
            </p>
            <div className="flex gap-2">
              {(rcFile || policyFile || dlFile || result) && (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={loading}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={!canAnalyze}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
              >
                {loading ? (
                  <>
                    <FiLoader className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <FiStar className="h-4 w-4" />
                    Analyze Documents
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Unable to analyze</p>
              <p className="mt-0.5 text-red-700">{error}</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="mt-8 space-y-4">
            <div className="h-32 animate-pulse rounded-2xl bg-white" />
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="h-64 animate-pulse rounded-2xl bg-white" />
              <div className="h-64 animate-pulse rounded-2xl bg-white" />
            </div>
          </div>
        )}

        {result && !loading && (
          <section className="mt-10">
            <div className="mb-4">
              <ResultActions
                data={result}
                cardRef={cardRef}
                onSave={() => setSaveDialogOpen(true)}
                saved={
                  !!savedRegNumber &&
                  vehicles.some((v) => v.regNumber === savedRegNumber)
                }
                filenameBase={filenameBase}
              />
            </div>
            <div ref={cardRef}>
              <AnalysisResult data={result} />
            </div>
          </section>
        )}

        <SavedVehiclesList
          vehicles={vehicles}
          onView={(vehicle) => {
            setResult(vehicle.analysis);
            setSavedRegNumber(vehicle.regNumber);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onRemove={(id) => {
            remove(id);
            toast.success("Saved vehicle removed.");
          }}
          onReminderToggle={(id, daysBefore, enabled) =>
            setReminderEnabled(id, daysBefore, enabled)
          }
        />
      </main>

      <SaveVehicleDialog
        open={saveDialogOpen}
        defaultRegNumber={defaultReg}
        onClose={() => setSaveDialogOpen(false)}
        onSave={({ regNumber, nickname }) => {
          if (!result) {
            toast.error("No analysis result to save.");
            return;
          }

          save({ regNumber, nickname, analysis: result });

          setSavedRegNumber(regNumber);
          toast.success("Vehicle saved!");
        }}
      />
    </div>
  );
}
