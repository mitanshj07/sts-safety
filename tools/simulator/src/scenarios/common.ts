// tools/simulator/src/scenarios/common.ts
import { DEMO_PASSWORD, DEMO_TOURISTS } from "../constants.ts"
import { SAFE_ROUTE_IDS } from "../routes/index.ts"
import type { Rng } from "../rng.ts"
import type { RouteId, TouristPlan, TravelMode, WaypointPlan } from "../types.ts"

export function emailForSlot(slot: number): string {
  const demo = DEMO_TOURISTS[slot]
  if (demo) return demo.email
  return `sim${String(slot + 1).padStart(2, "0")}@demo.sts`
}

export function labelForSlot(slot: number, rng: Rng): string {
  const demo = DEMO_TOURISTS[slot]
  if (demo) return demo.label
  const given = rng.pick(["Arjun", "Meera", "Sofia", "Hiro", "Lhamo", "Ravi", "Nina", "Owen"])
  const family = rng.pick(["Das", "Rao", "Chen", "Okada", "Bhutia", "Karki", "Fernandes"])
  return `${given} ${family} ${slot + 1}`
}

export function demoIdForSlot(slot: number): string | null {
  return DEMO_TOURISTS[slot]?.touristId ?? null
}

export function baseTourist(
  slot: number,
  rng: Rng,
  partial: Omit<
    TouristPlan,
    "slot" | "label" | "email" | "password" | "demoTouristId" | "batteryStart" | "startProgressM"
  > & {
    batteryStart?: number
    startProgressM?: number
  },
): TouristPlan {
  const slotRng = rng.fork(slot + 1)
  return {
    slot,
    label: labelForSlot(slot, slotRng),
    email: emailForSlot(slot),
    password: DEMO_PASSWORD,
    demoTouristId: demoIdForSlot(slot),
    batteryStart: partial.batteryStart ?? slotRng.int(72, 98),
    routeId: partial.routeId,
    mode: partial.mode,
    featured: partial.featured,
    waypoints: partial.waypoints,
    silence: partial.silence,
    drift: partial.drift,
    stationary: partial.stationary,
    sosAtMs: partial.sosAtMs,
    haltWhenRestricted: partial.haltWhenRestricted,
    dropouts: partial.dropouts,
    startProgressM: partial.startProgressM ?? 0,
  }
}

export function safeBackground(
  slot: number,
  rng: Rng,
  extras?: Partial<TouristPlan>,
): TouristPlan {
  const routeId: RouteId = SAFE_ROUTE_IDS[slot % SAFE_ROUTE_IDS.length] ?? "guwahati_shillong"
  const mode: TravelMode = routeId === "shillong_cherrapunji" && slot % 5 === 0 ? "walk" : "car"
  return baseTourist(slot, rng, {
    routeId,
    mode,
    featured: false,
    waypoints: extras?.waypoints ?? [],
    silence: extras?.silence ?? null,
    drift: extras?.drift ?? null,
    stationary: extras?.stationary ?? null,
    sosAtMs: extras?.sosAtMs ?? null,
    haltWhenRestricted: extras?.haltWhenRestricted ?? false,
    dropouts: extras?.dropouts ?? true,
    batteryStart: extras?.batteryStart,
  })
}

export function fillBackground(
  featured: TouristPlan[],
  count: number,
  rng: Rng,
): TouristPlan[] {
  const used = new Set(featured.map((t) => t.email))
  const out = [...featured]
  let cursor = 0
  while (out.length < count) {
    const candidate = safeBackground(cursor, rng)
    cursor += 1
    if (used.has(candidate.email)) continue
    used.add(candidate.email)
    out.push({ ...candidate, slot: out.length })
  }
  return out.map((t, i) => ({ ...t, slot: i }))
}

export function waypoint(name: string, lon: number, lat: number, dwellMinutes: number): WaypointPlan {
  return { name, lon, lat, dwellMinutes }
}
