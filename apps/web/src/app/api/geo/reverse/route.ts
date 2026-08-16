// apps/web/src/app/api/geo/reverse/route.ts
import { z } from "zod"

import { jsonAuthError, requireRole } from "@/lib/auth/guards"
import { reverseGeocode } from "@/lib/geo/photon"
import { verifyPipelineSecret } from "@/lib/utils/hmac"

export const runtime = "nodejs"
export const maxDuration = 10

const bodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
})

export async function POST(request: Request): Promise<Response> {
  if (!verifyPipelineSecret(request)) {
    try {
      await requireRole(request, ["admin", "responder", "auditor"])
    } catch (error) {
      return jsonAuthError(error)
    }
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

  const result = await reverseGeocode({
    lat: parsed.data.lat,
    lon: parsed.data.lon,
    timeoutMs: 2500,
  })
  if (!result) {
    return Response.json({ ok: false, error: "geocode_unavailable" }, { status: 200 })
  }
  return Response.json({ ok: true, ...result })
}
