// apps/web/src/lib/command/audit.ts
import "server-only"
import { createAdminSupabase } from "@/lib/supabase/admin"
import { createServerSupabase } from "@/lib/supabase/server"

export async function writeAudit(input: {
  action: string
  entity: string
  entityId: string
  before?: unknown
  after?: unknown
}): Promise<void> {
  const admin = createAdminSupabase()
  let actorId: string | null = null
  try {
    const supabase = await createServerSupabase()
    if (supabase) {
      const { data } = await supabase.auth.getUser()
      actorId = data.user?.id ?? null
    }
  } catch {
    actorId = null
  }
  await admin.from("audit_log").insert({
    actor_id: actorId,
    actor_role: "admin",
    action: input.action,
    entity: input.entity,
    entity_id: input.entityId,
    before: input.before ?? null,
    after: input.after ?? null,
  })
}

export async function appendIncidentEvent(input: {
  incidentId: string
  eventType: string
  detail?: Record<string, unknown>
  actorLabel?: string
}): Promise<void> {
  const admin = createAdminSupabase()
  await admin.from("incident_events").insert({
    incident_id: input.incidentId,
    event_type: input.eventType,
    actor_label: input.actorLabel ?? "command-dashboard",
    detail: input.detail ?? {},
  })
}
