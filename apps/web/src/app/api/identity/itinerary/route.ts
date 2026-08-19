import { saveItineraryRequestSchema } from "@sts/shared";

import { getPrincipal } from "@/lib/auth/guards";
import { saveTouristItinerary } from "@/lib/identity/issuance";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const principal = await getPrincipal(request).catch(() => null);
  if (!principal || principal.role !== "tourist") {
    return Response.json({ ok: false, error: "sign in as a tourist" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const parsed = saveItineraryRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "validation_failed" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: tourist, error } = await admin
    .from("tourists")
    .select("id, trip_start, trip_end")
    .eq("profile_id", principal.id)
    .maybeSingle();
  if (error || !tourist) {
    return Response.json({ ok: false, error: "tourist profile missing" }, { status: 404 });
  }

  const tripStart = parsed.data.tripStart ?? String(tourist.trip_start);
  const tripEnd = parsed.data.tripEnd ?? String(tourist.trip_end);

  try {
    const itineraryId = await saveTouristItinerary(
      String(tourist.id),
      parsed.data,
      tripStart,
      tripEnd,
    );
    return Response.json({ ok: true, itineraryId, touristId: tourist.id });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "itinerary save failed";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
