// tools/simulator/src/scenarios/panic-sos.ts
import { FIXED_ORIGIN_ISO } from "../constants.ts"
import type { Rng } from "../rng.ts"
import type { SimPlan } from "../types.ts"
import { baseTourist, fillBackground } from "./common.ts"

/** Featured tourist presses SOS mid-corridor. RLS insert as that tourist. */
export function buildPanicSos(count: number, rng: Rng): SimPlan {
  const featured = baseTourist(1, rng, {
    routeId: "shillong_cherrapunji",
    mode: "car",
    featured: true,
    waypoints: [],
    silence: null,
    drift: null,
    stationary: null,
    sosAtMs: 3 * 60 * 1000,
    haltWhenRestricted: false,
    dropouts: false,
    batteryStart: 77,
  })
  featured.label = "Ananya Baruah"
  featured.email = "ananya.baruah@demo.sts"
  featured.demoTouristId = "22222222-2222-4222-8222-222222222202"

  return {
    scenario: "panic-sos",
    tourists: fillBackground([featured], count, rng),
    breachAtMs: null,
    breachZoneName: null,
    originIso: FIXED_ORIGIN_ISO,
  }
}
