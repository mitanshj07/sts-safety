// apps/web/src/lib/auth/roles.ts
import { z } from "zod";

export const USER_ROLES = ["tourist", "responder", "admin", "auditor"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const userRoleSchema = z.enum(USER_ROLES);

export const STAFF_ROLES: readonly UserRole[] = [
  "responder",
  "admin",
  "auditor",
];

export const COMMAND_ROLES: readonly UserRole[] = [
  "admin",
  "responder",
  "auditor",
];

export const TOURIST_PATHS = [
  "/home",
  "/map",
  "/id",
  "/sos",
  "/trip",
  "/alerts",
  "/onboard",
] as const;

export const COMMAND_PATHS = [
  "/dashboard",
  "/incidents",
  "/tourists",
  "/zones",
  "/responders",
  "/verify",
  "/analytics",
] as const;

export const PUBLIC_PATHS = ["/", "/login", "/callback", "/sw.js"] as const;

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

export function parseUserRole(value: unknown): UserRole | null {
  const parsed = userRoleSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function isStaffRole(role: UserRole): boolean {
  return role === "admin" || role === "responder" || role === "auditor";
}

export function isCommandRole(role: UserRole): boolean {
  return COMMAND_ROLES.includes(role);
}

export function homePathForRole(role: UserRole): string {
  return role === "tourist" ? "/home" : "/dashboard";
}

function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isTouristPath(pathname: string): boolean {
  return matchesPrefix(pathname, TOURIST_PATHS);
}

export function isCommandPath(pathname: string): boolean {
  return matchesPrefix(pathname, COMMAND_PATHS);
}

export function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith("/api/")) {
    return true;
  }
  return matchesPrefix(pathname, PUBLIC_PATHS);
}
