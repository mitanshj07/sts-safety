// tools/simulator/src/scenarios/normal-trek.ts
import { FIXED_ORIGIN_ISO } from "../constants.ts"
import { firstProgressInside } from "../geo.ts"
import { routeById } from "../routes/index.ts"
import type { Rng } from "../rng.ts"
import type { SimPlan } from "../types.ts"
import { LOCAL_ZONES, INCIDENT_ZONE_CATEGORIES } from "../zones-local.ts"
import { baseTourist, fillBackground, waypoint } from "./common.ts"

/**
 * All tourists stay on caution/safe corridors. No restricted / high_risk / border
 * entry — the false-positive test judges run.
 */
export function buildNormalTrek(count: number, rng: Rng): SimPlan {
  const featured = baseTourist(0, rng, {
    routeId: "shillong_cherrapunji",
    mode: "trek",
    featured: true,
    waypoints: [
      waypoint("Shillong", 91.893, 25.5788, 0.4),
      waypoint("Sohra", 91.6963, 25.3009, 0.5),
    ],
    silence: null,
    drift: null,
    stationary: null,
    sosAtMs: null,
    haltWhenRestricted: false,
    dropouts: true,
    batteryStart: 88,
  })
  const tourists = fillBackground([featured], count, rng).map((t, i) =>
    i === 0
      ? t
      : {
          ...t,
          routeId: t.routeId === "kaziranga_safari" || t.routeId === "dzukou_trek"
            ? "guwahati_shillong"
            : t.routeId,
          haltWhenRestricted: false,
        },
  )

  for (const t of tourists) {
    const route = routeById(t.routeId)
    for (const zone of LOCAL_ZONES) {
      if (!INCIDENT_ZONE_CATEGORIES.has(zone.category)) continue
      const hit = firstProgressInside(route.profile, zone.ring)
      if (hit !== null) {
        throw new Error(`normal-trek route ${t.routeId} intersects ${zone.name} at ${hit} m`)
      }
    }
  }

  return {
    scenario: "normal-trek",
    tourists,
    breachAtMs: null,
    breachZoneName: null,
    originIso: FIXED_ORIGIN_ISO,
  }
}
