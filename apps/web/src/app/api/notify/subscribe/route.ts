// apps/web/src/app/api/notify/subscribe/route.ts
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { pushSubscribeSchema } from "@/lib/tourist/schemas";

export async function POST(request: Request): Promise<NextResponse> {
  const json: unknown = await request.json().catch(() => null);
  const parsed = pushSubscribeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid subscription" },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true, stored: false, reason: "supabase_unconfigured" });
  }

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: true, stored: false, reason: "auth_required" });
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      profile_id: auth.user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      user_agent: parsed.data.user_agent ?? null,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, stored: true });
}
