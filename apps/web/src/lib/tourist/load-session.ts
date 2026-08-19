// apps/web/src/lib/tourist/load-session.ts
import { getBrowserSupabase } from "@/lib/supabase/client";
import { isCommandNoteNotification } from "@sts/shared";
import {
  kvGet,
  kvSet,
  type CachedDigitalId,
  type CachedItinerary,
  type CachedNotification,
  type CachedTourist,
} from "@/lib/offline/db";
import type { Waypoint } from "@/lib/tourist/routes";

export type TouristSession = {
  profileId: string | null;
  tourist: CachedTourist | null;
  digitalId: CachedDigitalId | null;
  itinerary: CachedItinerary | null;
  notifications: CachedNotification[];
};

const EMPTY: TouristSession = {
  profileId: null,
  tourist: null,
  digitalId: null,
  itinerary: null,
  notifications: [],
};

function asTourist(row: Record<string, unknown>, profileId: string | null): CachedTourist {
  return {
    id: String(row.id),
    profile_id: profileId,
    full_name: String(row.full_name ?? "Tourist"),
    nationality: String(row.nationality ?? "IN"),
    kyc_type: String(row.kyc_type ?? "passport"),
    kyc_last4: typeof row.kyc_last4 === "string" ? row.kyc_last4 : null,
    photo_data_url: null,
    safety_score: Number(row.safety_score ?? 100),
    trip_start: String(row.trip_start ?? new Date().toISOString()),
    trip_end: String(row.trip_end ?? new Date().toISOString()),
    phone_e164: typeof row.phone_e164 === "string" ? row.phone_e164 : null,
    email: typeof row.email === "string" ? row.email : null,
    emergency_contacts: row.emergency_contacts ?? [],
    current_zone_ids: Array.isArray(row.current_zone_ids)
      ? row.current_zone_ids.map(String)
      : [],
    tracking_enabled: row.tracking_enabled !== false,
  };
}

export async function loadCachedSession(): Promise<TouristSession> {
  const cached = await kvGet<TouristSession>("session");
  return cached ?? EMPTY;
}

export async function saveSession(session: TouristSession): Promise<void> {
  await kvSet("session", session);
}

export async function loadLiveSession(): Promise<TouristSession> {
  const cached = await loadCachedSession();
  const supabase = getBrowserSupabase();
  if (!supabase || !navigator.onLine) return cached;

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return cached;

  const { data: touristRow } = await supabase
    .from("tourists")
    .select(
      "id, profile_id, full_name, nationality, kyc_type, kyc_last4, safety_score, trip_start, trip_end, phone_e164, email, emergency_contacts, current_zone_ids, tracking_enabled, photo_path",
    )
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!touristRow) {
    const next = { ...cached, profileId: user.id };
    await saveSession(next);
    return next;
  }

  const tourist = asTourist(touristRow as Record<string, unknown>, user.id);
  tourist.photo_data_url = cached.tourist?.photo_data_url ?? null;

  const [{ data: idRow }, { data: itinJson }, { data: notes }] = await Promise.all([
    supabase
      .from("digital_ids")
      .select(
        "tourist_id, chain_id, contract_address, token_id, vc_path, status, issue_tx_hash, valid_from, valid_until",
      )
      .eq("tourist_id", tourist.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.rpc("my_itinerary_geojson"),
    supabase
      .from("notifications")
      .select("id, title, body, channel, status, created_at, incident_id, provider_ref")
      .or(`recipient_id.eq.${user.id},recipient_id.eq.${tourist.id}`)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  let digitalId = cached.digitalId;
  if (idRow) {
    const rec = idRow as Record<string, unknown>;
    digitalId = {
      tourist_id: tourist.id,
      chain_id: Number(rec.chain_id ?? 80002),
      contract_address: String(rec.contract_address ?? ""),
      token_id: rec.token_id == null ? null : String(rec.token_id),
      vc_path: typeof rec.vc_path === "string" ? rec.vc_path : null,
      status: (rec.status as CachedDigitalId["status"]) ?? "pending",
      issue_tx_hash: typeof rec.issue_tx_hash === "string" ? rec.issue_tx_hash : null,
      valid_from: String(rec.valid_from ?? tourist.trip_start),
      valid_until: String(rec.valid_until ?? tourist.trip_end),
      kyc_last4: tourist.kyc_last4,
      full_name: tourist.full_name,
      nationality: tourist.nationality,
      photo_data_url: tourist.photo_data_url,
    };
  }

  let itinerary = cached.itinerary;
  if (itinJson && typeof itinJson === "object") {
    const rec = itinJson as Record<string, unknown>;
    const geom = rec.geometry;
    if (geom && typeof geom === "object" && (geom as { type?: string }).type === "LineString") {
      itinerary = {
        id: String(rec.id),
        title: String(rec.title ?? "Planned route"),
        corridor_m: Number(rec.corridor_m ?? 2000),
        waypoints: Array.isArray(rec.waypoints) ? (rec.waypoints as Waypoint[]) : [],
        starts_at: String(rec.starts_at ?? tourist.trip_start),
        ends_at: String(rec.ends_at ?? tourist.trip_end),
        geometry: geom as GeoJSON.LineString,
      };
    }
  }

  const notifications: CachedNotification[] = Array.isArray(notes)
    ? notes.map((n) => {
        const rec = n as Record<string, unknown>;
        return {
          id: (rec.id as number | string) ?? crypto.randomUUID(),
          title: typeof rec.title === "string" ? rec.title : null,
          body: typeof rec.body === "string" ? rec.body : null,
          channel: String(rec.channel ?? "realtime"),
          status: String(rec.status ?? "queued"),
          created_at: String(rec.created_at ?? new Date().toISOString()),
          incident_id: typeof rec.incident_id === "string" ? rec.incident_id : null,
          provider_ref: typeof rec.provider_ref === "string" ? rec.provider_ref : null,
        };
      })
    : cached.notifications;

  const seenNotes = new Set<string>();
  const deduped = notifications.filter((row) => {
    if (!isCommandNoteNotification(row)) return true;
    const key = `${row.incident_id ?? ""}:${row.body ?? ""}`;
    if (seenNotes.has(key)) return false;
    seenNotes.add(key);
    return true;
  });

  const session: TouristSession = {
    profileId: user.id,
    tourist,
    digitalId,
    itinerary,
    notifications: deduped,
  };
  await saveSession(session);
  return session;
}
