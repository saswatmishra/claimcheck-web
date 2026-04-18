import { FiAlertCircle, FiAlertTriangle, FiShield } from "react-icons/fi";
import type { RiskLevel as AnalysisRiskLevel } from "../types/analysis";

export type RiskLevel = "RED" | "AMBER" | "GREEN" | string;

interface RiskBadgeProps {
  risk: RiskLevel | AnalysisRiskLevel;
  size?: "sm" | "lg";
}

const config = {
  RED: {
    label: "High Risk",
    className: "bg-red-100 text-red-700 border border-red-200",
    Icon: FiAlertTriangle,
  },
  AMBER: {
    label: "Medium Risk",
    className: "bg-amber-100 text-amber-800 border border-amber-200",
    Icon: FiAlertCircle,
  },
  GREEN: {
    label: "Low Risk",
    className: "bg-green-100 text-green-700 border border-green-200",
    Icon: FiShield,
  },
} as const;

export function RiskBadge({ risk, size = "sm" }: RiskBadgeProps) {
  const key = (risk?.toUpperCase?.() ?? "AMBER") as keyof typeof config;
  const c = config[key] ?? config.AMBER;
  const Icon = c.Icon;

  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full font-semibold tracking-wide uppercase",
        size === "lg" ? "px-4 py-2 text-sm" : "px-2.5 py-1 text-xs",
        c.className,
      ].join(" ")}
    >
      <Icon className={size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5"} />
      {c.label}
    </span>
  );
}

export function severityClasses(severity?: string) {
  const s = severity?.toUpperCase?.() ?? "";
  if (s === "HIGH" || s === "RED" || s === "CRITICAL") {
    return "bg-red-50 text-red-700 border-red-200";
  }
  if (s === "LOW" || s === "GREEN" || s === "INFO") {
    return "bg-green-50 text-green-700 border-green-200";
  }
  return "bg-amber-50 text-amber-800 border-amber-200";
}

export default RiskBadge;
