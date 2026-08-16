// apps/web/src/lib/command/queries.ts
import "server-only"
import type { EmergencyContact } from "@sts/shared"
import { haversine } from "@sts/shared"
import { createAdminSupabase } from "@/lib/supabase/admin"
import { serverEnv } from "@/lib/env/server"
import { asRecord, lonLatFromGeog, polygonFromGeog } from "@/lib/geo/parse"
import { etaSeconds } from "@/lib/geo/osrm"
import { computeKpis } from "@/lib/command/kpis"
import type {
  CommandSnapshot,
  DigitalIdCard,
  IncidentEvent,
  LiveDispatch,
  LiveIncident,
  LiveResponder,
  LiveTourist,
  LiveZone,
  NearestResponder,
  TrackPoint,
} from "@/lib/command/types"

type NestedTourist = {
  full_name?: string
  nationality?: string
  phone_e164?: string | null
  photo_path?: string | null
  digital_ids?: Array<{ token_id?: string | number | null }>
} | null

type NestedZone = { name?: string; category?: string } | null

type NestedAnchor = {
  tx_hash?: string | null
  status?: string | null
  block_number?: number | null
  kind?: string | null
} | null

function first<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value
  if (typeof value === "number") return String(value)
  return null
}

function asCoord(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim().length > 0) {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

function mapTourist(row: Record<string, unknown>): LiveTourist {
  const point = lonLatFromGeog(row.last_geog) ?? lonLatFromGeog(row.geog)
  const lat = asCoord(row.lat) ?? point?.lat ?? null
  const lon = asCoord(row.lon) ?? point?.lon ?? null
  const zoneIds = Array.isArray(row.current_zone_ids)
    ? row.current_zone_ids.filter((id): id is string => typeof id === "string")
    : []
  return {
    id: String(row.id),
    full_name: String(row.full_name ?? "Unknown"),
    nationality: String(row.nationality ?? "IN"),
    safety_score: Number(row.safety_score ?? 100),
    last_ping_at: asString(row.last_ping_at),
    lat,
    lon,
    current_zone_ids: zoneIds,
    token_id: asString(row.token_id),
    id_status: (asString(row.id_status) as LiveTourist["id_status"]) ?? null,
    open_incidents: Number(row.open_incidents ?? 0),
    photo_path: asString(row.photo_path),
    phone_e164: asString(row.phone_e164),
    status: String(row.status ?? "active"),
  }
}

function mapIncident(row: Record<string, unknown>): LiveIncident {
  const tourist = first(row.tourists as NestedTourist | NestedTourist[])
  const zone = first(row.zones as NestedZone | NestedZone[])
  const anchors = row.chain_anchors as NestedAnchor | NestedAnchor[] | undefined
  const anchorList = Array.isArray(anchors) ? anchors : anchors ? [anchors] : []
  const incidentAnchor =
    anchorList.find((a) => a?.kind === "incident") ?? anchorList[0] ?? null
  const digitalIds = tourist?.digital_ids
  const token = Array.isArray(digitalIds) ? digitalIds[0]?.token_id : null
  const point = lonLatFromGeog(row.geog)
  return {
    id: String(row.id),
    tourist_id: asString(row.tourist_id),
    type: row.type as LiveIncident["type"],
    severity: row.severity as LiveIncident["severity"],
    status: row.status as LiveIncident["status"],
    detected_by: (row.detected_by as LiveIncident["detected_by"]) ?? "rules",
    lat: asCoord(row.lat) ?? point?.lat ?? null,
    lon: asCoord(row.lon) ?? point?.lon ?? null,
    zone_id: asString(row.zone_id),
    address_text: asString(row.address_text),
    anomaly_score: typeof row.anomaly_score === "number" ? row.anomaly_score : null,
    safety_score_at:
      typeof row.safety_score_at === "number" ? row.safety_score_at : null,
    payload: asRecord(row.payload),
    ai_brief: asString(row.ai_brief),
    ai_brief_model: asString(row.ai_brief_model),
    occurred_at: String(row.occurred_at),
    acknowledged_at: asString(row.acknowledged_at),
    resolved_at: asString(row.resolved_at),
    resolution_notes: asString(row.resolution_notes),
    record_hash: asString(row.record_hash),
    tourist_name: tourist?.full_name ?? asString(row.tourist_name),
    nationality: tourist?.nationality ?? asString(row.nationality),
    tourist_phone: tourist?.phone_e164 ?? asString(row.phone_e164),
    tourist_photo: tourist?.photo_path ?? asString(row.photo_path),
    zone_name: zone?.name ?? asString(row.zone_name),
    zone_category: (zone?.category as LiveIncident["zone_category"]) ?? null,
    anchor_tx: incidentAnchor?.tx_hash ?? asString(row.anchor_tx),
    anchor_status: incidentAnchor?.status ?? asString(row.anchor_status),
    anchor_block: incidentAnchor?.block_number ?? null,
    tourist_token_id: token !== undefined && token !== null ? String(token) : null,
  }
}

function mapDispatch(row: Record<string, unknown>): LiveDispatch {
  const responder = first(
    row.responders as { name?: string } | { name?: string }[] | null,
  )
  return {
    id: String(row.id),
    incident_id: String(row.incident_id),
    responder_id: String(row.responder_id),
    responder_name: responder?.name ?? asString(row.responder_name),
    status: row.status as LiveDispatch["status"],
    distance_m: typeof row.distance_m === "number" ? row.distance_m : null,
    eta_seconds: typeof row.eta_seconds === "number" ? row.eta_seconds : null,
    sent_at: String(row.sent_at),
    acknowledged_at: asString(row.acknowledged_at),
  }
}

function mapZone(row: Record<string, unknown>): LiveZone {
  const windowsRaw = Array.isArray(row.time_windows) ? row.time_windows : []
  const time_windows = windowsRaw.flatMap((w) => {
    if (!w || typeof w !== "object") return []
    const rec = w as Record<string, unknown>
    const days = Array.isArray(rec.days)
      ? rec.days.filter((d): d is number => typeof d === "number")
      : []
    if (typeof rec.from !== "string" || typeof rec.to !== "string") return []
    return [
      {
        days,
        from: rec.from,
        to: rec.to,
        risk_level: (typeof rec.risk_level === "string"
          ? rec.risk_level
          : "low") as LiveZone["risk_level"],
      },
    ]
  })
  return {
    id: String(row.id),
    name: String(row.name),
    category: row.category as LiveZone["category"],
    risk_level: row.risk_level as LiveZone["risk_level"],
    geom: polygonFromGeog(row.geom),
    time_windows,
    active: Boolean(row.active ?? true),
    district: asString(row.district),
    state_code: asString(row.state_code),
    requires_permit: Boolean(row.requires_permit),
    advisory_text: asString(row.advisory_text),
  }
}

function mapResponder(row: Record<string, unknown>): LiveResponder | null {
  const point = lonLatFromGeog(row.last_geog) ?? lonLatFromGeog(row.base_geog)
  if (!point) return null
  return {
    id: String(row.id),
    name: String(row.name),
    unit_type: String(row.unit_type ?? "police_station"),
    station_name: asString(row.station_name),
    phone_e164: asString(row.phone_e164),
    lat: point.lat,
    lon: point.lon,
    coverage_m: Number(row.coverage_m ?? 15000),
    on_duty: Boolean(row.on_duty),
    state_code: asString(row.state_code),
    district: asString(row.district),
    last_seen_at: asString(row.last_seen_at),
  }
}

const INCIDENT_SELECT =
  "id, tourist_id, type, severity, status, detected_by, geog, zone_id, address_text, anomaly_score, safety_score_at, payload, ai_brief, ai_brief_model, occurred_at, acknowledged_at, resolved_at, resolution_notes, record_hash, tourists(full_name, nationality, phone_e164, photo_path, digital_ids(token_id)), zones(name, category)"

export async function fetchCommandSnapshot(): Promise<CommandSnapshot> {
  const admin = createAdminSupabase()
  const [touristsRes, incidentsRes, dispatchesRes, zonesRes, respondersRes, anchorsRes] =
    await Promise.all([
      admin
        .from("v_live_tourists")
        .select(
          "id, full_name, nationality, safety_score, last_ping_at, lat, lon, current_zone_ids, token_id, id_status, open_incidents",
        ),
      admin
        .from("incidents")
        .select(INCIDENT_SELECT)
        .order("occurred_at", { ascending: false })
        .limit(200),
      admin
        .from("dispatches")
        .select("id, incident_id, responder_id, status, distance_m, eta_seconds, sent_at, acknowledged_at, responders(name)")
        .order("sent_at", { ascending: false })
        .limit(200),
      admin
        .from("zones")
        .select(
          "id, name, category, risk_level, geom, time_windows, active, district, state_code, requires_permit, advisory_text, description",
        )
        .eq("active", true),
      admin
        .from("responders")
        .select(
          "id, name, unit_type, station_name, phone_e164, base_geog, last_geog, coverage_m, on_duty, state_code, district, last_seen_at",
        ),
      admin
        .from("chain_anchors")
        .select("subject_id, tx_hash, status, block_number, kind")
        .eq("kind", "incident"),
    ])

  if (touristsRes.error) {
    console.error("snapshot tourists", touristsRes.error.message)
  }
  if (incidentsRes.error) {
    console.error("snapshot incidents", incidentsRes.error.message)
  }
  if (dispatchesRes.error) {
    console.error("snapshot dispatches", dispatchesRes.error.message)
  }
  if (zonesRes.error) {
    console.error("snapshot zones", zonesRes.error.message)
  }
  if (respondersRes.error) {
    console.error("snapshot responders", respondersRes.error.message)
  }

  const tourists = (touristsRes.data ?? []).map((row) => mapTourist(asRecord(row)))

  const anchorsBySubject = new Map<string, NestedAnchor>()
  for (const row of anchorsRes.data ?? []) {
    const rec = asRecord(row)
    const id = asString(rec.subject_id)
    if (!id) continue
    anchorsBySubject.set(id, {
      tx_hash: asString(rec.tx_hash),
      status: asString(rec.status),
      block_number: typeof rec.block_number === "number" ? rec.block_number : null,
      kind: asString(rec.kind),
    })
  }

  const incidents = (incidentsRes.data ?? []).map((row) => {
    const rec = asRecord(row)
    const anchor = rec.id ? anchorsBySubject.get(String(rec.id)) : undefined
    return mapIncident({
      ...rec,
      chain_anchors: anchor ?? null,
    })
  })
  const dispatches = (dispatchesRes.data ?? []).map((row) => mapDispatch(asRecord(row)))
  const zones = (zonesRes.data ?? []).map((row) => mapZone(asRecord(row)))
  const responders = (respondersRes.data ?? [])
    .map((row) => mapResponder(asRecord(row)))
    .filter((r): r is LiveResponder => r !== null)

  const openCounts = new Map<string, number>()
  for (const incident of incidents) {
    if (!incident.tourist_id) continue
    if (["open", "acknowledged", "dispatched"].includes(incident.status)) {
      openCounts.set(incident.tourist_id, (openCounts.get(incident.tourist_id) ?? 0) + 1)
    }
  }
  for (const tourist of tourists) {
    tourist.open_incidents = openCounts.get(tourist.id) ?? tourist.open_incidents ?? 0
  }

  const anchoredCount = (anchorsRes.data ?? []).filter((row) => {
    const status = asRecord(row).status
    return status === "submitted" || status === "confirmed"
  }).length

  return {
    tourists,
    incidents,
    dispatches,
    zones,
    responders,
    kpis: computeKpis(
      tourists,
      incidents,
      responders,
      anchoredCount,
      serverEnv.signalLostMinutes,
    ),
    fetchedAt: new Date().toISOString(),
  }
}

export async function fetchIncidentById(id: string): Promise<LiveIncident | null> {
  const admin = createAdminSupabase()
  const [{ data, error }, { data: anchor }] = await Promise.all([
    admin
      .from("incidents")
      .select(INCIDENT_SELECT)
      .eq("id", id)
      .maybeSingle(),
    admin
      .from("chain_anchors")
      .select("tx_hash, status, block_number, kind")
      .eq("kind", "incident")
      .eq("subject_id", id)
      .maybeSingle(),
  ])
  if (error || !data) return null
  return mapIncident({
    ...asRecord(data),
    chain_anchors: anchor ?? null,
  })
}

export async function fetchIncidentEvents(incidentId: string): Promise<IncidentEvent[]> {
  const admin = createAdminSupabase()
  const { data } = await admin
    .from("incident_events")
    .select("id, incident_id, event_type, actor_id, actor_label, detail, created_at")
    .eq("incident_id", incidentId)
    .order("created_at", { ascending: true })
  return (data ?? []).map((row) => {
    const rec = asRecord(row)
    return {
      id: Number(rec.id),
      incident_id: String(rec.incident_id),
      event_type: String(rec.event_type),
      actor_id: typeof rec.actor_id === "string" ? rec.actor_id : null,
      actor_label: typeof rec.actor_label === "string" ? rec.actor_label : null,
      detail: asRecord(rec.detail),
      created_at: String(rec.created_at),
    }
  })
}

export async function fetchTouristDetail(id: string): Promise<{
  tourist: LiveTourist
  contacts: EmergencyContact[]
  digitalId: DigitalIdCard
  email: string | null
} | null> {
  const admin = createAdminSupabase()
  const { data } = await admin
    .from("tourists")
    .select(
      "id, full_name, nationality, safety_score, last_ping_at, last_geog, current_zone_ids, photo_path, phone_e164, email, emergency_contacts, status, digital_ids(token_id, status, chain_id, contract_address, kyc_commitment, valid_from, valid_until, issue_tx_hash, issue_block, holder_address)",
    )
    .eq("id", id)
    .maybeSingle()
  if (!data) return null
  const rec = asRecord(data)
  const ids = Array.isArray(rec.digital_ids) ? rec.digital_ids.map(asRecord) : []
  const active = ids.find((d) => d.status === "active") ?? ids[0] ?? {}
  const contactsRaw = Array.isArray(rec.emergency_contacts) ? rec.emergency_contacts : []
  const contacts: EmergencyContact[] = contactsRaw.flatMap((c) => {
    if (!c || typeof c !== "object") return []
    const row = asRecord(c)
    if (typeof row.name !== "string" || typeof row.phone_e164 !== "string") return []
    return [
      {
        name: row.name,
        relation: typeof row.relation === "string" ? row.relation : "contact",
        phone_e164: row.phone_e164,
        email: typeof row.email === "string" ? row.email : undefined,
        notify: row.notify !== false,
      },
    ]
  })
  return {
    tourist: mapTourist({ ...rec, token_id: active.token_id, id_status: active.status }),
    contacts,
    email: asString(rec.email),
    digitalId: {
      token_id: asString(active.token_id),
      status: (asString(active.status) as DigitalIdCard["status"]) ?? null,
      chain_id: typeof active.chain_id === "number" ? active.chain_id : null,
      contract_address: asString(active.contract_address),
      kyc_commitment: asString(active.kyc_commitment),
      valid_from: asString(active.valid_from),
      valid_until: asString(active.valid_until),
      issue_tx_hash: asString(active.issue_tx_hash),
      issue_block: typeof active.issue_block === "number" ? active.issue_block : null,
      holder_address: asString(active.holder_address),
    },
  }
}

export async function fetchTrackLastHour(touristId: string): Promise<TrackPoint[]> {
  const admin = createAdminSupabase()
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data } = await admin
    .from("location_pings")
    .select("geog, recorded_at")
    .eq("tourist_id", touristId)
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: true })
    .limit(720)
  return (data ?? []).flatMap((row) => {
    const rec = asRecord(row)
    const point = lonLatFromGeog(rec.geog)
    if (!point || typeof rec.recorded_at !== "string") return []
    return [{ lat: point.lat, lon: point.lon, recorded_at: rec.recorded_at }]
  })
}

