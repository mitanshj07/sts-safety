// tools/simulator/src/scenarios/zone-breach.ts
import { FIXED_ORIGIN_ISO, WALK_MPS } from "../constants.ts"
import { firstProgressInside } from "../geo.ts"
import { routeById } from "../routes/index.ts"
import type { Rng } from "../rng.ts"
import type { SimPlan } from "../types.ts"
import { LOCAL_ZONES } from "../zones-local.ts"
import { baseTourist, fillBackground } from "./common.ts"

const CORE = LOCAL_ZONES.find((z) => z.name === "Kaziranga Core Range")

/** THE demo scenario: one tourist walks into Kaziranga core; everyone else stays safe. */
export function buildZoneBreach(count: number, rng: Rng): SimPlan {
  if (!CORE) throw new Error("Kaziranga Core Range missing from local zones")
  const route = routeById("kaziranga_safari")
  const breachM = firstProgressInside(route.profile, CORE.ring, 5)
  if (breachM === null) {
    throw new Error("kaziranga safari polyline never enters the core — fix the GeoJSON")
  }
  const approachM = 900
  const featured = baseTourist(4, rng, {
    routeId: "kaziranga_safari",
    mode: "walk",
    featured: true,
    waypoints: [],
    silence: null,
    drift: null,
    stationary: null,
    sosAtMs: null,
    haltWhenRestricted: true,
    dropouts: false,
    batteryStart: 91,
    startProgressM: Math.max(0, breachM - approachM),
  })
  featured.label = "Kenji Nakamura"
  featured.email = "kenji.nakamura@demo.sts"
  featured.demoTouristId = "22222222-2222-4222-8222-222222222205"

  const tourists = fillBackground([featured], count, rng)

  return {
    scenario: "zone-breach",
    tourists,
    breachAtMs: (Math.min(approachM, breachM) / WALK_MPS) * 1000,
    breachZoneName: CORE.name,
    originIso: FIXED_ORIGIN_ISO,
  }
}
