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
  none: "border-border bg-surface text-foreground",
  low: "border-success/25 bg-success/10 text-foreground",
  medium: "border-warning/30 bg-warning/10 text-foreground",
  high: "border-severity-high/35 bg-severity-high/10 text-foreground",
  critical: "border-danger/35 bg-danger/10 text-foreground",
};

export const RISK_LABEL: Record<RiskLevel, string> = {
  none: "Clear",
  low: "Safe zone",
  medium: "Caution zone",
  high: "High-risk zone",
  critical: "Restricted zone",
};

export function isRiskLevel(value: string): value is RiskLevel {
  return value in RISK_FILL;
}

export function riskFromUnknown(value: string | null | undefined): RiskLevel {
  if (value && isRiskLevel(value)) return value;
  return "none";
}
