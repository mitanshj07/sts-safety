// apps/web/src/lib/command/types.ts
import type {
  DetectionSource,
  DispatchStatus,
  GeoJsonPolygon,
  IdStatus,
  IncidentStatus,
  IncidentType,
  RiskLevel,
  SeverityLevel,
  ZoneCategory,
} from "@sts/shared"

export type ConnectionStatus =
  | "connecting"
  | "live"
  | "reconnecting"
  | "polling"
  | "offline"

export type OperatorPresence = {
  key: string
  label: string
  arrivedAt: string
}

export type LiveTourist = {
  id: string
  full_name: string
  nationality: string
  safety_score: number
  last_ping_at: string | null
  lat: number | null
  lon: number | null
  current_zone_ids: string[]
  token_id: string | null
  id_status: IdStatus | null
  open_incidents: number
  photo_path: string | null
  phone_e164: string | null
  status: string
}

export type LiveIncident = {
  id: string
  tourist_id: string | null
  type: IncidentType
  severity: SeverityLevel
  status: IncidentStatus
  detected_by: DetectionSource
  lat: number | null
  lon: number | null
  zone_id: string | null
  address_text: string | null
  anomaly_score: number | null
  safety_score_at: number | null
  payload: Record<string, unknown>
  ai_brief: string | null
  ai_brief_model: string | null
  occurred_at: string
  acknowledged_at: string | null
  resolved_at: string | null
  resolution_notes: string | null
  record_hash: string | null
  tourist_name: string | null
  nationality: string | null
  tourist_phone: string | null
  tourist_photo: string | null
  zone_name: string | null
  zone_category: ZoneCategory | null
  anchor_tx: string | null
  anchor_status: string | null
  anchor_block: number | null
  tourist_token_id: string | null
}

export type LiveDispatch = {
  id: string
  incident_id: string
  responder_id: string
  responder_name: string | null
  status: DispatchStatus
  distance_m: number | null
  eta_seconds: number | null
  sent_at: string
  acknowledged_at: string | null
}

export type LiveZone = {
  id: string
  name: string
  category: ZoneCategory
  risk_level: RiskLevel
  geom: GeoJsonPolygon | null
  time_windows: Array<{
    days: number[]
    from: string
    to: string
    risk_level: RiskLevel
  }>
  active: boolean
  district: string | null
  state_code: string | null
  requires_permit: boolean
  advisory_text: string | null
}

export type LiveResponder = {
  id: string
  name: string
  unit_type: string
  station_name: string | null
  phone_e164: string | null
  lat: number
  lon: number
  coverage_m: number
  on_duty: boolean
  state_code: string | null
  district: string | null
  last_seen_at: string | null
}

export type IncidentEvent = {
  id: number
  incident_id: string
  event_type: string
  actor_id: string | null
  actor_label: string | null
  detail: Record<string, unknown>
  created_at: string
}

export type CommandKpis = {
  activeTourists: number
  openBySeverity: Record<SeverityLevel, number>
  mttaSeconds: number | null
  mttrSeconds: number | null
  onDutyResponders: number
  anchoredIncidents: number
}

export type CommandSnapshot = {
  tourists: LiveTourist[]
  incidents: LiveIncident[]
  dispatches: LiveDispatch[]
  zones: LiveZone[]
  responders: LiveResponder[]
  kpis: CommandKpis
  fetchedAt: string
}

export type NearestResponder = {
  responder_id: string
  name: string
  unit_type: string
  station_name: string | null
  distance_m: number
  eta_seconds: number
  eta_source: "osrm" | "haversine"
  on_duty: boolean
  lat: number
  lon: number
  already_dispatched: boolean
  dispatch_status: DispatchStatus | null
}

export type TrackPoint = {
  lat: number
  lon: number
  recorded_at: string
}

export type DigitalIdCard = {
  token_id: string | null
  status: IdStatus | null
  chain_id: number | null
  contract_address: string | null
  kyc_commitment: string | null
  valid_from: string | null
  valid_until: string | null
  issue_tx_hash: string | null
  issue_block: number | null
  holder_address: string | null
}

export type HotspotSuggestion = {
  id: string
  cluster_key: string
  status: "open" | "accepted" | "dismissed"
  lat: number
  lon: number
  radius_m: number
  incident_count: number
  unique_tourists: number
  sos_count: number
  dominant_type: IncidentType
  type_counts: Record<string, number>
  incident_ids: string[]
  proposed_name: string
  proposed_category: ZoneCategory
  proposed_risk: RiskLevel
  proposed_geom: GeoJsonPolygon
  address_text: string | null
  covering_zone_id: string | null
  covering_zone_name: string | null
  already_reserved: boolean
  rationale: string
  rationale_model: string | null
  score: number
  first_at: string | null
  last_at: string | null
  window_hours: number
  zone_id: string | null
}
