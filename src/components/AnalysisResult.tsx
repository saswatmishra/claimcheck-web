import { FiAlertOctagon, FiCheckSquare, FiTool } from "react-icons/fi";
import { RiskBadge, severityClasses } from "./RiskBadge";
import type {
  Finding as FindingType,
  FixStep as FixType,
  AnalysisResult as AnalysisDataType,
  DocumentStatus,
} from "../types/analysis";

export type Finding = FindingType;
export type Fix = FixType;
export type AnalysisData = AnalysisDataType;

const RISK_COPY: Record<AnalysisData["risk"], { headline: string; interpretation: string }> = {
  GREEN: {
    headline: "Low claim-risk signals detected",
    interpretation: "Your uploaded documents look consistent on the key checks we ran.",
  },
  AMBER: {
    headline: "Some issues may affect claim readiness",
    interpretation:
      "Your documents are mostly usable, but one or more warning signals were detected.",
  },
  RED: {
    headline: "High claim-risk signals detected",
    interpretation:
      "One or more critical mismatches may create problems during claim verification.",
  },
};

const DEFAULT_DISCLAIMER =
  "ClaimCheck is a read-only document consistency check. Final claim decisions depend on insurer verification, policy terms, applicable regulations, and the facts of the incident.";

function deriveWhyThisRisk(data: AnalysisData): string {
  if (data.whyThisRisk?.trim()) return data.whyThisRisk;

  if (!data.findings || data.findings.length === 0) {
    return "We did not detect major mismatch signals from the uploaded documents on the checks currently supported by ClaimCheck.";
  }

  const top = data.findings[0];
  if (top.code === "VEHICLE_NO_MISMATCH") {
    return "We found a mismatch between the vehicle number shown on the RC and the number shown on the insurance policy. If these documents do not refer to the same vehicle, an insurer may ask for clarification or corrected records during claim processing.";
  }
  if (top.code === "POLICY_EXPIRED") {
    return "The policy appears expired based on the uploaded copy. An expired policy can weaken claim readiness and may require renewal before proceeding.";
  }
  if (top.code === "OWNER_MISMATCH") {
    return "The RC owner name and policyholder name appear different. This can trigger additional verification and may require endorsement or transfer updates.";
  }

  return top.detail;
}

function deriveDocuments(data: AnalysisData): DocumentStatus[] {
  if (data.documents && data.documents.length > 0) return data.documents;

  const checked = data.checked ?? [];
  const hasRc = Boolean(data.extracted?.rc) || checked.some((c) => c.label === "RC Owner");
  const hasPolicy =
    Boolean(data.extracted?.policy) || checked.some((c) => c.label === "Policyholder");
  const hasDl =
    data.extracted?.dl?.provided === true || checked.some((c) => c.label.startsWith("DL "));

  return [
    { label: "RC", status: hasRc ? "UPLOADED" : "NOT_UPLOADED" },
    { label: "Policy", status: hasPolicy ? "UPLOADED" : "NOT_UPLOADED" },
    {
      label: "Driving License",
      status: hasDl ? "UPLOADED" : "NOT_UPLOADED",
      note: hasDl ? undefined : "Upload to verify license-related risk signals",
    },
    { label: "Permit", status: "NOT_REQUIRED" },
    { label: "Fitness Certificate", status: "NOT_REQUIRED" },
  ];
}

