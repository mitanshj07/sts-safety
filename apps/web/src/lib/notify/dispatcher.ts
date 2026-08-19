// apps/web/src/lib/notify/dispatcher.ts
import "server-only";

import type { NotifyChannel, NotifyStatus } from "@sts/shared";
import { COMMAND_NOTE_PROVIDER_REF } from "@sts/shared";

import { createAdminSupabase } from "@/lib/supabase/admin";
import { channelApplies, enabledChannels } from "@/lib/notify/channels";
import { NotConfiguredError } from "@/lib/notify/errors";
import { notifyLog } from "@/lib/notify/log";
import { resolveDispatchContext, resolveTouristRecipient } from "@/lib/notify/recipients";
import { errorMessage, withTransientRetry } from "@/lib/notify/retry";
import {
  commandNoteTitle,
  incidentBody,
  incidentTitle,
  touristAlertUrl,
  touristSosUrl,
} from "@/lib/notify/templates/messages";
import { broadcastIncident } from "@/lib/notify/channels/realtime";
import { serverEnv } from "@/lib/env/server";
import type { ChannelSendInput, NotifyIncident, NotifyRecipient } from "@/lib/notify/types";

export type DispatchFanoutResult = {
  incidentId: string;
  queued: number;
  delivered: number;
  failed: number;
  telegramMs: number | null;
  firstChannelMs: number | null;
};

async function insertQueued(input: {
  incidentId: string;
  recipient: NotifyRecipient;
  channel: NotifyChannel;
  title: string;
  body: string;
  providerRef?: string | null;
}): Promise<number | null> {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("notifications")
    .insert({
      incident_id: input.incidentId,
      recipient_kind: input.recipient.kind,
      recipient_id: input.recipient.id,
      channel: input.channel,
      status: "queued" satisfies NotifyStatus,
      title: input.title,
      body: input.body,
      locale: input.recipient.locale,
      provider_ref: input.providerRef ?? null,
      attempts: 0,
    })
    .select("id")
    .maybeSingle();
  if (error) {
    notifyLog("notify.queue_insert_failed", {
      incident_id: input.incidentId,
      channel: input.channel,
      error: error.message,
    });
    return null;
  }
  return typeof data?.id === "number" ? data.id : null;
}

async function finalizeRow(input: {
  id: number | null;
  status: NotifyStatus;
  providerRef: string | null;
  error: string | null;
  attempts: number;
}): Promise<void> {
  if (input.id === null) return;
  const admin = createAdminSupabase();
  await admin
    .from("notifications")
    .update({
      status: input.status,
      provider_ref: input.providerRef,
      error: input.error,
      attempts: input.attempts,
      delivered_at: input.status === "delivered" || input.status === "sent"
        ? new Date().toISOString()
        : null,
    })
    .eq("id", input.id);
}

async function seedDispatches(
  incidentId: string,
  nearest: Awaited<ReturnType<typeof resolveDispatchContext>>["nearest"],
): Promise<void> {
  if (nearest.length === 0) return;
  const admin = createAdminSupabase();
  await admin.from("dispatches").upsert(
    nearest.map((unit) => ({
      incident_id: incidentId,
      responder_id: unit.responderId,
      status: "sent" as const,
      distance_m: unit.distanceM,
      eta_seconds: unit.etaSeconds,
      sent_at: new Date().toISOString(),
    })),
    { onConflict: "incident_id,responder_id" },
  );
}

async function deliverOne(
  channelId: NotifyChannel,
  send: (input: ChannelSendInput) => Promise<{ providerRef: string | null; delivered: boolean }>,
  isConfigured: () => boolean,
  payload: ChannelSendInput,
): Promise<{ ok: boolean; providerRef: string | null; error: string | null; attempts: number }> {
  const rowId = await insertQueued({
    incidentId: payload.incident.id,
    recipient: payload.recipient,
    channel: channelId,
    title: payload.title,
    body: payload.body,
  });
  if (!isConfigured()) {
    const err = new NotConfiguredError(channelId);
    await finalizeRow({
      id: rowId,
      status: "failed",
      providerRef: null,
      error: err.message,
      attempts: 0,
    });
    return { ok: false, providerRef: null, error: err.message, attempts: 0 };
  }
  try {
    let attempts = 0;
    const result = await withTransientRetry(async () => {
      attempts += 1;
      return send(payload);
    });
    await finalizeRow({
      id: rowId,
      status: result.delivered ? "delivered" : "sent",
      providerRef: result.providerRef,
      error: null,
      attempts,
    });
    return { ok: true, providerRef: result.providerRef, error: null, attempts };
  } catch (error) {
    await finalizeRow({
      id: rowId,
      status: "failed",
      providerRef: null,
      error: errorMessage(error),
      attempts: 3,
    });
    return { ok: false, providerRef: null, error: errorMessage(error), attempts: 3 };
  }
}

