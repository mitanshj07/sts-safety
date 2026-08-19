// apps/web/src/lib/auth/public-session.ts
import { createGuestLogin } from "@/lib/auth/actions";
import { getBrowserSupabase } from "@/lib/supabase/client";

export type PublicSessionResult =
  | { ok: true; supabase: NonNullable<ReturnType<typeof getBrowserSupabase>> }
  | { ok: false; message: string };

/**
 * Public tourist session for the KYC and skip paths.
 * Tries anonymous auth first; production disables it, so fall back to a
 * one-shot `guest.{uuid}@demo.sts` password login.
 */
export async function ensurePublicTouristSession(
  displayName: string,
): Promise<PublicSessionResult> {
  const supabase = getBrowserSupabase();
  if (!supabase) {
    return {
      ok: false,
      message:
        "This public deploy shows the product UI. Demo logins need the seeded Supabase project (local or cloud).",
    };
  }

  const { data, error: anonError } = await supabase.auth.signInAnonymously({
    options: {
      data: {
        display_name: displayName,
        role: "tourist",
      },
    },
  });
  if (!anonError && data.user) {
    return { ok: true, supabase };
  }

  const guest = await createGuestLogin();
  if (!guest.ok) {
    return { ok: false, message: guest.message };
  }
  const { error: passwordError } = await supabase.auth.signInWithPassword({
    email: guest.email,
    password: guest.password,
  });
  if (passwordError) {
    return { ok: false, message: passwordError.message };
  }
  return { ok: true, supabase };
}
