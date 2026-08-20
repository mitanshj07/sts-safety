// packages/shared/src/constants/hotspots.ts
// GPS hotspot detection for the AI zone-suggestion dashboard.
// The LLM never decides whether a cluster exists — these thresholds do.

import type { IncidentType, RiskLevel, ZoneCategory } from "../schemas/enums"

/** Incidents that count toward a "many requests from one GPS area" cluster. */
export const HOTSPOT_INCIDENT_TYPES = [
  "sos",
  "geofence_entry_restricted",
  "signal_lost",
  "anomaly_ml",
  "manual_report",
  "prolonged_inactivity",
] as const satisfies readonly IncidentType[]

export type HotspotIncidentType = (typeof HOTSPOT_INCIDENT_TYPES)[number]

export const HOTSPOT_TYPE_WEIGHT: Record<HotspotIncidentType, number> = {
  sos: 3,
  geofence_entry_restricted: 2,
  manual_report: 2,
  signal_lost: 1,
  anomaly_ml: 1,
  prolonged_inactivity: 1,
}

/** Neighbour radius for DBSCAN — SOS from the same viewpoint / trailhead. */
export const HOTSPOT_CLUSTER_RADIUS_M = 500

/** Distinct tourists required so one person mashing SOS cannot create a zone. */
export const HOTSPOT_MIN_UNIQUE_TOURISTS = 3

export const HOTSPOT_MIN_INCIDENTS = 3

export const HOTSPOT_LOOKBACK_HOURS = 48

/** Padding added around the observed cluster when proposing a reserved polygon. */
export const HOTSPOT_ZONE_PAD_M = 80

export const HOTSPOT_MIN_ZONE_RADIUS_M = 150

export const HOTSPOT_MAX_ZONE_RADIUS_M = 800

/** Categories that already count as reserved / keep-out. */
export const RESERVED_ZONE_CATEGORIES = [
  "restricted",
  "high_risk",
  "border",
  "forest_reserve",
] as const satisfies readonly ZoneCategory[]

export const HOTSPOT_DEFAULT_CATEGORY = "restricted" as const satisfies ZoneCategory

export const HOTSPOT_DEFAULT_RISK = "high" as const satisfies RiskLevel
