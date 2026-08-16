// tools/simulator/src/scenarios/stationary-anomaly.ts
import { STATIONARY_MS, STATIONARY_ORIGIN_ISO } from "../constants.ts"
import type { Rng } from "../rng.ts"
import type { SimPlan } from "../types.ts"
import { baseTourist, fillBackground } from "./common.ts"

/** Motionless 50 min on NH-6 at 02:00 IST — not an accommodation zone. */
export function buildStationaryAnomaly(count: number, rng: Rng): SimPlan {
  const featured = baseTourist(0, rng, {
    routeId: "guwahati_shillong",
    mode: "car",
    featured: true,
    waypoints: [],
    silence: null,
    drift: null,
    stationary: { startMs: 2 * 60 * 1000, durationMs: STATIONARY_MS, forceHourIst: 2 },
    sosAtMs: null,
    haltWhenRestricted: false,
    dropouts: false,
    batteryStart: 64,
  })
  return {
    scenario: "stationary-anomaly",
    tourists: fillBackground([featured], count, rng),
    breachAtMs: null,
    breachZoneName: null,
    originIso: STATIONARY_ORIGIN_ISO,
  }
}
