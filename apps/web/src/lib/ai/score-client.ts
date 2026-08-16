// apps/web/src/lib/ai/score-client.ts
import "server-only"

import { z } from "zod"

import { computeSafetyScore } from "@sts/shared"

import { isHfSpaceConfigured, serverEnv } from "@/lib/env/server"
import {
  extractFeatures,
  safetyScoreFromWindow,
  type ScoreItinerary,
  type ScorePing,
  type ScoreZone,
} from "@/lib/ai/features"
import { scoreWithOnnx } from "@/lib/ai/onnx-local"

/** Scoring never decides whether an incident exists — Postgres already inserted it. */

export type ScoreSource = "hf-space" | "onnx-local" | "rules-only"

export type ScoreClientResult = {
  anomaly_score: number
  safety_score: number
  source: ScoreSource
  features: number[] | null
  error: string | null
}

const hfResponseSchema = z.object({
  anomaly_score: z.number().min(0).max(1),
  is_anomaly: z.boolean().optional(),
  safety_score: z.number().int().min(0).max(100).optional(),
  features: z.array(z.number()).optional(),
  model_version: z.string().optional(),
})

const pingOutSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  recorded_at: z.string(),
  speed_mps: z.number().nullable(),
  heading_deg: z.number().nullable(),
  battery_pct: z.number().int().nullable(),
  accuracy_m: z.number().nullable(),
})

function rulesOnlyScore(args: {
  pings: ScorePing[]
  itinerary: ScoreItinerary | null
  zones: ScoreZone[]
  openHighIncidents: number
}): ScoreClientResult {
  const window = extractFeatures(args.pings, args.itinerary, args.zones)
  const last = args.pings[args.pings.length - 1] ?? null
  const anomaly = 0
  const safety = last
    ? safetyScoreFromWindow({
        window,
        zones: args.zones,
        lastPing: last,
        openHighIncidents: args.openHighIncidents,
        anomalyScore: anomaly,
        itinerary: args.itinerary,
      })
    : computeSafetyScore({
        risk: null,
        deviationM: null,
        silenceMinutes: null,
        openHighIncidents: args.openHighIncidents,
        anomalyScore: anomaly,
        at: new Date().toISOString(),
        inAccommodation: false,
      })
  return {
    anomaly_score: anomaly,
    safety_score: safety,
    source: "rules-only",
    features: window.vector,
    error: null,
  }
}

async function scoreHf(args: {
  pings: ScorePing[]
  itinerary: ScoreItinerary | null
  zones: ScoreZone[]
  openHighIncidents: number
  timeoutMs: number
}): Promise<ScoreClientResult> {
  if (!isHfSpaceConfigured()) {
    throw new Error("hf_space_unconfigured")
  }
  const parsedPings = z.array(pingOutSchema).min(1).parse(args.pings)
  const body = {
    pings: parsedPings,
    itinerary: args.itinerary,
    zones: args.zones.map((z) => ({
      name: z.name,
      category: z.category,
      risk_level: z.risk_level,
      geom: z.geom,
    })),
    open_high_incidents: args.openHighIncidents,
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (serverEnv.hfSpaceToken) {
    headers.Authorization = `Bearer ${serverEnv.hfSpaceToken}`
  }
  const url = new URL("/score", serverEnv.hfSpaceUrl.replace(/\/$/, "") + "/")
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(Math.max(200, args.timeoutMs)),
  })
  if (res.status >= 500 || res.status === 408 || res.status === 429) {
    throw new Error(`hf_space_${res.status}`)
  }
  if (!res.ok) {
    throw new Error(`hf_space_${res.status}`)
  }
  const json: unknown = await res.json()
  const parsed = hfResponseSchema.parse(json)
  return {
    anomaly_score: parsed.anomaly_score,
    safety_score: parsed.safety_score ?? Math.round((1 - parsed.anomaly_score) * 100),
    source: "hf-space",
    features: parsed.features ?? null,
    error: null,
  }
}

export async function scoreIncidentWindow(args: {
  pings: ScorePing[]
  itinerary: ScoreItinerary | null
  zones: ScoreZone[]
  openHighIncidents: number
  timeoutMs: number
}): Promise<ScoreClientResult> {
  const mode = serverEnv.aiMode
  if (mode === "rules-only") {
    return rulesOnlyScore(args)
  }

  const tryOnnx = async (): Promise<ScoreClientResult> => {
    const onnx = await scoreWithOnnx(args)
    return {
      anomaly_score: onnx.anomaly_score,
      safety_score: onnx.safety_score,
      source: "onnx-local",
      features: onnx.features,
      error: null,
    }
  }

  if (mode === "onnx-local") {
    try {
      return await tryOnnx()
    } catch (cause) {
      const fallback = rulesOnlyScore(args)
      return {
        ...fallback,
        error: cause instanceof Error ? cause.message : "onnx_failed",
      }
    }
  }

  if (args.pings.length > 0 && args.timeoutMs >= 400) {
    try {
      return await scoreHf(args)
    } catch (hfError) {
      try {
        const onnx = await tryOnnx()
        return {
          ...onnx,
          error: hfError instanceof Error ? hfError.message : "hf_failed",
        }
      } catch (onnxError) {
        const fallback = rulesOnlyScore(args)
        return {
          ...fallback,
          error: [
            hfError instanceof Error ? hfError.message : "hf_failed",
            onnxError instanceof Error ? onnxError.message : "onnx_failed",
          ].join("; "),
        }
      }
    }
  }

  try {
    return await tryOnnx()
  } catch (cause) {
    const fallback = rulesOnlyScore(args)
    return {
      ...fallback,
      error: cause instanceof Error ? cause.message : "onnx_failed",
    }
  }
}
