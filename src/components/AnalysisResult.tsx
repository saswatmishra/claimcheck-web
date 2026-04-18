import { FiAlertOctagon, FiCheckSquare, FiTool } from "react-icons/fi";
import RiskBadge, { severityClasses } from "./RiskBadge";
import type { AnalysisResult as AnalysisData } from "../types/analysis";

export type { AnalysisData };

export default function AnalysisResult({ data }: { data: AnalysisData }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Analysis Summary
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">
              {data.summary}
            </h2>
          </div>
          <RiskBadge risk={data.risk} size="lg" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
              <FiAlertOctagon className="h-4 w-4 text-slate-900" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">Findings</h3>
            <span className="ml-auto text-xs text-slate-500">
              {data.findings?.length ?? 0} issues
            </span>
          </div>

          {data.findings && data.findings.length > 0 ? (
            <ul className="space-y-3">
              {data.findings.map((f, i) => (
                <li
                  key={f.code || i}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:bg-slate-100/70"
                >
                  <div className="mb-1.5 flex items-start justify-between gap-3">
                    <h4 className="font-medium text-slate-900">{f.title}</h4>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${severityClasses(f.severity)}`}
                    >
                      {f.severity}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600">{f.detail}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">No findings reported.</p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
              <FiTool className="h-4 w-4 text-slate-900" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">Recommended Fixes</h3>
          </div>

          {data.fixes && data.fixes.length > 0 ? (
            <ul className="space-y-4">
              {data.fixes.map((fix, i) => (
                <li key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  {fix.title && (
                    <h4 className="mb-2 font-medium text-slate-900">{fix.title}</h4>
                  )}
                  <ol className="space-y-2">
                    {fix.steps.map((step, j) => (
                      <li key={j} className="flex gap-3 text-sm text-slate-600">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900/10 text-[11px] font-semibold text-slate-900">
                          {j + 1}
                        </span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <FiCheckSquare className="h-4 w-4" />
              No fixes required.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
