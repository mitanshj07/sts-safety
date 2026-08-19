// apps/web/src/lib/notify/recipients.ts
import "server-only";

import { emergencyContactSchema, haversine, incidentTypeSchema, severityLevelSchema } from "@sts/shared";
import { z } from "zod";

import { serverEnv } from "@/lib/env/server";
import { asRecord, lonLatFromGeog } from "@/lib/geo/parse";
import { haversineEtaSeconds } from "@/lib/geo/osrm";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { nearestResponderRowSchema } from "@/lib/notify/schemas";
import { parseLocale } from "@/lib/notify/templates/messages";
import type { NotifyIncident, NotifyRecipient } from "@/lib/notify/types";

const incidentRowSchema = z
  .object({
    id: z.string().uuid(),
    tourist_id: z.string().uuid().nullable(),
    type: incidentTypeSchema,
    severity: severityLevelSchema,
    status: z.string(),
    geog: z.unknown().nullable().optional(),
    address_text: z.string().nullable().optional(),
    occurred_at: z.string(),
    created_at: z.string(),
    ai_brief: z.string().nullable().optional(),
  })
  .passthrough();

export type NearestUnit = {
  responderId: string;
  name: string;
  distanceM: number;
  etaSeconds: number;
  telegramChatId: string | null;
  profileId: string | null;
  phoneE164: string | null;
};

export type DispatchContext = {
  incident: NotifyIncident;
  recipients: NotifyRecipient[];
  nearest: NearestUnit[];
};

export type TouristRecipientContext = {
  incident: NotifyIncident;
  recipient: NotifyRecipient;
};

async function loadIncident(incidentId: string): Promise<{
  incident: NotifyIncident;
  tourist: Record<string, unknown> | null;
}> {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("incidents")
    .select(
      "id, tourist_id, type, severity, status, geog, address_text, occurred_at, created_at, ai_brief, tourists(id, profile_id, full_name, email, phone_e164, emergency_contacts, nationality), zones(name)",
    )
    .eq("id", incidentId)
    .maybeSingle();
  if (error || !data) {
    throw new Error(error?.message ?? "incident not found");
  }
  const parsed = incidentRowSchema.parse(data);
  const rec = asRecord(data);
  const touristRaw = rec.tourists;
  const tourist = Array.isArray(touristRaw)
    ? asRecord(touristRaw[0])
    : touristRaw && typeof touristRaw === "object"
      ? asRecord(touristRaw)
      : null;
  const zoneRaw = rec.zones;
  const zone = Array.isArray(zoneRaw)
    ? asRecord(zoneRaw[0])
    : zoneRaw && typeof zoneRaw === "object"
      ? asRecord(zoneRaw)
      : null;
  const point = lonLatFromGeog(parsed.geog);
  return {
    incident: {
      id: parsed.id,
      touristId: parsed.tourist_id,
      touristName: tourist ? String(tourist.full_name ?? "Unknown tourist") : null,
      type: parsed.type,
      severity: parsed.severity,
      status: parsed.status,
      lat: point?.lat ?? null,
      lon: point?.lon ?? null,
      addressText: parsed.address_text ?? null,
      zoneName: typeof zone?.name === "string" ? zone.name : null,
      occurredAt: parsed.occurred_at,
      createdAt: parsed.created_at,
      aiBrief: parsed.ai_brief ?? null,
    },
    tourist,
  };
}

async function nearestViaRpc(lat: number, lon: number): Promise<NearestUnit[]> {
  const admin = createAdminSupabase();
  const { data, error } = await admin.rpc("nearest_responders", {
    p_lon: lon,
    p_lat: lat,
    p_limit: serverEnv.responderFanout,
  });
  if (error) throw new Error(error.message);
  const rows = z.array(nearestResponderRowSchema).parse(data ?? []);
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.responder_id);
  const { data: full } = await admin
    .from("responders")
    .select("id, profile_id, phone_e164, telegram_chat_id, base_geog, last_geog")
    .in("id", ids);
  const extra = new Map(
    (full ?? []).map((row) => {
      const rec = asRecord(row);
      const point = lonLatFromGeog(rec.last_geog) ?? lonLatFromGeog(rec.base_geog);
      return [
        String(rec.id),
        {
          profileId: typeof rec.profile_id === "string" ? rec.profile_id : null,
          phoneE164: typeof rec.phone_e164 === "string" ? rec.phone_e164 : null,
          telegramChatId:
            typeof rec.telegram_chat_id === "string" ? rec.telegram_chat_id : null,
          point,
        },
      ];
    }),
  );
  const origin = { lat, lon };
  return rows.map((row) => {
    const more = extra.get(row.responder_id);
    const point = more?.point ?? origin;
    return {
      responderId: row.responder_id,
      name: row.name,
      distanceM: row.distance_m,
      etaSeconds: haversineEtaSeconds(point, origin),
      telegramChatId: more?.telegramChatId ?? row.telegram_chat_id ?? null,
      profileId: more?.profileId ?? null,
      phoneE164: more?.phoneE164 ?? null,
    };
  });
}

