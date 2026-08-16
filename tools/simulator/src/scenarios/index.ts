// tools/simulator/src/scenarios/index.ts
import type { Rng } from "../rng.ts"
import type { ScenarioName, SimPlan } from "../types.ts"
import { buildNormalTrek } from "./normal-trek.ts"
import { buildPanicSos } from "./panic-sos.ts"
import { buildRouteDeviation } from "./route-deviation.ts"
import { buildSignalLoss } from "./signal-loss.ts"
import { buildStationaryAnomaly } from "./stationary-anomaly.ts"
import { buildZoneBreach } from "./zone-breach.ts"

export type ScenarioBuilder = (count: number, rng: Rng) => SimPlan

export const SCENARIOS: Record<ScenarioName, ScenarioBuilder> = {
  "normal-trek": buildNormalTrek,
  "zone-breach": buildZoneBreach,
  "signal-loss": buildSignalLoss,
  "route-deviation": buildRouteDeviation,
  "panic-sos": buildPanicSos,
  "stationary-anomaly": buildStationaryAnomaly,
}

export function buildPlan(name: ScenarioName, count: number, rng: Rng): SimPlan {
  return SCENARIOS[name](count, rng)
}
