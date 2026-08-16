// apps/web/src/app/api/notify/telegram-webhook/route.ts
import { timingSafeEqual } from "node:crypto";

import { serverEnv } from "@/lib/env/server";
import {
  answerTelegramCallback,
  editTelegramIncidentMessage,
  telegramActorLabel,
} from "@/lib/notify/channels/telegram";
import { jsonError } from "@/lib/notify/http";
import {
  ackIncident,
  dispatchNearest,
  resolveIncidentLifecycle,
} from "@/lib/notify/lifecycle";
import {
  telegramCallbackDataSchema,
  telegramUpdateSchema,
} from "@/lib/notify/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function secretOk(request: Request): boolean {
  const expected = serverEnv.telegramWebhookSecret;
  const provided = request.headers.get("x-telegram-bot-api-secret-token");
  if (!expected || !provided) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<Response> {
  if (!secretOk(request)) {
    return jsonError("invalid telegram secret", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid json", 400);
  }
  const parsed = telegramUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: true, ignored: true });
  }
  const callback = parsed.data.callback_query;
  if (!callback) {
    return Response.json({ ok: true, ignored: true });
  }

  const dataParsed = telegramCallbackDataSchema.safeParse(callback.data);
  if (!dataParsed.success) {
    await answerTelegramCallback(callback.id, "Unknown action");
    return Response.json({ ok: true, ignored: true });
  }
  const actionChar = dataParsed.data.charAt(0);
  const incidentId = dataParsed.data.slice(2);
  if (actionChar !== "a" && actionChar !== "d" && actionChar !== "r") {
    await answerTelegramCallback(callback.id, "Unknown action");
    return Response.json({ ok: true, ignored: true });
  }
  const action = actionChar;
  const actorLabel = telegramActorLabel(callback.from);

  const result =
    action === "a"
      ? await ackIncident({ incidentId, actorLabel })
      : action === "d"
        ? await dispatchNearest({ incidentId, actorLabel })
        : await resolveIncidentLifecycle({
            incidentId,
            notes: "Resolved from Telegram",
            actorLabel,
          });

  const toast = result.ok
    ? action === "a"
      ? "Acknowledged"
      : action === "d"
        ? "Dispatched nearest units"
        : "Resolved"
    : result.error;

  await answerTelegramCallback(callback.id, toast);

  if (callback.message && result.ok) {
    const original = callback.message.caption ?? callback.message.text ?? "";
    try {
      await editTelegramIncidentMessage({
        chatId: callback.message.chat.id,
        messageId: callback.message.message_id,
        originalText: original,
        incidentId,
        actorLabel,
        action: action === "a" ? "ack" : action === "d" ? "dispatch" : "resolve",
      });
    } catch {
      // Answering the callback is enough; edit is best-effort.
    }
  }

  return Response.json({ ok: result.ok, status: result.ok ? result.status : undefined });
}
