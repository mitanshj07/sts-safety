// tools/simulator/src/scenarios/signal-loss.ts
import { FIXED_ORIGIN_ISO, SIGNAL_LOSS_MS } from "../constants.ts"
import type { Rng } from "../rng.ts"
import type { SimPlan } from "../types.ts"
import { baseTourist, fillBackground } from "./common.ts"

/** Pings cease for 25 simulated minutes (pg_cron raises signal_lost after 20 min wall). */
export function buildSignalLoss(count: number, rng: Rng): SimPlan {
  const featured = baseTourist(2, rng, {
    routeId: "tezpur_tawang",
    mode: "car",
    featured: true,
    waypoints: [],
    silence: { startMs: 4 * 60 * 1000, durationMs: SIGNAL_LOSS_MS },
    drift: null,
    stationary: null,
    sosAtMs: null,
    haltWhenRestricted: false,
    dropouts: false,
    batteryStart: 80,
  })
  featured.label = "Emma Wilson"
  featured.email = "emma.wilson@demo.sts"
  featured.demoTouristId = "22222222-2222-4222-8222-222222222203"

  return {
    scenario: "signal-loss",
    tourists: fillBackground([featured], count, rng),
    breachAtMs: null,
    breachZoneName: null,
    originIso: FIXED_ORIGIN_ISO,
  }
}
