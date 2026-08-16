// apps/web/src/lib/notify/errors.ts
import "server-only";

export class NotConfiguredError extends Error {
  readonly channel: string;

  constructor(channel: string, detail?: string) {
    super(detail ?? `${channel} is not configured`);
    this.name = "NotConfiguredError";
    this.channel = channel;
  }
}

export class TransientNotifyError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "TransientNotifyError";
    this.status = status;
  }
}

export function isTransientNotifyError(error: unknown): boolean {
  if (error instanceof NotConfiguredError) return false;
  if (error instanceof TransientNotifyError) return true;
  if (!(error instanceof Error)) return true;
  const message = error.message.toLowerCase();
  if (message.includes("not configured")) return false;
  if (/\b(401|403|400|404|410)\b/.test(message)) return false;
  if (
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("fetch failed") ||
    message.includes("socket") ||
    message.includes("429") ||
    message.includes("503") ||
    message.includes("502") ||
    message.includes("504")
  ) {
    return true;
  }
  const status = (error as { statusCode?: unknown }).statusCode;
  if (typeof status === "number") {
    return status === 429 || status >= 500;
  }
  return true;
}
