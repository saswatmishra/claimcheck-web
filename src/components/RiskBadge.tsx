import type { RiskLevel } from "../types/analysis";

export default function RiskBadge({ risk }: { risk: RiskLevel | string }) {
  const map = {
    GREEN: {
      label: "Low Risk",
      cls: "bg-green-50 text-green-700 border-green-200",
    },
    AMBER: {
      label: "Medium Risk",
      cls: "bg-amber-50 text-amber-800 border-amber-200",
    },
    RED: { label: "High Risk", cls: "bg-red-50 text-red-700 border-red-200" },
  } as const;

  const safe =
    risk === "GREEN" || risk === "AMBER" || risk === "RED" ? risk : "AMBER";
  const { label, cls } = map[safe];

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full border text-sm font-medium ${cls}`}
    >
      {label}
    </span>
  );
}
