// apps/web/src/lib/notify/channels/telegram.ts
import "server-only";

import { z } from "zod";

import { serverEnv } from "@/lib/env/server";
import { NotConfiguredError, TransientNotifyError } from "@/lib/notify/errors";
import { ackCopy, dashboardUrl } from "@/lib/notify/templates/messages";
import type {
  ChannelSendInput,
  ChannelSendResult,
  INotificationChannel,
} from "@/lib/notify/types";

const telegramApiResultSchema = z.object({
  ok: z.boolean(),
  description: z.string().optional(),
  result: z
    .object({
      message_id: z.number().optional(),
    })
    .passthrough()
    .optional(),
});

export function escapeMarkdownV2(text: string): string {
  return text.replace(/[\\_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

export function staticMapUrl(lat: number, lon: number): string {
  const center = `${lat.toFixed(5)},${lon.toFixed(5)}`;
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${center}&zoom=14&size=640x360&maptype=mapnik&markers=${center},red-pushpin`;
}

function apiRoot(): string {
  const token = serverEnv.telegramBotToken;
  if (!token) throw new NotConfiguredError("telegram");
  return `https://api.telegram.org/bot${token}`;
}

function inlineKeyboard(incidentId: string): {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
} {
  return {
    inline_keyboard: [
      [
        { text: "Acknowledge", callback_data: `a:${incidentId}` },
        { text: "Dispatch", callback_data: `d:${incidentId}` },
        { text: "Resolve", callback_data: `r:${incidentId}` },
      ],
    ],
  };
}

async function telegramCall(
  method: string,
  body: Record<string, unknown>,
): Promise<{ messageId: number | null }> {
  const response = await fetch(`${apiRoot()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json: unknown = await response.json().catch(() => null);
  const parsed = telegramApiResultSchema.safeParse(json);
  if (!response.ok || !parsed.success || !parsed.data.ok) {
    const description = parsed.success
      ? (parsed.data.description ?? `telegram ${method} failed`)
      : `telegram ${method} HTTP ${response.status}`;
    if (response.status === 429 || response.status >= 500) {
      throw new TransientNotifyError(description, response.status);
    }
    throw new Error(description);
  }
  return { messageId: parsed.data.result?.message_id ?? null };
}

function captionFor(input: ChannelSendInput): string {
  const coords =
    input.incident.lat !== null && input.incident.lon !== null
      ? `${input.incident.lat.toFixed(5)}, ${input.incident.lon.toFixed(5)}`
      : "n/a";
  const where = input.incident.zoneName ?? input.incident.addressText ?? "unlocated";
  const url = escapeMarkdownV2(dashboardUrl(serverEnv.appUrl, input.incident.id));
  const lines = [
    `*${escapeMarkdownV2(input.title)}*`,
    escapeMarkdownV2(input.body),
    "",
    escapeMarkdownV2(`Where: ${where}`),
    escapeMarkdownV2(`Coords: ${coords}`),
    `[${escapeMarkdownV2("Open dashboard")}](${url})`,
  ];
  return lines.join("\n");
}

export const telegramChannel: INotificationChannel = {
  id: "telegram",
  isConfigured(): boolean {
    return serverEnv.telegramBotToken.length > 0;
  },
  async send(input: ChannelSendInput): Promise<ChannelSendResult> {
    if (!this.isConfigured()) throw new NotConfiguredError("telegram");
    const chatId = input.recipient.telegramChatId;
    if (!chatId) {
      return { providerRef: null, delivered: true };
    }
    const caption = captionFor(input);
    const keyboard = inlineKeyboard(input.incident.id);
    const lat = input.incident.lat;
    const lon = input.incident.lon;

    if (lat !== null && lon !== null) {
      try {
        const photo = await telegramCall("sendPhoto", {
          chat_id: chatId,
          photo: staticMapUrl(lat, lon),
          caption,
          parse_mode: "MarkdownV2",
          reply_markup: keyboard,
        });
        if (photo.messageId !== null) {
          return { providerRef: `${chatId}:${photo.messageId}`, delivered: true };
        }
      } catch {
        await telegramCall("sendLocation", {
          chat_id: chatId,
          latitude: lat,
          longitude: lon,
        });
      }
    }

    const text = await telegramCall("sendMessage", {
      chat_id: chatId,
      text: caption,
      parse_mode: "MarkdownV2",
      reply_markup: keyboard,
      disable_web_page_preview: false,
    }).catch(async () =>
      telegramCall("sendMessage", {
        chat_id: chatId,
        text: `${input.title}\n${input.body}`,
        reply_markup: keyboard,
      }),
    );
    return {
      providerRef: text.messageId !== null ? `${chatId}:${text.messageId}` : null,
      delivered: true,
    };
  },
};

export async function answerTelegramCallback(
  callbackQueryId: string,
  text: string,
): Promise<void> {
  await telegramCall("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
  });
}

export async function editTelegramIncidentMessage(input: {
  chatId: number;
  messageId: number;
  originalText: string;
  incidentId: string;
  actorLabel: string;
  action: "ack" | "dispatch" | "resolve";
}): Promise<void> {
  const when = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const suffix = escapeMarkdownV2(ackCopy("en", input.actorLabel, when));
  const actionLine =
    input.action === "ack"
      ? "✅"
      : input.action === "dispatch"
        ? "🚑"
        : "✔️";
  const next = `${input.originalText}\n\n${actionLine} ${suffix}`;
  const markup =
    input.action === "resolve"
      ? { inline_keyboard: [] }
      : inlineKeyboard(input.incidentId);

  try {
    await telegramCall("editMessageCaption", {
      chat_id: input.chatId,
      message_id: input.messageId,
      caption: next,
      parse_mode: "MarkdownV2",
      reply_markup: input.action === "resolve" ? undefined : markup,
    });
  } catch {
    await telegramCall("editMessageText", {
      chat_id: input.chatId,
      message_id: input.messageId,
      text: next,
      parse_mode: "MarkdownV2",
      reply_markup: input.action === "resolve" ? undefined : markup,
    });
  }
}

export function telegramActorLabel(from: {
  username?: string;
  first_name?: string;
}): string {
  if (from.username) return `telegram:@${from.username}`;
  if (from.first_name) return `telegram:${from.first_name}`;
  return "telegram:control-room";
}
