// apps/web/src/lib/geo/risk-colors.ts

export type RiskLevel = "none" | "low" | "medium" | "high" | "critical";

export const RISK_FILL: Record<RiskLevel, string> = {
  none: "#64748b",
  low: "#10b981",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
};

export const RISK_BANNER: Record<RiskLevel, string> = {
  none: "bg-slate-700/80 text-slate-50",
  low: "bg-emerald-700/90 text-emerald-50",
  medium: "bg-amber-600/90 text-amber-50",
  high: "bg-orange-600/90 text-orange-50",
  critical: "bg-red-700/90 text-red-50",
};

export function isRiskLevel(value: string): value is RiskLevel {
  return value in RISK_FILL;
}

export function riskFromUnknown(value: string | null | undefined): RiskLevel {
  if (value && isRiskLevel(value)) return value;
  return "none";
}
