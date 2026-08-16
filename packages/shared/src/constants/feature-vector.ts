// packages/shared/src/constants/feature-vector.ts
/**
 * Canonical IsolationForest feature order.
 * Keep byte-identical to `services/ai/app/features.py` → FEATURE_NAMES.
 * The HF Space and the Vercel ONNX fallback both consume this order.
 */
export const FEATURE_NAMES = [
  "speed_mean_mps",
  "speed_std_mps",
  "speed_max_mps",
  "accel_std_mps2",
  "bearing_change_entropy",
  "stop_count",
  "stop_duration_s",
  "itinerary_distance_m",
  "radius_of_gyration_m",
  "straightness_index",
  "night_fraction",
  "zone_risk_weighted_dwell",
  "ping_gap_mean_s",
  "ping_gap_max_s",
  "battery_slope_pct_per_h",
  "total_distance_m",
  "window_duration_s",
  "n_pings",
] as const

export type FeatureName = (typeof FEATURE_NAMES)[number]
export type FeatureVector = { [K in FeatureName]: number }

export const FEATURE_COUNT = FEATURE_NAMES.length

export const STOP_EPS_M = 50
export const STOP_MIN_DURATION_S = 60

export const FEATURE_INDEX: Record<FeatureName, number> = {
  speed_mean_mps: 0,
  speed_std_mps: 1,
  speed_max_mps: 2,
  accel_std_mps2: 3,
  bearing_change_entropy: 4,
  stop_count: 5,
  stop_duration_s: 6,
  itinerary_distance_m: 7,
  radius_of_gyration_m: 8,
  straightness_index: 9,
  night_fraction: 10,
  zone_risk_weighted_dwell: 11,
  ping_gap_mean_s: 12,
  ping_gap_max_s: 13,
  battery_slope_pct_per_h: 14,
  total_distance_m: 15,
  window_duration_s: 16,
  n_pings: 17,
}
