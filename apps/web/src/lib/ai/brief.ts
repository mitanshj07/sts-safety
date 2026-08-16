// apps/web/src/lib/ai/brief.ts
import "server-only"

import type { LiveIncident } from "@/lib/command/types"
import { generateWithFallback } from "@/lib/ai/providers"
import {
  efirNarrative,
  incidentBrief,
  rulesEfirNarrative,
  rulesIncidentBrief,
  translateAlert,
  type EfirFacts,
  type IncidentBriefFacts,
} from "@/lib/ai/prompts"

export type NarrativeKind = "brief" | "efir"

export type NarrativeResult = {
  text: string
  model: string
  fallbackUsed: boolean
  latencyMs: number
  inputTokens: number | null
  outputTokens: number | null
}

function elapsedMinutes(occurredAt: string): number {
  const ms = Date.now() - Date.parse(occurredAt)
  if (!Number.isFinite(ms) || ms < 0) return 0
  return Math.max(0, Math.round(ms / 60_000))
}

export function factsFromIncident(incident: LiveIncident): IncidentBriefFacts {
  return {
    type: incident.type,
    severity: incident.severity,
    detected_by: incident.detected_by,
    zone_name: incident.zone_name,
    address_text: incident.address_text,
    tourist_name: incident.tourist_name,
    nationality: incident.nationality,
    occurred_at: incident.occurred_at,
    elapsed_minutes: elapsedMinutes(incident.occurred_at),
    lat: incident.lat,
    lon: incident.lon,
    anomaly_score: incident.anomaly_score,
    payload: incident.payload,
  }
}

export function efirFactsFromIncident(incident: LiveIncident): EfirFacts {
  return {
    ...factsFromIncident(incident),
    tourist_phone: incident.tourist_phone,
    kyc_last4: null,
    entry_point: null,
    trip_start: null,
    trip_end: null,
  }
}

export async function generateIncidentNarrative(
  incident: LiveIncident,
  kind: NarrativeKind,
  timeoutMs?: number,
): Promise<NarrativeResult> {
  const fallbackText =
    kind === "efir"
      ? rulesEfirNarrative(efirFactsFromIncident(incident))
      : rulesIncidentBrief(factsFromIncident(incident))
  const prompt =
    kind === "efir"
      ? efirNarrative(efirFactsFromIncident(incident))
      : incidentBrief(factsFromIncident(incident))

  try {
    const result = await generateWithFallback({
      purpose: kind === "efir" ? "efir_narrative" : "incident_brief",
      prompt,
      timeoutMs,
    })
    if (!result.text || result.provider === "rules-only") {
      return {
        text: fallbackText,
        model: result.model,
        fallbackUsed: true,
        latencyMs: result.latencyMs,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      }
    }
    return {
      text: result.text,
      model: result.model,
      fallbackUsed: result.fallbackUsed,
      latencyMs: result.latencyMs,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    }
  } catch {
    return {
      text: fallbackText,
      model: "rules-only",
      fallbackUsed: true,
      latencyMs: 0,
      inputTokens: null,
      outputTokens: null,
    }
  }
}

export async function translateAlertText(args: {
  text: string
  locale: string
  timeoutMs?: number
}): Promise<NarrativeResult> {
  const locale = args.locale.trim().toLowerCase() || "en"
  if (locale === "en" || locale.startsWith("en-")) {
    return {
      text: args.text,
      model: "passthrough",
      fallbackUsed: false,
      latencyMs: 0,
      inputTokens: null,
      outputTokens: null,
    }
  }
  try {
    const result = await generateWithFallback({
      purpose: "translate_alert",
      prompt: translateAlert({ text: args.text, locale }),
      timeoutMs: args.timeoutMs,
    })
    if (!result.text || result.provider === "rules-only") {
      return {
        text: args.text,
        model: result.model,
        fallbackUsed: true,
        latencyMs: result.latencyMs,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      }
    }
    return {
      text: result.text,
      model: result.model,
      fallbackUsed: result.fallbackUsed,
      latencyMs: result.latencyMs,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    }
  } catch {
    return {
      text: args.text,
      model: "rules-only",
      fallbackUsed: true,
      latencyMs: 0,
      inputTokens: null,
      outputTokens: null,
    }
  }
}
