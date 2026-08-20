// apps/web/src/lib/geo/risk-colors.ts

export type RiskLevel = "none" | "low" | "medium" | "high" | "critical";

export const RISK_FILL: Record<RiskLevel, string> = {
  none: "#64748b",
  low: "#2f9d6a",
  medium: "#c9a227",
  high: "#d97706",
  critical: "#e05a45",
};

export const RISK_BANNER: Record<RiskLevel, string> = {
  none: "bg-slate-700 text-slate-50",
  low: "bg-[oklch(0.42_0.09_155)] text-[oklch(0.97_0.02_155)]",
  medium: "bg-[oklch(0.62_0.13_72)] text-[oklch(0.22_0.05_60)]",
  high: "bg-[oklch(0.58_0.15_48)] text-[oklch(0.98_0.02_80)]",
  critical: "bg-[oklch(0.5_0.18_27)] text-[oklch(0.99_0.01_20)]",
};

export function isRiskLevel(value: string): value is RiskLevel {
  return value in RISK_FILL;
}

export function riskFromUnknown(value: string | null | undefined): RiskLevel {
  if (value && isRiskLevel(value)) return value;
  return "none";
}