export async function fetchNearestResponders(
  lat: number,
  lon: number,
  incidentId: string,
): Promise<NearestResponder[]> {
  const admin = createAdminSupabase()
  const [{ data: responders }, { data: existing }] = await Promise.all([
    admin
      .from("responders")
      .select(
        "id, name, unit_type, station_name, base_geog, last_geog, coverage_m, on_duty",
      )
      .eq("on_duty", true),
    admin.from("dispatches").select("responder_id, status").eq("incident_id", incidentId),
  ])
  const dispatched = new Map(
    (existing ?? []).map((row) => [String(asRecord(row).responder_id), String(asRecord(row).status)]),
  )
  const origin = { lat, lon }
  const ranked = (responders ?? [])
    .map((row) => {
      const rec = asRecord(row)
      const point = lonLatFromGeog(rec.last_geog) ?? lonLatFromGeog(rec.base_geog)
      if (!point) return null
      const distance_m = haversine(origin, point)
      const coverage = Number(rec.coverage_m ?? serverEnv.responderRadiusM)
      if (distance_m > coverage) return null
      return {
        rec,
        point,
        distance_m,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => a.distance_m - b.distance_m)
    .slice(0, serverEnv.responderFanout)

  return Promise.all(
    ranked.map(async ({ rec, point, distance_m }) => {
      const eta = await etaSeconds(point, origin)
      const id = String(rec.id)
      const dispatchStatus = dispatched.get(id) ?? null
      return {
        responder_id: id,
        name: String(rec.name),
        unit_type: String(rec.unit_type ?? "police_station"),
        station_name: asString(rec.station_name),
        distance_m: Math.round(distance_m),
        eta_seconds: eta.seconds,
        eta_source: eta.source,
        on_duty: Boolean(rec.on_duty),
        lat: point.lat,
        lon: point.lon,
        already_dispatched: dispatchStatus !== null,
        dispatch_status: dispatchStatus as NearestResponder["dispatch_status"],
      }
    }),
  )
}

export async function fetchZoneRiskRanking(): Promise<
  Array<{
    id: string
    name: string
    category: string
    risk_level: string
    district: string | null
    state_code: string | null
    incident_count_30d: number
    severe_count_30d: number
  }>
> {
  const admin = createAdminSupabase()
  const { data } = await admin.from("v_zone_risk_ranking").select("*").limit(50)
  return (data ?? []).map((row) => {
    const rec = asRecord(row)
    return {
      id: String(rec.id),
      name: String(rec.name),
      category: String(rec.category),
      risk_level: String(rec.risk_level),
      district: asString(rec.district),
      state_code: asString(rec.state_code),
      incident_count_30d: Number(rec.incident_count_30d ?? 0),
      severe_count_30d: Number(rec.severe_count_30d ?? 0),
    }
  })
}

export async function signedPhotoUrl(path: string | null): Promise<string | null> {
  if (!path) return null
  const admin = createAdminSupabase()
  const bucket = process.env.SUPABASE_BUCKET_DOCS ?? "tourist-docs"
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, 3600)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}
