// apps/web/src/lib/auth/actions.ts
"use server";

import { ensureCurrentProfile } from "./ensure-profile";
import { AuthError } from "./errors";
import { homePathForRole, type UserRole } from "./roles";

export type CompleteSignInResult =
  | { ok: true; role: UserRole; redirectTo: string }
  | { ok: false; message: string };

export async function completeSignIn(): Promise<CompleteSignInResult> {
  try {
    const profile = await ensureCurrentProfile();
    return {
      ok: true,
      role: profile.role,
      redirectTo: homePathForRole(profile.role),
    };
  } catch (error) {
    const message =
      error instanceof AuthError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Could not finish sign-in";
    return { ok: false, message };
  }
}
