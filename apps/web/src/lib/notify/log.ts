// apps/web/src/lib/notify/log.ts
import "server-only";

export function notifyLog(event: string, fields: Record<string, unknown>): void {
  console.info(
    JSON.stringify({
      src: "notify",
      event,
      ts: new Date().toISOString(),
      ...fields,
    }),
  );
}
