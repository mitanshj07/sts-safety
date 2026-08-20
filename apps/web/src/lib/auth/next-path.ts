// apps/web/src/lib/auth/next-path.ts
import { isCommandPath, isTouristPath, type UserRole } from "./roles";

// Auth entry points would bounce the user straight back into the login loop.
const BLOCKED_PREFIXES = ["/login", "/callback", "/api", "/_next"] as const;

export const NEXT_PARAM = "next";

/**
 * Accepts only same-origin paths. Protocol-relative (`//evil.com`) and
 * backslash variants are rejected because browsers treat them as absolute.
 */
export function sanitizeNextPath(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;

  let parsed: URL;
  try {
    parsed = new URL(value, "http://sts.invalid");
  } catch {
    return null;
  }

  const { pathname, search } = parsed;
  const blocked = BLOCKED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (blocked) return null;

  return `${pathname}${search}`;
}

export function pathnameOf(target: string): string {
  const query = target.indexOf("?");
  return query === -1 ? target : target.slice(0, query);
}

/** Drops a destination the role cannot reach, so the guard never ping-pongs. */
export function nextPathForRole(
  value: string | null | undefined,
  role: UserRole,
): string | null {
  const next = sanitizeNextPath(value);
  if (!next) return null;
  const pathname = pathnameOf(next);
  if (role === "tourist" && isCommandPath(pathname)) return null;
  if (role !== "tourist" && isTouristPath(pathname)) return null;
  return next;
}

export function withNextParam(base: string, next: string | null): string {
  if (!next) return base;
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}${NEXT_PARAM}=${encodeURIComponent(next)}`;
}

/**
 * KYC still comes first. After that (or when an ID already exists), honour the
 * page the traveller was trying to open — `/sos`, `/home`, and so on.
 */
export function resolvePostAuthTarget(
  postAuth: string,
  requested: string | null,
): string {
  if (!requested || requested === postAuth) return postAuth;
  if (pathnameOf(postAuth) === "/onboard") {
    return withNextParam(postAuth, requested);
  }
  return requested;
}
