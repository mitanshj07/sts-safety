// apps/web/src/app/api/ai/score/route.ts
import { z } from "zod"

import { scoreIncidentWindow } from "@/lib/ai/score-client"
import { jsonAuthError, requireRole } from "@/lib/auth/guards"
import { verifyPipelineSecret } from "@/lib/utils/hmac"

export const runtime = "nodejs"
export const maxDuration = 15

const pingSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  recorded_at: z.string().min(1),
  speed_mps: z.number().nullable().optional(),
  heading_deg: z.number().nullable().optional(),
  battery_pct: z.number().int().min(0).max(100).nullable().optional(),
  accuracy_m: z.number().nullable().optional(),
})

const bodySchema = z.object({
  pings: z.array(pingSchema).min(1).max(4000),
  itinerary: z
    .object({
      coordinates: z.array(z.tuple([z.number(), z.number()])),
      corridor_m: z.number().positive().default(2000),
      waypoints: z
        .array(
          z.object({
            name: z.string().default("waypoint"),
            lat: z.number(),
            lon: z.number(),
          }),
        )
        .default([]),
    })
    .nullable()
    .optional(),
  zones: z
    .array(
      z.object({
        name: z.string(),
        category: z.string(),
        risk_level: z.enum(["none", "low", "medium", "high", "critical"]),
        geom: z.array(z.array(z.tuple([z.number(), z.number()]))).nullable(),
      }),
    )
    .default([]),
  open_high_incidents: z.number().int().min(0).default(0),
})

export async function POST(request: Request): Promise<Response> {
  if (!verifyPipelineSecret(request)) {
    try {
      await requireRole(request, ["admin", "responder"])
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

  const result = await scoreIncidentWindow({
    pings: parsed.data.pings.map((p) => ({
      lat: p.lat,
      lon: p.lon,
      recorded_at: p.recorded_at,
      speed_mps: p.speed_mps ?? null,
      heading_deg: p.heading_deg ?? null,
      battery_pct: p.battery_pct ?? null,
      accuracy_m: p.accuracy_m ?? null,
    })),
    itinerary: parsed.data.itinerary ?? null,
    zones: parsed.data.zones,
    openHighIncidents: parsed.data.open_high_incidents,
    timeoutMs: 8000,
  })

  return Response.json({ ok: true, ...result })
}
