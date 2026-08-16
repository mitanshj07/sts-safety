// apps/web/src/lib/ai/prompts.ts
import "server-only"

/**
 * The LLM must never decide whether an alert fires. It only explains and
 * formats decisions already made by Postgres geofence rules (and optional ML
 * scoring). Prompts below are given structured facts; they are instructed
 * never to invent details.
 */

export type IncidentBriefFacts = {
  type: string
  severity: string
  detected_by: string
  zone_name: string | null
  address_text: string | null
  tourist_name: string | null
  nationality: string | null
  occurred_at: string
  elapsed_minutes: number
  lat: number | null
  lon: number | null
  anomaly_score: number | null
  payload: Record<string, unknown>
}

export type EfirFacts = IncidentBriefFacts & {
  tourist_phone: string | null
  kyc_last4: string | null
  entry_point: string | null
  trip_start: string | null
  trip_end: string | null
}

const NO_INVENT =
  "Never invent names, times, coordinates, injuries, witnesses, or motives. If a field is missing, write 'not recorded'. Do not recommend delaying dispatch. The alert has already been raised by the geofencing engine; you only explain it."

export function incidentBrief(facts: IncidentBriefFacts): string {
  const zone = facts.zone_name ?? "an unnamed zone"
  const where = facts.address_text ?? "location not reverse-geocoded"
  return [
    "Write exactly two factual sentences for a tourist-safety control room.",
    `Name the zone (${zone}) and the elapsed time (${facts.elapsed_minutes} minutes since ${facts.occurred_at}).`,
    NO_INVENT,
    "Facts (use only these):",
    JSON.stringify({
      type: facts.type,
      severity: facts.severity,
      detected_by: facts.detected_by,
      zone,
      address: where,
      tourist: facts.tourist_name ?? "not recorded",
      nationality: facts.nationality ?? "not recorded",
      occurred_at: facts.occurred_at,
      elapsed_minutes: facts.elapsed_minutes,
      lat: facts.lat,
      lon: facts.lon,
      anomaly_score: facts.anomaly_score,
      evidence: facts.payload,
    }),
  ].join("\n")
}

export function efirNarrative(facts: EfirFacts): string {
  return [
    "Draft a formal missing-person / tourist-safety E-FIR narrative in the register style of an Indian police station (North-Eastern Region).",
    "Use numbered paragraphs. Past tense. No speculation.",
    "Mark EVERY inferred, derived, or incomplete fact with the exact token [OFFICER TO VERIFY]. Recorded GPS, timestamps, zone names, and incident type from the structured record are facts; anything else is inferred.",
    "The geofencing engine already created this incident. Do not decide whether an alert should fire.",
    NO_INVENT,
    "Structured record:",
    JSON.stringify(facts),
  ].join("\n")
}

export function translateAlert(args: {
  text: string
  locale: string
}): string {
  return [
    `Translate the following tourist-safety alert into locale '${args.locale}'.`,
    "Keep it to two short sentences. Do not add facts. Do not omit the incident type or location if present.",
    "If the locale is English, lightly polish without changing meaning.",
    "Source:",
    args.text,
  ].join("\n")
}

export const NL_SQL_ALLOWED_VIEWS = [
  "v_live_tourists",
  "v_open_incidents",
  "v_zone_risk_ranking",
] as const

export function nlQuery(question: string): string {
  return [
    "Compile the operator question into a single parameterised PostgreSQL SELECT.",
    `You may read ONLY these views: ${NL_SQL_ALLOWED_VIEWS.join(", ")}.`,
    "Return JSON only: {\"sql\":\"SELECT ...\",\"params\":[]} with $1-style placeholders.",
    "No DDL or DML. No CTEs that reference other tables. No function calls other than count, avg, sum, min, max, coalesce, round, now, current_date, extract, date_trunc, lower, upper, length.",
    "Always include LIMIT 50 or tighter. Prefer explicit column lists over SELECT *.",
    "Question:",
    question,
  ].join("\n")
}

export function rulesIncidentBrief(facts: IncidentBriefFacts): string {
  const who = facts.tourist_name ?? "Unidentified tourist"
  const zone = facts.zone_name ?? facts.address_text ?? "unknown location"
  return `${who} — ${facts.type.replaceAll("_", " ")} (${facts.severity}) in ${zone}, ${facts.elapsed_minutes} min elapsed. Detected by ${facts.detected_by}; the geofencing engine already raised this alert.`
}

export function rulesEfirNarrative(facts: EfirFacts): string {
  return [
    "E-FIR DRAFT (rules fallback — not LLM).",
    `1. On ${facts.occurred_at} a ${facts.type.replaceAll("_", " ")} incident of severity ${facts.severity} was recorded against tourist ${facts.tourist_name ?? "[OFFICER TO VERIFY]"} (${facts.nationality ?? "[OFFICER TO VERIFY]"}).`,
    `2. Place of occurrence: ${facts.zone_name ?? "[OFFICER TO VERIFY]"} / ${facts.address_text ?? "[OFFICER TO VERIFY]"} at coordinates ${facts.lat ?? "[OFFICER TO VERIFY]"}, ${facts.lon ?? "[OFFICER TO VERIFY]"}.`,
    `3. Detection source: ${facts.detected_by}. Anomaly score: ${facts.anomaly_score ?? "not recorded"}. Elapsed: ${facts.elapsed_minutes} minutes.`,
    "4. This narrative is generated from the structured record only. [OFFICER TO VERIFY] identity particulars, next of kin, and last-seen clothing.",
    "5. The geofencing engine raised the alert independently of chain, LLM, and ML.",
  ].join("\n")
}
