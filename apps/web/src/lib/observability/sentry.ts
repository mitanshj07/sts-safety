// apps/web/src/lib/observability/sentry.ts
// Optional Sentry. No-ops unless NEXT_PUBLIC_SENTRY_DSN is set. No extra SDK.

type SentryDsn = {
  publicKey: string;
  host: string;
  projectId: string;
};

function readDsn(): string {
  return (process.env.NEXT_PUBLIC_SENTRY_DSN ?? "").trim();
}

function parseDsn(dsn: string): SentryDsn | null {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace(/^\//, "").split("/")[0];
    if (!publicKey || !projectId) return null;
    return { publicKey, host: url.host, projectId };
  } catch {
    return null;
  }
}

export function sentryEnabled(): boolean {
  return parseDsn(readDsn()) !== null;
}

function envelopeUrl(parsed: SentryDsn): string {
  return `https://${parsed.host}/api/${parsed.projectId}/envelope/?sentry_key=${encodeURIComponent(parsed.publicKey)}`;
}

export function captureException(
  error: unknown,
  context?: Record<string, string>,
): void {
  const parsed = parseDsn(readDsn());
  if (!parsed) return;

  const err = error instanceof Error ? error : new Error(String(error));
  const eventId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const header = JSON.stringify({
    event_id: eventId,
    sent_at: new Date().toISOString(),
    sdk: { name: "sts.minimal", version: "0.0.0" },
  });
  const item = JSON.stringify({ type: "event" });
  const payload = JSON.stringify({
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: "javascript",
    level: "error",
    exception: {
      values: [
        {
          type: err.name,
          value: err.message,
          stacktrace: err.stack
            ? { frames: err.stack.split("\n").slice(0, 40).map((line) => ({ filename: line.trim() })) }
            : undefined,
        },
      ],
    },
    tags: context ?? {},
    environment: process.env.NODE_ENV ?? "development",
  });

  const body = `${header}\n${item}\n${payload}`;
  const url = envelopeUrl(parsed);
  try {
    void fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/x-sentry-envelope",
      },
      body,
      keepalive: true,
    });
  } catch {
    // Observability must never break the safety path.
  }
}
