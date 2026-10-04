import logoIcon from "../assets/logo-icon.svg";
import type { AnalysisResult } from "../types/analysis";
import { APP_CONFIG } from "../config";

function maskVehicle(v?: string) {
  if (!v || v === "Unknown") return "—";
  const normalized = v.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (!normalized) return "—";
  return `${normalized.slice(0, 4)}****`;
}

function riskMeta(risk: "GREEN" | "AMBER" | "RED") {
  if (risk === "RED")
    return { label: "High Risk", cls: "bg-red-600", ring: "ring-red-200" };
  if (risk === "AMBER")
    return {
      label: "Medium Risk",
      cls: "bg-amber-500",
      ring: "ring-amber-200",
    };
  return { label: "Low Risk", cls: "bg-green-600", ring: "ring-green-200" };
}

export default function ShareCard({ result }: { result: AnalysisResult }) {
  const risk = (result.risk ?? "AMBER") as "GREEN" | "AMBER" | "RED";
  const meta = riskMeta(risk);

  const vehicleNo =
    result.extracted?.rc?.vehicleNumber ||
    result.extracted?.policy?.vehicleNumber ||
    "Unknown";

  const reason =
    result?.findings?.[0]?.title ||
    result?.summary ||
    "No major issues detected";

  return (
    <div className="w-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-slate-50 to-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src={logoIcon} alt="ClaimCheck logo" className="h-7 w-7" />
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                ClaimCheck
              </p>
              <p className="text-lg font-semibold text-slate-900">
                Insurance Health Report
              </p>
            </div>
          </div>

          <div
            className={`rounded-full px-3 py-1 text-xs text-white ring-4 ${meta.cls} ${meta.ring}`}
          >
            {meta.label}
          </div>
        </div>

        <p className="mt-3 text-xs font-medium text-slate-600">
          This is my insurance health report
        </p>

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">Vehicle</p>
          <p className="text-base font-semibold text-slate-900">
            {maskVehicle(vehicleNo)}
          </p>
        </div>

        <div className="mt-4">
          <p className="text-xs text-slate-500">Reason</p>
          <p className="mt-1 truncate text-sm font-medium text-slate-900">
            {reason}
          </p>
        </div>

        <div className="mt-5 rounded-xl border border-slate-300 bg-slate-900 p-3">
          <p className="text-sm font-semibold text-white">
            Check yours at {APP_CONFIG.appName}
          </p>
        </div>
      </div>
    </div>
  );
}