function statusClass(status: DocumentStatus["status"]): string {
  if (status === "UPLOADED") return "bg-green-50 text-green-700 border-green-200";
  if (status === "NOT_UPLOADED") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function severityLabel(severity: Finding["severity"]): string {
  if (severity === "RED") return "High Risk";
  if (severity === "AMBER") return "Warning";
  return "Info";
}

function findingCardClass(severity: Finding["severity"]): string {
  if (severity === "RED") return "border-red-200 bg-red-50";
  if (severity === "AMBER") return "border-amber-200 bg-amber-50";
  return "border-green-200 bg-green-50";
}

function defaultFixesForRisk(risk: AnalysisData["risk"]): Fix[] {
  if (risk === "RED") {
    return [
      {
        title: "Verify and correct critical details",
        steps: [
          "Recheck whether the correct policy and RC files were uploaded.",
          "Confirm key fields on insurer-issued policy copy.",
          "Contact the insurer if details need correction.",
          "Re-upload corrected documents and run the check again.",
        ],
      },
    ];
  }

  if (risk === "AMBER") {
    return [
      {
        title: "Resolve warning signals",
        steps: [
          "Address the warning highlighted in findings.",
          "Download updated document copies after correction.",
          "Run ClaimCheck again to confirm improved readiness.",
        ],
      },
    ];
  }

  return [
    {
      title: "Maintain document readiness",
      steps: [
        "No major issues were detected in the uploaded documents.",
        "Keep these document copies ready for future verification.",
        "Recheck whenever policy or registration details change.",
      ],
    },
  ];
}

function summaryCardClass(risk: AnalysisData["risk"]): string {
  if (risk === "RED") return "border-red-200 bg-red-50";
  if (risk === "AMBER") return "border-amber-200 bg-amber-50";
  return "border-green-200 bg-green-50";
}

export function AnalysisResult({ data }: { data: AnalysisData }) {
  const copy = RISK_COPY[data.risk];
  const headline = data.headline ?? copy.headline;
  const summary = data.summary;
  const interpretation = copy.interpretation;
  const showInterpretation =
    interpretation.trim().toLowerCase() !== summary.trim().toLowerCase();
  const whyThisRisk = deriveWhyThisRisk(data);
  const checked = data.checked ?? [];
  const documents = deriveDocuments(data);
  const findings = data.findings ?? [];
  const fixes = data.fixes?.length ? data.fixes : defaultFixesForRisk(data.risk);
  const disclaimer = data.disclaimer ?? DEFAULT_DISCLAIMER;

  return (
    <div className="space-y-6">
      {data.isDemo && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-lg">
          <span className="font-semibold">Demo Result:</span> No real documents were analyzed.
        </div>
      )}

      <section
        className={`rounded-2xl border p-6 shadow-soft sm:p-8 ${summaryCardClass(data.risk)}`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Top summary
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">{headline}</h2>
            <p className="mt-2 text-sm text-slate-900">{summary}</p>
            {showInterpretation && (
              <p className="mt-1 text-sm text-slate-700">{interpretation}</p>
            )}
          </div>
          <RiskBadge risk={data.risk} size="lg" />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Why this risk</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{whyThisRisk}</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">What we checked</h3>
        {checked.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {checked.map((item, i) => (
              <div key={`${item.label}-${i}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">{item.label}</p>
                <p className="mt-1 font-medium text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">No checked fields were returned.</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Document completeness</h3>
        <div className="mt-4 space-y-3">
          {documents.map((doc) => (
            <div
              key={doc.label}
              className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <div>
                <p className="font-medium text-slate-900">{doc.label}</p>
                {doc.note && <p className="mt-1 text-sm text-slate-600">{doc.note}</p>}
              </div>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(doc.status)}`}
              >
                {doc.status.replace("_", " ")}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
            <FiAlertOctagon className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Findings</h3>
          <span className="ml-auto text-xs text-slate-500">{findings.length} issues</span>
        </div>

        {findings.length > 0 ? (
          <div className="space-y-4">
            {findings.map((f) => (
              <div
                key={f.code}
                className={`rounded-xl border p-4 ${findingCardClass(f.severity)}`}
              >
                <div className="mb-1.5 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{severityLabel(f.severity)}</p>
                    <h4 className="mt-1 font-medium text-slate-900">{f.title}</h4>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${severityClasses(f.severity)}`}
                  >
                    {f.severity}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-slate-700">{f.detail}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <FiCheckSquare className="h-4 w-4" />
            No findings reported.
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
            <FiTool className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">What to do next</h3>
        </div>

        <div className="space-y-4">
          {fixes.map((fix, i) => (
            <div key={`${fix.title}-${i}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              {fix.title && <h4 className="mb-2 font-medium text-slate-900">{fix.title}</h4>}
              <ol className="space-y-2">
                {fix.steps.map((step, j) => (
                  <li key={j} className="flex gap-3 text-sm text-slate-600">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                      {j + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <p className="text-xs text-slate-500">{disclaimer}</p>
    </div>
  );
}

export default AnalysisResult;
