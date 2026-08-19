// apps/web/src/lib/notify/lifecycle.ts
import "server-only";

import { createAdminSupabase } from "@/lib/supabase/admin";
import { broadcastIncident } from "@/lib/notify/channels/realtime";
import { notifyLog } from "@/lib/notify/log";
import { resolveNearestUnits } from "@/lib/notify/recipients";
import { lonLatFromGeog } from "@/lib/geo/parse";
import { asRecord } from "@/lib/geo/parse";
import { commandNotePreset } from "@sts/shared";

export type LifecycleResult =
  | { ok: true; status: string; delivered?: number }
  | { ok: false; error: string };

async function loadIncidentRow(incidentId: string): Promise<Record<string, unknown> | null> {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("incidents")
    .select("id, tourist_id, type, severity, status, geog, acknowledged_at")
    .eq("id", incidentId)
    .maybeSingle();
  return data ? asRecord(data) : null;
}

async function appendEvent(input: {
  incidentId: string;
  eventType: string;
  actorLabel: string;
  actorId?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  const admin = createAdminSupabase();
  await admin.from("incident_events").insert({
    incident_id: input.incidentId,
    event_type: input.eventType,
    actor_label: input.actorLabel,
    actor_id: input.actorId ?? null,
    detail: input.detail ?? {},
  });
}

async function emit(input: {
  kind: "ack" | "dispatch" | "resolve" | "note";
  incidentId: string;
  touristId: string | null;
  status: string;
  severity: string;
  type: string;
  actorLabel: string;
  title?: string;
  body?: string;
}): Promise<void> {
  await broadcastIncident({
    kind: input.kind,
    incident_id: input.incidentId,
    tourist_id: input.touristId,
    status: input.status,
    severity: input.severity,
    type: input.type,
    actor_label: input.actorLabel,
    at: new Date().toISOString(),
    title: input.title,
    body: input.body,
  });
}

export async function ackIncident(input: {
  incidentId: string;
  actorLabel: string;
  actorId?: string | null;
}): Promise<LifecycleResult> {
  const row = await loadIncidentRow(input.incidentId);
  if (!row) return { ok: false, error: "Incident not found" };
  const admin = createAdminSupabase();
  const now = new Date().toISOString();
  const current = String(row.status);
  const nextStatus = current === "open" ? "acknowledged" : current;
  const { error } = await admin
    .from("incidents")
    .update({
      status: nextStatus,
      acknowledged_at: typeof row.acknowledged_at === "string" ? row.acknowledged_at : now,
    })
    .eq("id", input.incidentId);
  if (error) return { ok: false, error: error.message };

  await admin
    .from("dispatches")
    .update({ status: "acknowledged", acknowledged_at: now })
    .eq("incident_id", input.incidentId)
    .eq("status", "sent");

  await appendEvent({
    incidentId: input.incidentId,
    eventType: "ack",
    actorLabel: input.actorLabel,
    actorId: input.actorId,
    detail: { from: current, to: nextStatus },
  });
  await emit({
    kind: "ack",
    incidentId: input.incidentId,
    touristId: typeof row.tourist_id === "string" ? row.tourist_id : null,
    status: nextStatus,
    severity: String(row.severity),
    type: String(row.type),
    actorLabel: input.actorLabel,
  });
  notifyLog("notify.ack", { incident_id: input.incidentId, actor: input.actorLabel });
  return { ok: true, status: nextStatus };
}

export async function dispatchNearest(input: {
  incidentId: string;
  actorLabel: string;
  actorId?: string | null;
}): Promise<LifecycleResult> {
  const row = await loadIncidentRow(input.incidentId);
  if (!row) return { ok: false, error: "Incident not found" };
  const point = lonLatFromGeog(row.geog);
  const nearest =
    point !== null ? await resolveNearestUnits(point.lat, point.lon) : [];
  const admin = createAdminSupabase();
  if (nearest.length > 0) {
    await admin.from("dispatches").upsert(
      nearest.map((unit) => ({
        incident_id: input.incidentId,
        responder_id: unit.responderId,
        status: "sent" as const,
        distance_m: unit.distanceM,
        eta_seconds: unit.etaSeconds,
        sent_at: new Date().toISOString(),
      })),
      { onConflict: "incident_id,responder_id" },
    );
  }
  const current = String(row.status);
  const next =
    current === "open" || current === "acknowledged" ? "dispatched" : current;
  await admin.from("incidents").update({ status: next }).eq("id", input.incidentId);
  await appendEvent({
    incidentId: input.incidentId,
    eventType: "dispatched",
    actorLabel: input.actorLabel,
    actorId: input.actorId,
    detail: {
      units: nearest.map((u) => u.name),
      eta_seconds: nearest[0]?.etaSeconds ?? null,
    },
  });
  await emit({
    kind: "dispatch",
    incidentId: input.incidentId,
    touristId: typeof row.tourist_id === "string" ? row.tourist_id : null,
    status: next,
    severity: String(row.severity),
    type: String(row.type),
    actorLabel: input.actorLabel,
  });
  return { ok: true, status: next };
}

export async function resolveIncidentLifecycle(input: {
  incidentId: string;
  notes: string;
  actorLabel: string;
  actorId?: string | null;
}): Promise<LifecycleResult> {
  const row = await loadIncidentRow(input.incidentId);
  if (!row) return { ok: false, error: "Incident not found" };
  const admin = createAdminSupabase();
  const { error } = await admin
    .from("incidents")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolution_notes: input.notes,
    })
    .eq("id", input.incidentId);
  if (error) return { ok: false, error: error.message };
  await appendEvent({
    incidentId: input.incidentId,
    eventType: "resolved",
    actorLabel: input.actorLabel,
    actorId: input.actorId,
    detail: { notes: input.notes },
  });
  await emit({
    kind: "resolve",
    incidentId: input.incidentId,
    touristId: typeof row.tourist_id === "string" ? row.tourist_id : null,
    status: "resolved",
    severity: String(row.severity),
    type: String(row.type),
    actorLabel: input.actorLabel,
  });
  return { ok: true, status: "resolved" };
}

export async function sendTouristNote(input: {
  incidentId: string;
  body: string;
  actorLabel: string;
  actorId?: string | null;
  presetId?: string;
}): Promise<LifecycleResult> {
  const row = await loadIncidentRow(input.incidentId);
  if (!row) return { ok: false, error: "Incident not found" };
  const touristId = typeof row.tourist_id === "string" ? row.tourist_id : null;
  if (!touristId) return { ok: false, error: "Incident has no tourist" };

  const preset = input.presetId ? commandNotePreset(input.presetId) : undefined;
  const body = (preset?.body ?? input.body).trim();
  if (!body) return { ok: false, error: "Note is empty" };

  try {
    const { dispatchTouristNote } = await import("@/lib/notify/dispatcher");
    const fanout = await dispatchTouristNote({
      incidentId: input.incidentId,
      body,
      actorLabel: input.actorLabel,
    });
    await appendEvent({
      incidentId: input.incidentId,
      eventType: "note",
      actorLabel: input.actorLabel,
      actorId: input.actorId,
      detail: {
        body,
        to: "tourist",
        preset_id: input.presetId ?? null,
        delivered: fanout.delivered,
      },
    });
    notifyLog("notify.note", {
      incident_id: input.incidentId,
      actor: input.actorLabel,
      delivered: fanout.delivered,
    });
    return { ok: true, status: String(row.status), delivered: fanout.delivered };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to send note",
    };
  }
}
