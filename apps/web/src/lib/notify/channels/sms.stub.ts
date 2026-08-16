// apps/web/src/lib/notify/channels/sms.stub.ts
import "server-only";

import { NotConfiguredError } from "@/lib/notify/errors";
import type { ChannelSendInput, ChannelSendResult, INotificationChannel } from "@/lib/notify/types";

/**
 * SMS is the one genuinely paid channel in this stack.
 *
 * Web Push, Telegram, Resend, and Supabase Realtime are all free-tier with no
 * card. Every Indian SMS aggregator (MSG91, Fast2SMS, Kaleyra) bills per
 * transactional SMS — typically ₹0.12–0.25. That is why this file throws
 * NotConfiguredError and is omitted from NOTIFY_CHANNELS by default.
 *
 * To enable SMS later (~40 lines), replace `send` with:
 *
 *   1. Read a provider key from env (do NOT add TWILIO_* — `pnpm check:freetier`
 *      will fail the build). MSG91 uses MSG91_AUTH_KEY if you must.
 *   2. POST https://control.msg91.com/api/v5/flow (or Fast2SMS /sms-v3) with
 *      `recipient.phoneE164`, `input.title`, `input.body`.
 *   3. Zod-parse the JSON; treat HTTP 429/5xx as TransientNotifyError so the
 *      dispatcher retries; treat 401/402 as permanent.
 *   4. Return `{ providerRef: messageId, delivered: true }`.
 *   5. Add `sms` to NOTIFY_CHANNELS. The dispatcher already fans out through
 *      INotificationChannel — no other file has to change.
 *
 * Until then, the tourist PWA `sms:` fallback on the panic button is the
 * offline last resort (device OS composer, zero vendor).
 */
export const smsChannel: INotificationChannel = {
  id: "sms",
  isConfigured(): boolean {
    return false;
  },
  send(_input: ChannelSendInput): Promise<ChannelSendResult> {
    return Promise.reject(
      new NotConfiguredError(
        "sms",
        "SMS is a paid channel; omit from NOTIFY_CHANNELS. See sms.stub.ts.",
      ),
    );
  },
};
