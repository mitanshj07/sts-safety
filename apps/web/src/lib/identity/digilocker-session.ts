import "server-only";

import { type NextRequest, type NextResponse } from "next/server";

import { ensureProfileForUser } from "@/lib/auth/ensure-profile";
import { getPrincipal } from "@/lib/auth/guards";
import { createSupabaseOnResponse } from "@/lib/supabase/route";

import { identityLog } from "./log";

export async function ensureTouristSessionAfterDigilocker(args: {
  request: NextRequest;
  response: NextResponse;
  displayName: string;
}): Promise<void> {
  let principal = null;
  try {
    principal = await getPrincipal(args.request);
  } catch {
    principal = null;
  }
  if (principal?.role === "tourist") return;

  const supabase = createSupabaseOnResponse(args.request, args.response);
  if (!supabase) return;

  const name = args.displayName.trim() || "Demo Tourist";
  const { data, error } = await supabase.auth.signInAnonymously({
    options: {
      data: {
        display_name: name,
        role: "tourist",
      },
    },
  });
  if (error || !data.user) {
    identityLog("digilocker_anon_signin_failed", { ok: false });
    return;
  }
  try {
    await ensureProfileForUser(data.user);
  } catch {
    identityLog("digilocker_profile_failed", { ok: false });
  }
}
