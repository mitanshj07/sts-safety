// apps/web/src/lib/notify/channels/realtime.ts
import "server-only";

import { createAdminSupabase } from "@/lib/supabase/admin";
import { NotConfiguredError } from "@/lib/notify/errors";
import type {
  ChannelSendInput,
  ChannelSendResult,
  INotificationChannel,
  IncidentBroadcast,
} from "@/lib/notify/types";
import {
  DASHBOARD_BROADCAST_CHANNEL,
  DASHBOARD_BROADCAST_EVENT,
  touristBroadcastChannel,
} from "@/lib/notify/types";

async function sendOnChannel(
  channelName: string,
  payload: IncidentBroadcast,
): Promise<void> {
  const admin = createAdminSupabase();
  const channel = admin.channel(channelName, {
    config: { broadcast: { ack: false, self: false } },
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => resolve(), 400);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timer);
          resolve();
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timer);
          reject(new Error(`realtime subscribe ${status}`));
        }
      });
    });
    await channel.send({
      type: "broadcast",
      event: DASHBOARD_BROADCAST_EVENT,
      payload,
    });
  } finally {
    await admin.removeChannel(channel);
  }
}

export async function broadcastIncident(payload: IncidentBroadcast): Promise<void> {
  const targets = [DASHBOARD_BROADCAST_CHANNEL];
  if (payload.tourist_id) {
    targets.push(touristBroadcastChannel(payload.tourist_id));
  }
  await Promise.allSettled(targets.map((name) => sendOnChannel(name, payload)));
}

export const realtimeChannel: INotificationChannel = {
  id: "realtime",
  isConfigured(): boolean {
    try {
      createAdminSupabase();
      return true;
    } catch {
      return false;
    }
  },
  async send(input: ChannelSendInput): Promise<ChannelSendResult> {
    if (!this.isConfigured()) {
      throw new NotConfiguredError("realtime");
    }
    const payload: IncidentBroadcast = {
      kind: "alert",
      incident_id: input.incident.id,
      tourist_id: input.incident.touristId,
      status: input.incident.status,
      severity: input.incident.severity,
      type: input.incident.type,
      actor_label: "dispatcher",
      at: new Date().toISOString(),
    };
    if (input.recipient.kind === "tourist" && input.recipient.id) {
      await sendOnChannel(touristBroadcastChannel(input.recipient.id), payload);
    } else {
      await sendOnChannel(DASHBOARD_BROADCAST_CHANNEL, payload);
    }
    return { providerRef: `broadcast:${input.recipient.kind}`, delivered: true };
  },
};
