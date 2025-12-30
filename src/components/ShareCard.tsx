import type { AnalysisResult } from "../types/analysis";

function maskVehicle(v?: string) {
  if (!v || v === "Unknown") return "—";
  // KA04MT6299 -> KA04****6299 (simple mask)
  if (v.length <= 6) return v;
  return `${v.slice(0, 4)}****${v.slice(-4)}`;
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
    (result?.extracted as any)?.rc?.vehicleNumber ||
    (result?.extracted as any)?.policy?.vehicleNumber ||
    "Unknown";

  const reason =
    result?.findings?.[0]?.title ||
    result?.summary ||
    "No major issues detected";

  return (
    <div className="w-[360px] rounded-2xl border bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500">ClaimCheck</p>
          <p className="text-lg font-semibold text-slate-900">
            Insurance Health Report
          </p>
        </div>

        <div
          className={`text-white text-xs px-3 py-1 rounded-full ${meta.cls} ring-4 ${meta.ring}`}
        >
          {meta.label}
        </div>
      </div>

      {/* Vehicle */}
      <div className="mt-4 rounded-xl bg-slate-50 p-3">
        <p className="text-xs text-slate-500">Vehicle</p>
        <p className="text-base font-semibold text-slate-900">
          {maskVehicle(vehicleNo)}
        </p>
      </div>

      {/* Reason */}
      <div className="mt-4">
        <p className="text-xs text-slate-500">Top reason</p>
        <p className="text-sm font-medium text-slate-900 mt-1">{reason}</p>
      </div>

      {/* CTA */}
      <div className="mt-5 rounded-xl border p-3">
        <p className="text-xs text-slate-500">Try it</p>
        <p className="text-sm font-semibold text-slate-900 mt-1">
          Check yours at <span className="underline">ClaimCheck</span>
        </p>
        <p className="text-[11px] text-slate-500 mt-1">
          claimcheck.co.in (coming soon)
        </p>
      </div>

      {/* Footer */}
      <p className="text-[10px] text-slate-400 mt-4">
        Screenshot this card • Not legal advice
      </p>
    </div>
  );
}
