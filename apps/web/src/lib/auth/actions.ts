// apps/web/src/lib/auth/actions.ts
"use server";

import { ensureCurrentProfile } from "./ensure-profile";
import { AuthError } from "./errors";
import { postAuthPath } from "./post-login";
import { type UserRole } from "./roles";
import { createClient } from "@/lib/supabase/server";

export type CompleteSignInResult =
  | { ok: true; role: UserRole; redirectTo: string }
  | { ok: false; message: string };

export async function completeSignIn(): Promise<CompleteSignInResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const profile = await ensureCurrentProfile();
    return {
      ok: true,
      role: profile.role,
      redirectTo: await postAuthPath({
        role: profile.role,
        profileId: profile.id,
        email: user?.email,
      }),
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
