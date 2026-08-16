// apps/web/src/lib/notify/types.ts
import type {
  IncidentType,
  NotifyChannel,
  RecipientKind,
  SeverityLevel,
} from "@sts/shared";

export const NOTIFY_LOCALES = ["en", "hi", "as", "bn", "ne"] as const;
export type NotifyLocale = (typeof NOTIFY_LOCALES)[number];

export const DASHBOARD_BROADCAST_CHANNEL = "command-centre";
export const DASHBOARD_BROADCAST_EVENT = "incident";

export function touristBroadcastChannel(touristId: string): string {
  return `tourist:${touristId}`;
}

export type NotifyRecipient = {
  kind: RecipientKind;
  id: string | null;
  name: string;
  locale: NotifyLocale;
  profileId: string | null;
  telegramChatId: string | null;
  email: string | null;
  phoneE164: string | null;
};

export type NotifyIncident = {
  id: string;
  touristId: string | null;
  touristName: string | null;
  type: IncidentType;
  severity: SeverityLevel;
  status: string;
  lat: number | null;
  lon: number | null;
  addressText: string | null;
  zoneName: string | null;
  occurredAt: string;
  createdAt: string;
  aiBrief: string | null;
};

export type ChannelSendInput = {
  recipient: NotifyRecipient;
  incident: NotifyIncident;
  title: string;
  body: string;
  locale: NotifyLocale;
};

export type ChannelSendResult = {
  providerRef: string | null;
  delivered: boolean;
};

export interface INotificationChannel {
  readonly id: NotifyChannel;
  isConfigured(): boolean;
  send(input: ChannelSendInput): Promise<ChannelSendResult>;
}

export type BroadcastKind = "alert" | "ack" | "dispatch" | "resolve";

export type IncidentBroadcast = {
  kind: BroadcastKind;
  incident_id: string;
  tourist_id: string | null;
  status: string;
  severity: string;
  type: string;
  actor_label: string;
  at: string;
};
