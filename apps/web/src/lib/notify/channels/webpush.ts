// apps/web/src/lib/notify/channels/webpush.ts
import "server-only";

import webpush, { WebPushError } from "web-push";

import { z } from "zod";

import { serverEnv } from "@/lib/env/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { NotConfiguredError, TransientNotifyError } from "@/lib/notify/errors";
import { touristAlertUrl } from "@/lib/notify/templates/messages";

import type {
  ChannelSendInput,
  ChannelSendResult,
  INotificationChannel,
} from "@/lib/notify/types";

const subscriptionRowSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});

function vapidReady(): boolean {
  return (
    serverEnv.vapidPublicKey.length > 0 &&
    serverEnv.vapidPrivateKey.length > 0 &&
    serverEnv.vapidSubject.length > 0
  );
}

function configureVapid(): void {
  if (!vapidReady()) {
    throw new NotConfiguredError("webpush");
  }
  webpush.setVapidDetails(
    serverEnv.vapidSubject,
    serverEnv.vapidPublicKey,
    serverEnv.vapidPrivateKey,
  );
}

async function pruneEndpoint(endpoint: string): Promise<void> {
  const admin = createAdminSupabase();
  await admin.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

export const webpushChannel: INotificationChannel = {
  id: "webpush",
  isConfigured(): boolean {
    return vapidReady();
  },
  async send(input: ChannelSendInput): Promise<ChannelSendResult> {
    configureVapid();
    const profileId = input.recipient.profileId;
    if (!profileId) {
      return { providerRef: null, delivered: true };
    }
    const admin = createAdminSupabase();
    const { data, error } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("profile_id", profileId);
    if (error) {
      throw new TransientNotifyError(error.message);
    }
    const rows = z.array(subscriptionRowSchema).parse(data ?? []);
    if (rows.length === 0) {
      return { providerRef: "no-subscription", delivered: true };
    }

    const fallbackUrl =
      input.recipient.kind === "tourist"
        ? touristAlertUrl(serverEnv.appUrl)
        : `${serverEnv.appUrl.replace(/\/$/, "")}/dashboard`;
    const payload = JSON.stringify({
      title: input.title,
      body: input.body,
      url: input.url ?? fallbackUrl,
    });

    let sent = 0;
    let lastRef: string | null = null;
    for (const row of rows) {
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          payload,
          { TTL: 120, urgency: "high" },
        );
        sent += 1;
        lastRef = row.endpoint.slice(-24);
      } catch (cause) {
        if (cause instanceof WebPushError) {
          if (cause.statusCode === 404 || cause.statusCode === 410) {
            await pruneEndpoint(row.endpoint);
            continue;
          }
          if (cause.statusCode === 429 || cause.statusCode >= 500) {
            throw new TransientNotifyError(cause.message, cause.statusCode);
          }
        }
        throw cause;
      }
    }
    return { providerRef: lastRef, delivered: sent > 0 || rows.length === 0 };
  },
};
