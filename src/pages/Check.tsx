import { useEffect, useMemo, useRef, useState } from "react";
import { track } from "@vercel/analytics";
import {
  FiAlertTriangle,
  FiLoader,
  FiPlayCircle,
  FiStar,
} from "react-icons/fi";
import { toast } from "react-toastify";
import AnalysisResult from "../components/AnalysisResult";
import FileDropzone from "../components/FileDropzone";
import ResultActions from "../components/ResultActions";
import SavedVehiclesList from "../components/SavedVehiclesList";
import SaveVehicleDialog from "../components/SaveVehicleDialog";
import { analyzeDocuments } from "../services/analyze";
import type { AnalysisResult as AnalysisData } from "../types/analysis";
import { useSavedVehicles } from "../hooks/use-saved-vehicles";
import { createVehicleShareUrl } from "../services/share-links";

type DemoScenario = "GREEN" | "RED_EXPIRED" | "RED_VEHICLE_NO";
type DemoScenarioMeta = {
  id: DemoScenario;
  label: string;
  icon: string;
  subtitle: string;
  description: string;
  rcPreview: string[];
  policyPreview: string[];
};

const DEMO_SCENARIOS: DemoScenarioMeta[] = [
  {
    id: "GREEN",
    label: "Details Match",
    icon: "🟢",
    subtitle: "All Good",
    description: "RC and policy are consistent. Policy is active.",
    rcPreview: ["Owner: Rahul Sharma", "Vehicle: OD02AB1234"],
    policyPreview: ["Holder: Rahul Sharma", "Vehicle: OD02AB1234", "Expiry: Active"],
  },
  {
    id: "RED_EXPIRED",
    label: "Policy Expired",
    icon: "🔴",
    subtitle: "Policy Expired",
    description: "Details match, but policy appears expired.",
    rcPreview: ["Owner: Rahul Sharma", "Vehicle: OD02AB1234"],
    policyPreview: ["Holder: Rahul Sharma", "Vehicle: OD02AB1234", "Expiry: Expired"],
  },
  {
    id: "RED_VEHICLE_NO",
    label: "High Risk",
    icon: "🔴",
    subtitle: "Vehicle No. Mismatch",
    description: "RC and policy registration number do not match.",
    rcPreview: ["Owner: Rohit Sharma", "Vehicle: OD02AB1234"],
    policyPreview: ["Holder: Rohit Sharma", "Vehicle: OD02AB1243", "Expiry: Active"],
  },
];

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

  if (scenario === "RED_EXPIRED") {
    return {
      isDemo: true,
      risk: "RED",
      headline: "High claim-risk signals detected",
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
          severity: "RED",
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

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const input = document.createElement("input");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  document.body.removeChild(input);
}

export default function Check() {
  const startsInDemo =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("demo") === "1";
  const [demoMode, setDemoMode] = useState(startsInDemo);
  const [dlUpload, setDlUpload] = useState(false);
  const [scenario, setScenario] = useState<DemoScenario>("GREEN");

  const [rcFile, setRcFile] = useState<File | null>(null);
  const [policyFile, setPolicyFile] = useState<File | null>(null);
  const [dlFile, setDlFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisData | null>(
    startsInDemo ? analyzeDemo("GREEN") : null,
  );
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [savedRegNumber, setSavedRegNumber] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const resultRef = useRef<HTMLElement | null>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const { vehicles, save, remove, setReminderEnabled } = useSavedVehicles();

  useEffect(() => () => {
    activeRequest.current?.abort();
    activeRequest.current = null;
  }, []);

  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  const clearReport = () => {
    setResult(null);
    setError(null);
    setSavedRegNumber(null);
  };

  const changeFile = (setFile: (file: File | null) => void) => (file: File | null) => {
    setFile(file);
    clearReport();
  };

  const canAnalyze = !loading && !!rcFile && !!policyFile;
  const defaultReg = useMemo(() => (result ? extractRegNumber(result) : ""), [result]);
  const filenameBase = savedRegNumber
    ? `claimcheck-${savedRegNumber.replace(/\s+/g, "-")}`
    : "claimcheck-report";

  const handleAnalyze = async () => {
    if (!rcFile || !policyFile || activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    const timeout = window.setTimeout(() => controller.abort("timeout"), 120000);
    setLoading(true);
    setError(null);
    setResult(null);
    track("real_check_started", { source: "check" });
    setSavedRegNumber(null);

    try {
      const data = await analyzeDocuments(rcFile, policyFile, dlUpload ? dlFile : null, controller.signal);
      if (!controller.signal.aborted) setResult(data);
    } catch (err) {
      if (activeRequest.current === controller) {
        setError(controller.signal.reason === "timeout"
          ? "This check took too long. Your files are still selected. Try again in a moment."
          : err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
    } finally {
      window.clearTimeout(timeout);
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  };

  const handleCancel = () => {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setLoading(false);
    setError(null);
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
    track("demo_started", { source: "check" });
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
    track("real_check_started", { source: "demo_result" });
    setDemoMode(false);
    setError(null);
    setResult(null);
    setSavedRegNumber(null);
  };

  const handleDemoScenarioChange = (next: DemoScenario) => {
    track("demo_scenario_changed", { scenario: next });
    setScenario(next);
    setResult(analyzeDemo(next));
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-16">
        <section className="mx-auto mb-8 max-w-2xl text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Verify your RC & Insurance
            <span className="block text-slate-700">before you need a claim.</span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Upload your RC and insurance policy to check expiry, mismatches,
            policy type, and renewal readiness. Add DL only if you want
            license-related checks.
          </p>
          {demoMode && (
            <div className="mt-5 flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row">
              <p className="text-sm font-medium text-slate-700">
                Demo mode is active. No file upload is needed.
              </p>
              <button
                type="button"
                onClick={handleExitDemo}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                Exit Demo
              </button>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {!demoMode && (
            <div className="mb-6 flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <label className="flex items-start gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={dlUpload}
                  disabled={loading}
                  onChange={(e) => {
                    setDlUpload(e.target.checked);
                    if (!e.target.checked) setDlFile(null);
                    clearReport();
                  }}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium text-slate-900">
                    Add driving license (optional)
                  </span>
                  <span className="block text-xs leading-5 text-slate-500">
                    Use this only when you want ClaimCheck to check DL holder
                    and validity signals.
                  </span>
                </span>
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
                        handleDemoScenarioChange(item.id);
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
                          <div className="mt-1 min-h-14 rounded bg-slate-100 p-2">
                            {item.rcPreview.map((line) => (
                              <p
                                key={`${item.id}-rc-${line}`}
                                className="truncate text-[10px] leading-4 text-slate-600"
                              >
                                {line}
                              </p>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-md border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-2">
                          <p className="text-[10px] font-semibold text-slate-700">
                            Policy Preview
                          </p>
                          <div className="mt-1 min-h-14 rounded bg-slate-100 p-2">
                            {item.policyPreview.map((line) => (
                              <p
                                key={`${item.id}-policy-${line}`}
                                className="truncate text-[10px] leading-4 text-slate-600"
                              >
                                {line}
                              </p>
                            ))}
                          </div>
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
                onFileChange={changeFile(setRcFile)}
                disabled={loading}
              />
              <FileDropzone
                label="Insurance Policy"
                description="Include the policyholder, vehicle number, coverage and validity dates"
                file={policyFile}
                onFileChange={changeFile(setPolicyFile)}
                disabled={loading}
              />
              {dlUpload && (
                <div className="sm:col-span-2">
                  <FileDropzone
                    label="Driving License (Optional)"
                    description="Upload DL photo/PDF for mismatch checks"
                    file={dlFile}
                    onFileChange={changeFile(setDlFile)}
                    disabled={loading}
                  />
                </div>
              )}
            </div>
          )}

          {!demoMode && (
            <p className="mt-4 text-xs leading-5 text-slate-600">
              Use clear photos or PDFs with selectable text (up to 30 pages). For scanned or password-protected PDFs, upload a clear photo instead.
              Files are sent for document processing; image reading and AI extraction may use Google Cloud Vision and OpenAI. <a href="/privacy" className="underline">How your data is handled</a>.
            </p>
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

        {!demoMode && !result && !loading && (
          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-start gap-3">
              <FiPlayCircle className="mt-0.5 h-5 w-5 shrink-0 text-slate-700" />
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Not ready to upload documents?
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Run a sample demo to see the report format before uploading
                  real files.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleTryDemo}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 sm:mt-0 sm:w-auto"
            >
              Try Demo
            </button>
          </section>
        )}

        {error && (
          <div role="alert" className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Unable to analyze</p>
              <p className="mt-0.5 text-red-700">{error}</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="mt-8 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <p role="status" className="text-sm text-slate-700">Reading your documents and comparing details. This can take up to two minutes.</p>
              <button type="button" onClick={handleCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel check</button>
            </div>
            <div className="h-32 animate-pulse rounded-2xl bg-white" />
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="h-64 animate-pulse rounded-2xl bg-white" />
              <div className="h-64 animate-pulse rounded-2xl bg-white" />
            </div>
          </div>
        )}

        {result && !loading && (
          <section ref={resultRef} tabIndex={-1} aria-label="Your document check results" className="mt-10 scroll-mt-6 focus:outline-none">
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
                      "RED_EXPIRED",
                      "RED_VEHICLE_NO",
                    ];
                    const idx = order.indexOf(scenario);
                    const next = order[(idx + 1) % order.length];
                    handleDemoScenarioChange(next);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
                >
                  Try another scenario
                </button>
              )}
              {demoMode && (
                <button
                  type="button"
                  onClick={handleExitDemo}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Check my real documents
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
            handleCancel();
            setDemoMode(!!vehicle.analysis.isDemo);
            setResult(vehicle.analysis);
            setSavedRegNumber(vehicle.regNumber);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onRemove={(id) => {
            try {
              remove(id);
              toast.success("Saved vehicle removed.");
            } catch {
              toast.error("Couldn’t update browser storage. Please try again.");
            }
          }}
          onReminderToggle={(id, daysBefore, enabled) => {
            try { setReminderEnabled(id, daysBefore, enabled); }
            catch { toast.error("Couldn’t save the reminder setting in this browser."); }
          }}
          onShareLink={async (vehicle) => {
            try {
              await copyText(
                await createVehicleShareUrl(vehicle.analysis, {
                  regNumber: vehicle.regNumber,
                  nickname: vehicle.nickname,
                }),
              );
              toast.success("Share link copied.");
            } catch {
              toast.error("Couldn’t copy share link.");
            }
          }}
        />
      </main>

      <SaveVehicleDialog
        open={saveDialogOpen}
        defaultRegNumber={defaultReg}
        onClose={() => setSaveDialogOpen(false)}
        onSave={({ regNumber, nickname }) => {
          if (!result) {
            toast.error("No analysis result to save.");
            return false;
          }

          try {
            const saved = save({ regNumber, nickname, analysis: result });
            setSavedRegNumber(saved.regNumber);
            toast.success("Vehicle saved in this browser.");
          } catch {
            toast.error("Couldn’t save in this browser. Check that browser storage is available, or download the report.");
            return false;
          }
        }}
      />
    </div>
  );
}
