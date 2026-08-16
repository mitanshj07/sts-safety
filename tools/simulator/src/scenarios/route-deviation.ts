// tools/simulator/src/scenarios/route-deviation.ts
import { DEVIATION_OFFSET_M, FIXED_ORIGIN_ISO } from "../constants.ts"
import type { Rng } from "../rng.ts"
import type { SimPlan } from "../types.ts"
import { baseTourist, fillBackground } from "./common.ts"

/** Gradual 3 km drift off the Guwahati→Shillong corridor (corridor is 2 km). */
export function buildRouteDeviation(count: number, rng: Rng): SimPlan {
  const featured = baseTourist(0, rng, {
    routeId: "guwahati_shillong",
    mode: "car",
    featured: true,
    waypoints: [],
    silence: null,
    drift: { startMs: 90 * 1000, endMs: 8 * 60 * 1000, offsetM: DEVIATION_OFFSET_M },
    stationary: null,
    sosAtMs: null,
    haltWhenRestricted: false,
    dropouts: false,
    batteryStart: 86,
  })
  return {
    scenario: "route-deviation",
    tourists: fillBackground([featured], count, rng),
    breachAtMs: null,
    breachZoneName: null,
    originIso: FIXED_ORIGIN_ISO,
  }
}