async function nearestViaTable(lat: number, lon: number): Promise<NearestUnit[]> {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("responders")
    .select(
      "id, name, profile_id, phone_e164, telegram_chat_id, base_geog, last_geog, coverage_m, on_duty",
    )
    .eq("on_duty", true);
  const origin = { lat, lon };
  return (data ?? [])
    .flatMap((row) => {
      const rec = asRecord(row);
      const point = lonLatFromGeog(rec.last_geog) ?? lonLatFromGeog(rec.base_geog);
      if (!point) return [];
      const distanceM = haversine(origin, point);
      const coverage = Number(rec.coverage_m ?? serverEnv.responderRadiusM);
      if (distanceM > coverage) return [];
      return [
        {
          responderId: String(rec.id),
          name: String(rec.name ?? "Unit"),
          distanceM,
          etaSeconds: haversineEtaSeconds(point, origin),
          telegramChatId:
            typeof rec.telegram_chat_id === "string" ? rec.telegram_chat_id : null,
          profileId: typeof rec.profile_id === "string" ? rec.profile_id : null,
          phoneE164: typeof rec.phone_e164 === "string" ? rec.phone_e164 : null,
        },
      ];
    })
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, serverEnv.responderFanout);
}

export async function resolveNearestUnits(
  lat: number,
  lon: number,
): Promise<NearestUnit[]> {
  try {
    return await nearestViaRpc(lat, lon);
  } catch {
    return nearestViaTable(lat, lon);
  }
}

async function touristRecipientFor(
  incident: NotifyIncident,
  tourist: Record<string, unknown> | null,
): Promise<NotifyRecipient | null> {
  if (!incident.touristId) return null;

  let touristLocale = parseLocale(serverEnv.defaultLocale);
  const profileId: string | null =
    typeof tourist?.profile_id === "string" ? tourist.profile_id : null;

  if (profileId) {
    const admin = createAdminSupabase();
    const { data: profile } = await admin
      .from("profiles")
      .select("id, locale, email, phone_e164, display_name")
      .eq("id", profileId)
      .maybeSingle();
    if (profile) {
      touristLocale = parseLocale(profile.locale);
    }
  }

  return {
    kind: "tourist",
    id: incident.touristId,
    name: incident.touristName ?? "Tourist",
    locale: touristLocale,
    profileId,
    telegramChatId: null,
    email: typeof tourist?.email === "string" ? tourist.email : null,
    phoneE164: typeof tourist?.phone_e164 === "string" ? tourist.phone_e164 : null,
  };
}

export async function resolveTouristRecipient(
  incidentId: string,
): Promise<TouristRecipientContext | null> {
  const { incident, tourist } = await loadIncident(incidentId);
  const recipient = await touristRecipientFor(incident, tourist);
  if (!recipient) return null;
  return { incident, recipient };
}

export async function resolveDispatchContext(
  incidentId: string,
): Promise<DispatchContext> {
  const { incident, tourist } = await loadIncident(incidentId);
  const recipients: NotifyRecipient[] = [];

  const touristRecipient = await touristRecipientFor(incident, tourist);
  let touristLocale = touristRecipient?.locale ?? parseLocale(serverEnv.defaultLocale);
  if (touristRecipient) {
    touristLocale = touristRecipient.locale;
    recipients.push(touristRecipient);
  }

  const nearest =
    incident.lat !== null && incident.lon !== null
      ? await resolveNearestUnits(incident.lat, incident.lon)
      : [];

  for (const unit of nearest) {
    recipients.push({
      kind: "responder",
      id: unit.responderId,
      name: unit.name,
      locale: parseLocale(serverEnv.defaultLocale),
      profileId: unit.profileId,
      telegramChatId: unit.telegramChatId,
      email: null,
      phoneE164: unit.phoneE164,
    });
  }

  recipients.push({
    kind: "authority",
    id: null,
    name: "NE control room",
    locale: parseLocale(serverEnv.defaultLocale),
    profileId: null,
    telegramChatId: serverEnv.telegramControlRoomChatId || null,
    email: serverEnv.authorityEmail || null,
    phoneE164: null,
  });

  if (incident.severity === "critical" && tourist) {
    const parsed = z.array(emergencyContactSchema).safeParse(tourist.emergency_contacts);
    const contacts = parsed.success ? parsed.data : [];
    for (const contact of contacts) {
      if (contact.notify === false) continue;
      recipients.push({
        kind: "emergency_contact",
        id: incident.touristId,
        name: contact.name,
        locale: touristLocale,
        profileId: null,
        telegramChatId: null,
        email: contact.email ?? null,
        phoneE164: contact.phone_e164,
      });
    }
  }

  return { incident, recipients, nearest };
}
