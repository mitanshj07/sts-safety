// tools/simulator/src/types.ts
import { z } from "zod"
import type { LonLat } from "@sts/shared"

export type RouteId =
  | "guwahati_shillong"
  | "shillong_cherrapunji"
  | "tezpur_tawang"
  | "kaziranga_safari"
  | "dzukou_trek"
  | "imphal_loktak"

export const scenarioNameSchema = z.enum([
  "normal-trek",
  "zone-breach",
  "signal-loss",
  "route-deviation",
  "panic-sos",
  "stationary-anomaly",
])
export type ScenarioName = z.infer<typeof scenarioNameSchema>

export const travelModeSchema = z.enum(["walk", "car", "trek"])
export type TravelMode = z.infer<typeof travelModeSchema>

export type WaypointPlan = {
  name: string
  lat: number
  lon: number
  dwellMinutes: number
}

export type TouristPlan = {
  slot: number
  label: string
  email: string
  password: string
  demoTouristId: string | null
  routeId: RouteId
  mode: TravelMode
  featured: boolean
  waypoints: WaypointPlan[]
  /** Skip emit for this many sim-ms, starting at startMs. */
  silence: { startMs: number; durationMs: number } | null
  /** Linear perpendicular drift, metres. */
  drift: { startMs: number; endMs: number; offsetM: number } | null
  /** Freeze on the highway. forceHourIst pins recorded_at into that hour. */
  stationary: { startMs: number; durationMs: number; forceHourIst: number | null } | null
  sosAtMs: number | null
  haltWhenRestricted: boolean
  dropouts: boolean
  batteryStart: number
  startProgressM: number
}

export type SimPlan = {
  scenario: ScenarioName
  tourists: TouristPlan[]
  /** Sim-ms from origin when the featured tourist crosses the restricted ring. */
  breachAtMs: number | null
  breachZoneName: string | null
  originIso: string
}

export type PingSample = {
  touristSlot: number
  simMs: number
  recordedAtIso: string
  lat: number
  lon: number
  accuracyM: number
  speedMps: number
  headingDeg: number
  batteryPct: number
  silent: boolean
}

export type SosSample = {
  touristSlot: number
  simMs: number
  recordedAtIso: string
  lat: number
  lon: number
}

export type AgentSnapshot = {
  slot: number
  label: string
  email: string
  featured: boolean
  lat: number
  lon: number
  headingDeg: number
  speedMps: number
  batteryPct: number
  progressM: number
  routeLengthM: number
  zoneName: string
  zoneCategory: string
  score: number
  silent: boolean
  sosFired: boolean
  insideIncidentZone: boolean
}

export type StepResult = {
  simMs: number
  pings: PingSample[]
  sos: SosSample[]
  snapshots: AgentSnapshot[]
  countdownSec: number | null
  countdownLabel: string | null
}

export type RecordingEvent =
  | { kind: "ping"; ping: PingSample }
  | { kind: "sos"; sos: SosSample }

export const recordingSchema = z.object({
  version: z.literal(1),
  seed: z.number().int(),
  scenario: scenarioNameSchema,
  speed: z.number().positive(),
  tickMs: z.number().int().positive(),
  originIso: z.string(),
  tourists: z.array(
    z.object({
      slot: z.number().int(),
      label: z.string(),
      email: z.string(),
      routeId: z.string(),
    }),
  ),
  events: z.array(
    z.discriminatedUnion("kind", [
      z.object({
        kind: z.literal("ping"),
        ping: z.object({
          touristSlot: z.number().int(),
          simMs: z.number(),
          recordedAtIso: z.string(),
          lat: z.number(),
          lon: z.number(),
          accuracyM: z.number(),
          speedMps: z.number(),
          headingDeg: z.number(),
          batteryPct: z.number().int(),
          silent: z.boolean(),
        }),
      }),
      z.object({
        kind: z.literal("sos"),
        sos: z.object({
          touristSlot: z.number().int(),
          simMs: z.number(),
          recordedAtIso: z.string(),
          lat: z.number(),
          lon: z.number(),
        }),
      }),
    ]),
  ),
})
export type Recording = z.infer<typeof recordingSchema>

export type BoundTourist = {
  slot: number
  label: string
  email: string
  touristId: string
  accessToken: string
  featured: boolean
}

export type LonLatPoint = LonLat
