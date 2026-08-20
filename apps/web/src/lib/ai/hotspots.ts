// apps/web/src/lib/ai/hotspots.ts
import "server-only"

import { z } from "zod"
import {
  HOTSPOT_DEFAULT_CATEGORY,
  HOTSPOT_DEFAULT_RISK,
  rulesHotspotRationale,
  type HotspotCluster,
} from "@sts/shared"
import { generateWithFallback } from "@/lib/ai/providers"
import { hotspotZoneSuggestion } from "@/lib/ai/prompts"

const llmSuggestionSchema = z.object({
  proposed_name: z.string().min(4).max(80),
  rationale: z.string().min(20).max(800),
  category: z.enum(["restricted", "high_risk", "forest_reserve", "caution"]),
  risk_level: z.enum(["medium", "high", "critical"]),
})

export type HotspotNarrative = {
  proposedName: string
  rationale: string
  category: z.infer<typeof llmSuggestionSchema>["category"]
  riskLevel: z.infer<typeof llmSuggestionSchema>["risk_level"]
  model: string
  fallbackUsed: boolean
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed)
  const body = fenced?.[1]?.trim() ?? trimmed
  try {
    return JSON.parse(body)
  } catch {
    const start = body.indexOf("{")
    const end = body.lastIndexOf("}")
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(body.slice(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

export async function generateHotspotNarrative(
  cluster: HotspotCluster,
  coveringZoneName: string | null,
  lookbackHours: number,
): Promise<HotspotNarrative> {
  const fallback: HotspotNarrative = {
    proposedName: cluster.proposedName,
    rationale: rulesHotspotRationale(cluster, lookbackHours),
    category:
      cluster.sosCount >= 3 ? "restricted" : HOTSPOT_DEFAULT_CATEGORY,
    riskLevel: cluster.sosCount >= 3 ? "critical" : HOTSPOT_DEFAULT_RISK,
    model: "rules-only",
    fallbackUsed: true,
  }

  try {
    const result = await generateWithFallback({
      purpose: "hotspot_zone_suggestion",
      prompt: hotspotZoneSuggestion({
        unique_tourists: cluster.uniqueTourists,
        incident_count: cluster.incidentCount,
        sos_count: cluster.sosCount,
        type_counts: Object.fromEntries(
          Object.entries(cluster.typeCounts).filter(
            (entry): entry is [string, number] => typeof entry[1] === "number",
          ),
        ),
        lat: cluster.centroid.lat,
        lon: cluster.centroid.lon,
        radius_m: cluster.radiusM,
        address_text: cluster.addressText,
        covering_zone_name: coveringZoneName,
        lookback_hours: lookbackHours,
        first_at: cluster.firstAt,
        last_at: cluster.lastAt,
      }),
      schema: llmSuggestionSchema,
      maxOutputTokens: 400,
    })
    const parsed =
      result.output ??
      (() => {
        const attempt = llmSuggestionSchema.safeParse(extractJsonObject(result.text))
        return attempt.success ? attempt.data : null
      })()
    if (!parsed || result.provider === "rules-only") {
      return { ...fallback, model: result.model || "rules-only" }
    }
    return {
      proposedName: parsed.proposed_name,
      rationale: parsed.rationale,
      category: parsed.category,
      riskLevel: parsed.risk_level,
      model: result.model,
      fallbackUsed: result.fallbackUsed,
    }
  } catch {
    return fallback
  }
}
