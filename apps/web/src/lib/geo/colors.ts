// apps/web/src/lib/geo/colors.ts
import type { DataDrivenPropertyValueSpecification } from "maplibre-gl";

export const RISK_LEVELS = [
  "none",
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type RiskLevel = (typeof RISK_LEVELS)[number];

export const SEVERITY_LEVELS = [
  "info",
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type SeverityLevel = (typeof SEVERITY_LEVELS)[number];

export const RISK_COLORS = {
  none: "#64748b",
  low: "#10b981",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
} as const satisfies Record<RiskLevel, string>;

export const SEVERITY_COLORS = {
  info: "#64748b",
  low: "#10b981",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
} as const satisfies Record<SeverityLevel, string>;

export const ZONE_FILL_OPACITY = 0.25;

export const riskFillColor: DataDrivenPropertyValueSpecification<string> = [
  "match",
  ["get", "risk_level"],
  "none",
  RISK_COLORS.none,
  "low",
  RISK_COLORS.low,
  "medium",
  RISK_COLORS.medium,
  "high",
  RISK_COLORS.high,
  "critical",
  RISK_COLORS.critical,
  RISK_COLORS.none,
];

export const safetyScoreColor: DataDrivenPropertyValueSpecification<string> = [
  "case",
  ["<", ["get", "safety_score"], 40],
  RISK_COLORS.critical,
  ["<", ["get", "safety_score"], 60],
  RISK_COLORS.high,
  ["<", ["get", "safety_score"], 80],
  RISK_COLORS.medium,
  RISK_COLORS.low,
];

export const severityColor: DataDrivenPropertyValueSpecification<string> = [
  "match",
  ["get", "severity"],
  "info",
  SEVERITY_COLORS.info,
  "low",
  SEVERITY_COLORS.low,
  "medium",
  SEVERITY_COLORS.medium,
  "high",
  SEVERITY_COLORS.high,
  "critical",
  SEVERITY_COLORS.critical,
  SEVERITY_COLORS.medium,
];
