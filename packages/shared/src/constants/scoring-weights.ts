// packages/shared/src/constants/scoring-weights.ts
import type { RiskLevel } from "../schemas/enums"
import { istHour } from "../utils/time"

/** Mirrors `app.compute_safety_score()` in 20250101000700_functions.sql. */
export const SAFETY_SCORE_START = 100
export const SAFETY_SCORE_MIN = 0
export const SAFETY_SCORE_MAX = 100

export const ZONE_RISK_PENALTY: Record<RiskLevel, number> = {
  none: 0,
  low: 4,
  medium: 12,
  high: 25,
  critical: 40,
}

export const DEVIATION_STEP_M = 500
export const DEVIATION_STEP_PENALTY = 5
export const DEVIATION_MAX_PENALTY = 20

export const SILENCE_GRACE_MINUTES = 15
export const SILENCE_STEP_MINUTES = 5
export const SILENCE_STEP_PENALTY = 5
export const SILENCE_MAX_PENALTY = 25

export const OPEN_HIGH_INCIDENT_PENALTY = 15
export const OPEN_HIGH_INCIDENT_MAX_PENALTY = 30

export const ANOMALY_PENALTY_SCALE = 20

/** Night for the safety score: IST hour >= 22 or < 5 (stricter than derive_severity). */
export const SCORE_NIGHT_START_HOUR_IST = 22
export const SCORE_NIGHT_END_HOUR_IST = 5
export const NIGHT_NON_ACCOMMODATION_PENALTY = 5

export type SafetyScoreInput = {
  risk: RiskLevel | null
  deviationM: number | null
  silenceMinutes: number | null
  openHighIncidents: number
  anomalyScore: number | null
  at: Date | string | number
  inAccommodation: boolean
}

export function isScoreNightHour(hourIst: number): boolean {
  return hourIst >= SCORE_NIGHT_START_HOUR_IST || hourIst < SCORE_NIGHT_END_HOUR_IST
}

function pgTruncDiv(numerator: number, denominator: number): number {
  return Math.trunc(numerator / denominator)
}

export function computeSafetyScore(input: SafetyScoreInput): number {
  let s = SAFETY_SCORE_START

  if (input.risk) {
    s -= ZONE_RISK_PENALTY[input.risk]
  }

  if (input.deviationM !== null && input.deviationM > 0) {
    s -= Math.min(
      DEVIATION_MAX_PENALTY,
      pgTruncDiv(input.deviationM, DEVIATION_STEP_M) * DEVIATION_STEP_PENALTY,
    )
  }

  if (input.silenceMinutes !== null && input.silenceMinutes > SILENCE_GRACE_MINUTES) {
    s -= Math.min(
      SILENCE_MAX_PENALTY,
      pgTruncDiv(input.silenceMinutes - SILENCE_GRACE_MINUTES, SILENCE_STEP_MINUTES) *
        SILENCE_STEP_PENALTY,
    )
  }

  s -= Math.min(
    OPEN_HIGH_INCIDENT_MAX_PENALTY,
    input.openHighIncidents * OPEN_HIGH_INCIDENT_PENALTY,
  )

  if (input.anomalyScore !== null) {
    s -= Math.trunc(input.anomalyScore * ANOMALY_PENALTY_SCALE)
  }

  if (isScoreNightHour(istHour(input.at)) && !input.inAccommodation) {
    s -= NIGHT_NON_ACCOMMODATION_PENALTY
  }

  return Math.max(SAFETY_SCORE_MIN, Math.min(SAFETY_SCORE_MAX, s))
}
