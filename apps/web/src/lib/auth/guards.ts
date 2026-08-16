// apps/web/src/lib/auth/guards.ts
import "server-only";

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

import { AuthError } from "@/lib/auth/errors";
import {
  homePathForRole,
  isUserRole,
  type UserRole,
} from "@/lib/auth/roles";
import { ensureProfileForUser } from "@/lib/auth/ensure-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/supabase/database.types";

export { AuthError, type AuthErrorCode } from "@/lib/auth/errors";

export type AuthPrincipal = {
  id: string;
  role: UserRole;
};

export type AuthedContext = {
  user: User;
  profile: ProfileRow;
};

async function loadPrincipal(userId: string): Promise<AuthPrincipal> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new AuthError("profile lookup failed", 500);
  }
  if (!data || typeof data.role !== "string" || !isUserRole(data.role)) {
    throw new AuthError("profile missing", 403);
  }
  return { id: data.id as string, role: data.role };
}

export async function getPrincipal(
  request: Request,
): Promise<AuthPrincipal | null> {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length).trim();
    if (token) {
      const admin = createAdminClient();
      const { data, error } = await admin.auth.getUser(token);
      if (!error && data.user) {
        return loadPrincipal(data.user.id);
      }
    }
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return null;
  }
  return loadPrincipal(data.user.id);
}

export async function requireRole(
  allowed: UserRole | readonly UserRole[],
): Promise<AuthedContext>;
export async function requireRole(
  request: Request,
  allowed: readonly UserRole[],
): Promise<AuthPrincipal>;
export async function requireRole(
  allowedOrRequest: UserRole | readonly UserRole[] | Request,
  allowed?: readonly UserRole[],
): Promise<AuthedContext | AuthPrincipal> {
  if (allowedOrRequest instanceof Request) {
    const roles = allowed ?? [];
    const principal = await getPrincipal(allowedOrRequest);
    if (!principal) {
      throw new AuthError("unauthenticated", 401);
    }
    if (!roles.includes(principal.role)) {
      throw new AuthError("forbidden", 403);
    }
    return principal;
  }

  const allowedList =
    typeof allowedOrRequest === "string" ? [allowedOrRequest] : allowedOrRequest;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AuthError("Authentication required", "unauthenticated", 401);
  }

  const profile = await ensureProfileForUser(user);
  if (!allowedList.includes(profile.role)) {
    throw new AuthError(
      `Role '${profile.role}' cannot access this resource`,
      "forbidden",
      403,
      profile.role,
    );
  }

  return { user, profile };
}

/** RSC helper: same as requireRole(allowed), but redirects instead of throwing. */
export async function requireRolePage(
  allowed: UserRole | readonly UserRole[],
): Promise<AuthedContext> {
  try {
    return await requireRole(allowed);
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.code === "unauthenticated" || error.status === 401) {
        redirect("/login");
      }
      redirect(homePathForRole(error.role ?? "tourist"));
    }
    throw error;
  }
}

export function jsonAuthError(error: unknown): Response {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { ok: false, error: error.message, code: error.code },
      { status: error.status },
    );
  }
  throw error;
}
