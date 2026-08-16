// apps/web/src/lib/notify/channels.ts
import "server-only";

import { notifyChannelSchema, type NotifyChannel } from "@sts/shared";

import { emailChannel } from "@/lib/notify/channels/email";
import { realtimeChannel } from "@/lib/notify/channels/realtime";
import { smsChannel } from "@/lib/notify/channels/sms.stub";
import { telegramChannel } from "@/lib/notify/channels/telegram";
import { webpushChannel } from "@/lib/notify/channels/webpush";
import { serverEnv } from "@/lib/env/server";
import type { INotificationChannel, NotifyRecipient } from "@/lib/notify/types";

const REGISTRY: Record<NotifyChannel, INotificationChannel> = {
  realtime: realtimeChannel,
  webpush: webpushChannel,
  telegram: telegramChannel,
  email: emailChannel,
  sms: smsChannel,
};

export function parseNotifyChannels(raw: string): NotifyChannel[] {
  const seen = new Set<NotifyChannel>();
  for (const part of raw.split(",")) {
    const parsed = notifyChannelSchema.safeParse(part.trim());
    if (parsed.success) seen.add(parsed.data);
  }
  if (seen.size === 0) seen.add("realtime");
  return [...seen];
}

export function enabledChannels(): INotificationChannel[] {
  return parseNotifyChannels(serverEnv.notifyChannels).map(
    (id) => REGISTRY[id],
  );
}

export function channelApplies(
  channel: NotifyChannel,
  recipient: NotifyRecipient,
): boolean {
  switch (channel) {
    case "realtime":
      return recipient.kind === "tourist" || recipient.kind === "authority";
    case "webpush":
      return recipient.profileId !== null;
    case "telegram":
      return Boolean(recipient.telegramChatId);
    case "email":
      return Boolean(recipient.email);
    case "sms":
      return Boolean(recipient.phoneE164);
  }
}
