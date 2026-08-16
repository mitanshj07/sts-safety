// packages/shared/src/constants/severity-matrix.ts
import type { IncidentType, RiskLevel, SeverityLevel } from "../schemas/enums"
import { istHour } from "../utils/time"

/** Night for derive_severity(): IST hour >= 20 or < 5. */
export const SEVERITY_NIGHT_START_HOUR_IST = 20
export const SEVERITY_NIGHT_END_HOUR_IST = 5

export const HIGH_RISK_LEVELS: readonly RiskLevel[] = ["high", "critical"]

/**
 * Base severity by incident type. Mirrors `app.derive_severity()` CASE.
 * Unlisted types fall through to `medium` (SQL ELSE).
 */
export const INCIDENT_TYPE_BASE_SEVERITY: Record<IncidentType, SeverityLevel> = {
  sos: "critical",
  geofence_entry_restricted: "high",
  signal_lost: "high",
  route_deviation: "medium",
  prolonged_inactivity: "medium",
  zone_time_violation: "medium",
  implausible_speed: "low",
  geofence_exit_safe: "low",
  battery_critical: "low",
  anomaly_ml: "medium",
  missed_checkin: "medium",
  manual_report: "medium",
}

function bumpForZoneRisk(
  base: SeverityLevel,
  risk: RiskLevel,
): SeverityLevel {
  if (base === "critical") return base
  if (!HIGH_RISK_LEVELS.includes(risk)) return base
  if (base === "low") return "medium"
  if (base === "medium") return "high"
  return "high"
}

export function isSeverityNightHour(hourIst: number): boolean {
  return hourIst >= SEVERITY_NIGHT_START_HOUR_IST || hourIst < SEVERITY_NIGHT_END_HOUR_IST
}

/**
 * zone.risk × type × time-of-day → severity.
 * Byte-equivalent to `app.derive_severity()` in 20250101000700_functions.sql.
 */
export function deriveSeverity(
  type: IncidentType,
  risk: RiskLevel,
  at: Date | string | number,
): SeverityLevel {
  return deriveSeverityAtHour(type, risk, istHour(at))
}

export function deriveSeverityAtHour(
  type: IncidentType,
  risk: RiskLevel,
  hourIst: number,
): SeverityLevel {
  let base = INCIDENT_TYPE_BASE_SEVERITY[type]
  base = bumpForZoneRisk(base, risk)
  if (isSeverityNightHour(hourIst) && base === "medium") {
    base = "high"
  }
  return base
}
