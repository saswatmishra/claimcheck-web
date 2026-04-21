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

type DemoScenario = "GREEN" | "AMBER_EXPIRED" | "RED_VEHICLE_NO";
type DemoScenarioMeta = {
  id: DemoScenario;
  label: string;
  icon: string;
  subtitle: string;
  description: string;
};

const DEMO_SCENARIOS: DemoScenarioMeta[] = [
  {
    id: "GREEN",
    label: "Safe",
    icon: "🟢",
    subtitle: "All Good",
    description: "RC and policy are consistent. Policy is active.",
  },
  {
    id: "AMBER_EXPIRED",
    label: "Needs Attention",
    icon: "🟠",
    subtitle: "Policy Expired",
    description: "Details match, but policy appears expired.",
  },
  {
    id: "RED_VEHICLE_NO",
    label: "High Risk",
    icon: "🔴",
    subtitle: "Vehicle No. Mismatch",
    description: "RC and policy registration number do not match.",
  },
];

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
      isDemo: true,
      risk: "GREEN",
      headline: "Low claim-risk signals detected",
      summary: "All key details are consistent. No major issues detected.",
      whyThisRisk:
        "Your RC and policy details are aligned on the checks we ran, with no warning or critical mismatch signals detected in this demo scenario.",
      checked: [
        { label: "RC Owner", value: "Rahul Sharma" },
        { label: "Policyholder", value: "Rahul Sharma" },
        { label: "Policy Expiry", value: "Active" },
        { label: "Vehicle Number Match", value: "Yes" },
      ],
      documents: [
        { label: "RC", status: "UPLOADED" },
        { label: "Policy", status: "UPLOADED" },
        {
          label: "Driving License",
          status: "NOT_UPLOADED",
          note: "Upload to verify license-related risk signals",
        },
        { label: "Permit", status: "NOT_REQUIRED" },
        { label: "Fitness Certificate", status: "NOT_REQUIRED" },
      ],
      findings: [
        {
          code: "VEHICLE_NO_MATCH",
          title: "Vehicle number matches",
          detail: "Vehicle number in RC and policy is consistent.",
          severity: "GREEN",
        },
        {
          code: "OWNER_MATCH",
          title: "Owner name matches",
          detail: "RC owner and policyholder name match.",
          severity: "GREEN",
        },
        {
          code: "POLICY_ACTIVE",
          title: "Policy active",
          detail: "Policy appears active on the checked date.",
          severity: "GREEN",
        },
      ],
      fixes: [{ title: "Keep it healthy", steps: ["Set renewal reminders."] }],
      disclaimer:
        "ClaimCheck is a read-only document consistency check. Final claim decisions depend on insurer verification, policy terms, applicable regulations, and the facts of the incident.",
    };
  }

  if (scenario === "AMBER_EXPIRED") {
    return {
      isDemo: true,
      risk: "AMBER",
      headline: "Some issues may affect claim readiness",
      summary: "Your policy appears to be expired. This may affect claim eligibility.",
      whyThisRisk:
        "The document details are mostly consistent, but the policy appears expired in this demo scenario. That can reduce claim readiness unless renewal is completed.",
      checked: [
        { label: "RC Owner", value: "Rahul Sharma" },
        { label: "Policyholder", value: "Rahul Sharma" },
        { label: "Policy Expiry", value: "Expired" },
        { label: "Vehicle Number Match", value: "Yes" },
      ],
      documents: [
        { label: "RC", status: "UPLOADED" },
        { label: "Policy", status: "UPLOADED" },
        {
          label: "Driving License",
          status: "NOT_UPLOADED",
          note: "Upload to verify license-related risk signals",
        },
        { label: "Permit", status: "NOT_REQUIRED" },
        { label: "Fitness Certificate", status: "NOT_REQUIRED" },
      ],
      findings: [
        {
          code: "VEHICLE_NO_MATCH",
          title: "Vehicle number matches",
          detail: "Vehicle number in RC and policy is consistent.",
          severity: "GREEN",
        },
        {
          code: "OWNER_MATCH",
          title: "Owner name matches",
          detail: "RC owner and policyholder name match.",
          severity: "GREEN",
        },
        {
          code: "POLICY_EXPIRED",
          title: "Policy expired",
          detail: "Policy appears expired and may affect claim eligibility.",
          severity: "AMBER",
        },
      ],
      fixes: [
        {
          title: "Renew policy",
          steps: ["Renew your policy immediately.", "Re-run ClaimCheck after renewal."],
        },
      ],
      disclaimer:
        "ClaimCheck is a read-only document consistency check. Final claim decisions depend on insurer verification, policy terms, applicable regulations, and the facts of the incident.",
    };
  }

  return {
    isDemo: true,
    risk: "RED",
    headline: "High claim-risk signals detected",
    summary:
      "One or more critical mismatches may create problems during claim verification.",
    whyThisRisk:
      "We found a mismatch between the vehicle number shown on the RC and the number shown on the insurance policy. If these documents do not refer to the same vehicle, an insurer may ask for clarification or corrected records during claim processing.",
    checked: [
      { label: "Vehicle Number (RC)", value: "OD02AB1234" },
      { label: "Vehicle Number (Policy)", value: "OD02AB1243" },
      { label: "Owner Name", value: "Rohit Sharma" },
      { label: "Policy Status", value: "Active" },
    ],
    documents: [
      { label: "RC", status: "UPLOADED" },
      { label: "Policy", status: "UPLOADED" },
      {
        label: "Driving License",
        status: "NOT_UPLOADED",
        note: "Upload to verify license-related risk signals",
      },
      { label: "Permit", status: "NOT_REQUIRED" },
      { label: "Fitness Certificate", status: "NOT_REQUIRED" },
    ],
    findings: [
      {
        code: "VEHICLE_MISMATCH",
        title: "Vehicle Number Mismatch",
        detail:
          "The vehicle number on your RC does not match the number shown on the insurance policy.",
        severity: "RED",
      },
    ],
    fixes: [
      {
        title: "Verify and correct policy details",
        steps: [
          "Check whether the correct policy file was uploaded",
          "Confirm the vehicle number on the insurer-issued policy",
          "Contact the insurer if the policy details need correction",
          "Re-upload the corrected document and run the check again",
        ],
      },
    ],
    disclaimer:
      "ClaimCheck is a read-only document consistency check. Final claim decisions depend on insurer verification, policy terms, applicable regulations, and the facts of the incident.",
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
  const [scenario, setScenario] = useState<DemoScenario>("GREEN");

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

  const canAnalyze = !loading && !!rcFile && !!policyFile;
  const defaultReg = useMemo(() => (result ? extractRegNumber(result) : ""), [result]);
  const filenameBase = savedRegNumber
    ? `claimcheck-${savedRegNumber.replace(/\s+/g, "-")}`
    : "claimcheck-report";

  const handleAnalyze = async () => {
    if (!rcFile || !policyFile) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSavedRegNumber(null);

    try {
      const data = await analyzeViaApi(rcFile, policyFile, dlFile);
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

  const handleTryDemo = () => {
    setDemoMode(true);
    setDlUpload(false);
    setDlFile(null);
    setRcFile(null);
    setPolicyFile(null);
    setError(null);
    setSavedRegNumber(null);
    setResult(analyzeDemo(scenario));
  };

  const handleExitDemo = () => {
    setDemoMode(false);
    setError(null);
    setResult(null);
    setSavedRegNumber(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-16">
        <section className="mx-auto mb-10 max-w-2xl text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Verify your RC & Insurance
            <span className="block text-slate-700">in seconds.</span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Upload your Registration Certificate and Insurance Policy. We detect
            mismatches, highlight risks, and tell you exactly how to fix them.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Try demo to see how ClaimCheck works before uploading your documents.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            {!demoMode ? (
              <button
                type="button"
                onClick={handleTryDemo}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                Try Demo
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExitDemo}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                Exit Demo
              </button>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {!demoMode && (
            <div className="mb-6 flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <label className="text-sm text-slate-700 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={dlUpload}
                  onChange={(e) => setDlUpload(e.target.checked)}
                />
                Upload DL
              </label>
            </div>
          )}

          {demoMode && (
            <div className="mb-6">
              <label className="text-sm font-medium text-slate-700">Demo scenario</label>
              <div className="mt-2 grid gap-3 md:grid-cols-3">
                {DEMO_SCENARIOS.map((item) => {
                  const isActive = item.id === scenario;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setScenario(item.id);
                        setResult(analyzeDemo(item.id));
                      }}
                      className={[
                        "rounded-xl border p-4 text-left transition-all",
                        isActive
                          ? "border-slate-900 bg-slate-50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">
                          {item.icon} {item.label}
                        </p>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                          Demo
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-medium text-slate-600">{item.subtitle}</p>
                      <p className="mt-2 text-xs leading-relaxed text-slate-500">
                        {item.description}
                      </p>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-md border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-2">
                          <p className="text-[10px] font-semibold text-slate-700">RC Preview</p>
                          <div className="mt-1 h-10 rounded bg-slate-100" />
                        </div>
                        <div className="rounded-md border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-2">
                          <p className="text-[10px] font-semibold text-slate-700">
                            Policy Preview
                          </p>
                          <div className="mt-1 h-10 rounded bg-slate-100" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Results load instantly for demo scenarios. No file upload needed.
              </p>
            </div>
          )}

          {!demoMode && (
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
          )}

          <div className="mt-6 flex flex-col items-stretch gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              {demoMode
                ? "Demo mode is enabled. Pick a scenario to see instant output."
                : canAnalyze
                  ? "Both documents ready. Click Analyze to begin."
                  : "Upload both documents to enable analysis."}
            </p>
            <div className="flex gap-2">
              {!demoMode && (rcFile || policyFile || dlFile || result) && (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={loading}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  Reset
                </button>
              )}

              {!demoMode && (
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
              )}
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
            <div className="mb-4 flex flex-wrap gap-2">
              {!demoMode ? (
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
                >
                  Run another check
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const order: DemoScenario[] = [
                      "GREEN",
                      "AMBER_EXPIRED",
                      "RED_VEHICLE_NO",
                    ];
                    const idx = order.indexOf(scenario);
                    const next = order[(idx + 1) % order.length];
                    setScenario(next);
                    setResult(analyzeDemo(next));
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
                >
                  Try another scenario
                </button>
              )}
            </div>
            <div className="mb-4">
              <ResultActions
                data={result}
                cardRef={cardRef}
                onSave={() => setSaveDialogOpen(true)}
                saved={
                  !!savedRegNumber && vehicles.some((v) => v.regNumber === savedRegNumber)
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
