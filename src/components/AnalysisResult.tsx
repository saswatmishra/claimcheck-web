import { FiAlertOctagon, FiCheckSquare, FiTool } from "react-icons/fi";
import { RiskBadge, severityClasses } from "./RiskBadge";
import { VehicleDetails } from "./VehicleDetails";
import type {
  Finding as FindingType,
  FixStep as FixType,
  AnalysisResult as AnalysisDataType,
} from "../types/analysis";

export type Finding = FindingType;
export type Fix = FixType;
export type AnalysisData = AnalysisDataType;

export function AnalysisResult({ data }: { data: AnalysisData }) {
  return (
    <div className="space-y-6">
      {data.isDemo && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-lg">
          This is a demo result. No real documents were analyzed.
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Analysis Summary
            </p>
            <h2 className="mt-2 text-xl font-semibold text-foreground sm:text-2xl">
              {data.summary}
            </h2>
          </div>
          <RiskBadge risk={data.risk} size="lg" />
        </div>
      </div>

      <VehicleDetails data={data} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="mb-5 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
              <FiAlertOctagon className="h-4 w-4 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Findings</h3>
            <span className="ml-auto text-xs text-muted-foreground">
              {data.findings?.length ?? 0} issues
            </span>
          </div>

          {data.findings && data.findings.length > 0 ? (
            <ul className="space-y-3">
              {data.findings.map((f, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-border bg-background p-4 transition-colors hover:bg-muted/40"
                >
                  <div className="mb-1.5 flex items-start justify-between gap-3">
                    <h4 className="font-medium text-foreground">{f.title}</h4>
                    {f.severity && (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${severityClasses(f.severity)}`}
                      >
                        {f.severity}
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{f.detail}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No findings reported.</p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="mb-5 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
              <FiTool className="h-4 w-4 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Recommended Fixes</h3>
          </div>

          {data.fixes && data.fixes.length > 0 ? (
            <ul className="space-y-4">
              {data.fixes.map((fix, i) => (
                <li key={i} className="rounded-xl border border-border bg-background p-4">
                  {fix.title && (
                    <h4 className="mb-2 font-medium text-foreground">{fix.title}</h4>
                  )}
                  <ol className="space-y-2">
                    {fix.steps.map((step, j) => (
                      <li key={j} className="flex gap-3 text-sm text-muted-foreground">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
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
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FiCheckSquare className="h-4 w-4" />
              No fixes required.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AnalysisResult;