export async function dispatchIncidentNotifications(
  incidentId: string,
): Promise<DispatchFanoutResult> {
  const started = Date.now();
  const ctx = await resolveDispatchContext(incidentId);
  await seedDispatches(incidentId, ctx.nearest);

  const channels = enabledChannels();
  const jobs: Array<Promise<{
    channel: NotifyChannel;
    recipientKind: string;
    ok: boolean;
    telegramControlRoom: boolean;
  }>> = [];

  for (const recipient of ctx.recipients) {
    const title = incidentTitle(recipient.locale, ctx.incident.type, ctx.incident.severity);
    const body = incidentBody(recipient.locale, ctx.incident);
    const payload: ChannelSendInput = {
      recipient,
      incident: ctx.incident,
      title,
      body,
      locale: recipient.locale,
    };
    for (const channel of channels) {
      if (!channelApplies(channel.id, recipient)) continue;
      jobs.push(
        deliverOne(channel.id, (input) => channel.send(input), () => channel.isConfigured(), payload).then(
          (result) => ({
            channel: channel.id,
            recipientKind: recipient.kind,
            ok: result.ok,
            telegramControlRoom:
              channel.id === "telegram" && recipient.kind === "authority",
          }),
        ),
      );
    }
  }

  const settled = await Promise.allSettled(jobs);
  let delivered = 0;
  let failed = 0;
  let telegramMs: number | null = null;
  let firstChannelMs: number | null = null;
  for (const item of settled) {
    if (item.status === "rejected") {
      failed += 1;
      continue;
    }
    if (item.value.ok) delivered += 1;
    else failed += 1;
    if (item.value.ok && firstChannelMs === null) {
      const fromInsert = Date.parse(ctx.incident.createdAt);
      firstChannelMs = Number.isFinite(fromInsert)
        ? Date.now() - fromInsert
        : Date.now() - started;
    }
    if (item.value.ok && item.value.telegramControlRoom) {
      const fromInsert = Date.parse(ctx.incident.createdAt);
      telegramMs = Number.isFinite(fromInsert)
        ? Date.now() - fromInsert
        : Date.now() - started;
    }
  }

  if (ctx.incident.type === "sos") {
    notifyLog("notify.sos_to_telegram_ms", {
      incident_id: incidentId,
      ms: telegramMs,
      first_channel_ms: firstChannelMs,
      delivered,
      failed,
      queued: jobs.length,
    });
  } else {
    notifyLog("notify.fanout_done", {
      incident_id: incidentId,
      delivered,
      failed,
      queued: jobs.length,
      first_channel_ms: firstChannelMs,
    });
  }

  return {
    incidentId,
    queued: jobs.length,
    delivered,
    failed,
    telegramMs,
    firstChannelMs,
  };
}

export type TouristNoteFanout = {
  incidentId: string;
  queued: number;
  delivered: number;
  failed: number;
};

export async function dispatchTouristNote(input: {
  incidentId: string;
  body: string;
  actorLabel: string;
}): Promise<TouristNoteFanout> {
  const ctx = await resolveTouristRecipient(input.incidentId);
  if (!ctx) {
    throw new Error("incident has no tourist recipient");
  }

  const title = commandNoteTitle(ctx.recipient.locale);
  const url =
    ctx.incident.type === "sos"
      ? touristSosUrl(serverEnv.appUrl)
      : touristAlertUrl(serverEnv.appUrl);

  const inboxId = await insertQueued({
    incidentId: input.incidentId,
    recipient: ctx.recipient,
    channel: "realtime",
    title,
    body: input.body,
    providerRef: COMMAND_NOTE_PROVIDER_REF,
  });
  if (inboxId === null) {
    throw new Error("failed to queue tourist note");
  }

  try {
    await broadcastIncident({
      kind: "note",
      incident_id: ctx.incident.id,
      tourist_id: ctx.incident.touristId,
      status: ctx.incident.status,
      severity: ctx.incident.severity,
      type: ctx.incident.type,
      actor_label: input.actorLabel,
      at: new Date().toISOString(),
      title,
      body: input.body,
    });
    await finalizeRow({
      id: inboxId,
      status: "delivered",
      providerRef: COMMAND_NOTE_PROVIDER_REF,
      error: null,
      attempts: 1,
    });
  } catch (error) {
    await finalizeRow({
      id: inboxId,
      status: inboxId === null ? "failed" : "sent",
      providerRef: COMMAND_NOTE_PROVIDER_REF,
      error: errorMessage(error),
      attempts: 1,
    });
  }

  const payload: ChannelSendInput = {
    recipient: ctx.recipient,
    incident: ctx.incident,
    title,
    body: input.body,
    locale: ctx.recipient.locale,
    url,
    broadcastKind: "note",
  };

  let delivered = inboxId === null ? 0 : 1;
  let failed = inboxId === null ? 1 : 0;
  let queued = 1;

  for (const channel of enabledChannels()) {
    if (channel.id === "realtime") continue;
    if (channel.id !== "webpush") continue;
    if (!channelApplies(channel.id, ctx.recipient)) continue;
    queued += 1;
    const result = await deliverOne(
      channel.id,
      (sendInput) => channel.send(sendInput),
      () => channel.isConfigured(),
      payload,
    );
    if (result.ok) delivered += 1;
    else failed += 1;
  }

  notifyLog("notify.tourist_note", {
    incident_id: input.incidentId,
    actor: input.actorLabel,
    delivered,
    failed,
    queued,
  });

  return {
    incidentId: input.incidentId,
    queued,
    delivered,
    failed,
  };
}

export type { NotifyIncident };
