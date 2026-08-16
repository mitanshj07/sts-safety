// apps/web/src/app/api/ai/efir/route.ts
import { z } from "zod"

import { draftEfir } from "@/lib/ai/efir"
import { jsonAuthError, requireRole } from "@/lib/auth/guards"

export const runtime = "nodejs"
export const maxDuration = 60

const bodySchema = z
  .object({
    incident_id: z.string().uuid().optional(),
    incidentId: z.string().uuid().optional(),
  })
  .refine((v) => Boolean(v.incident_id || v.incidentId), {
    message: "incident_id required",
  })

export async function POST(request: Request): Promise<Response> {
  try {
    await requireRole(request, ["admin", "responder"])
  } catch (error) {
    return jsonAuthError(error)
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "validation_failed", details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const incidentId = parsed.data.incident_id ?? parsed.data.incidentId
  if (!incidentId) {
    return Response.json({ ok: false, error: "incident_id required" }, { status: 400 })
  }

  try {
    const result = await draftEfir(incidentId)
    return Response.json(result, { status: 201 })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "efir_failed"
    const status = message === "incident_not_found" ? 404 : 500
    return Response.json({ ok: false, error: message }, { status })
  }
}
