// apps/web/src/lib/pipeline/dispatch.ts
import "server-only"

import { fetchNearestResponders } from "@/lib/command/queries"
import { appendIncidentEvent } from "@/lib/command/audit"
import { createAdminClient } from "@/lib/supabase/admin"

export type DispatchTriggerResult = {
  responder_ids: string[]
  error: string | null
}

/**
 * Assign nearest on-duty responders. Notification fan-out is Phase 12;
 * this is the safety-path assignment that must still run if LLM/ML/chain are down.
 */
export async function triggerIncidentDispatch(args: {
  incidentId: string
  lat: number | null
  lon: number | null
  status: string
}): Promise<DispatchTriggerResult> {
  if (args.lat === null || args.lon === null) {
    return { responder_ids: [], error: "incident_location_missing" }
  }
  const nearest = await fetchNearestResponders(args.lat, args.lon, args.incidentId)
  const fresh = nearest.filter((r) => !r.already_dispatched)
  if (fresh.length === 0) {
    return { responder_ids: [], error: nearest.length === 0 ? "no_on_duty_responders" : null }
  }

  const admin = createAdminClient()
  const ids: string[] = []
  for (const responder of fresh) {
    const { error } = await admin.from("dispatches").upsert(
      {
        incident_id: args.incidentId,
        responder_id: responder.responder_id,
        status: "sent",
        distance_m: responder.distance_m,
        eta_seconds: responder.eta_seconds,
        sent_at: new Date().toISOString(),
      },
      { onConflict: "incident_id,responder_id" },
    )
    if (!error) {
      ids.push(responder.responder_id)
      await appendIncidentEvent({
        incidentId: args.incidentId,
        eventType: "dispatched",
        actorLabel: "pipeline",
        detail: {
          responder_id: responder.responder_id,
          responder_name: responder.name,
          distance_m: responder.distance_m,
          eta_seconds: responder.eta_seconds,
        },
      })
    }
  }

  if (
    ids.length > 0 &&
    (args.status === "open" || args.status === "acknowledged")
  ) {
    await admin
      .from("incidents")
      .update({ status: "dispatched" })
      .eq("id", args.incidentId)
  }

  return { responder_ids: ids, error: null }
}
