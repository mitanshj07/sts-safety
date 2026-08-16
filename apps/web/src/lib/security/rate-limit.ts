// apps/web/src/lib/security/rate-limit.ts
// In-memory token bucket. Fine at demo scale (one Vercel instance / one laptop).

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
};

type Bucket = {
  tokens: number;
  updatedAt: number;
};

const buckets = new Map<string, Bucket>();

const DEFAULT_CAPACITY = 60;
const DEFAULT_REFILL_PER_SEC = 1;

function prune(now: number): void {
  if (buckets.size < 2_000) return;
  for (const [key, bucket] of buckets) {
    if (now - bucket.updatedAt > 10 * 60_000) buckets.delete(key);
  }
}

export function rateLimit(input: {
  key: string;
  capacity?: number;
  refillPerSec?: number;
  cost?: number;
}): RateLimitResult {
  const capacity = input.capacity ?? DEFAULT_CAPACITY;
  const refillPerSec = input.refillPerSec ?? DEFAULT_REFILL_PER_SEC;
  const cost = input.cost ?? 1;
  const now = Date.now();
  prune(now);

  const existing = buckets.get(input.key);
  const bucket: Bucket = existing ?? { tokens: capacity, updatedAt: now };
  const elapsedSec = Math.max(0, (now - bucket.updatedAt) / 1000);
  bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSec * refillPerSec);
  bucket.updatedAt = now;

  if (bucket.tokens < cost) {
    buckets.set(input.key, bucket);
    const retryAfterSec = Math.ceil((cost - bucket.tokens) / refillPerSec);
    return { ok: false, remaining: 0, retryAfterSec };
  }

  bucket.tokens -= cost;
  buckets.set(input.key, bucket);
  return { ok: true, remaining: Math.floor(bucket.tokens), retryAfterSec: 0 };
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  return ip;
}

export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(JSON.stringify({ ok: false, error: "rate_limited" }), {
    status: 429,
    headers: {
      "content-type": "application/json",
      "retry-after": String(result.retryAfterSec),
      "x-ratelimit-remaining": String(result.remaining),
    },
  });
}

export function isPublicApiPath(pathname: string): boolean {
  if (!pathname.startsWith("/api/")) return false;
  return (
    pathname === "/api/health" ||
    pathname.startsWith("/api/identity/") ||
    pathname.startsWith("/api/notify/telegram-webhook") ||
    pathname.startsWith("/api/notify/subscribe") ||
    pathname.startsWith("/api/pipeline/") ||
    pathname.startsWith("/api/chain/")
  );
}
