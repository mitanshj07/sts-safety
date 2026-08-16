// apps/web/src/lib/identity/log.ts
/** Structured logs for identity. Never pass a private key, salt, or KYC number. */
export function identityLog(
  event: string,
  fields: Record<string, string | number | boolean | null>,
): void {
  console.info(JSON.stringify({ src: "identity", event, ...fields }));
}
