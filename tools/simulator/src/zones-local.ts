// tools/simulator/src/zones-local.ts
import type { RiskLevel, ZoneCategory } from "@sts/shared"
import { pointInRing, type LonLatTuple } from "./geo.ts"
import type { LonLat } from "@sts/shared"

export type LocalZone = {
  id: string
  name: string
  category: ZoneCategory
  risk_level: RiskLevel
  ring: LonLatTuple[]
}

/** Mirrors supabase/seed/01_zones_northeast.sql — offline fallback + countdown. */
export const LOCAL_ZONES: readonly LocalZone[] = [
  {
    id: "11111111-1111-4111-8111-111111111101",
    name: "Kaziranga Core Range",
    category: "restricted",
    risk_level: "critical",
    ring: [
      [93.3, 26.57],
      [93.38, 26.54],
      [93.47, 26.56],
      [93.49, 26.64],
      [93.42, 26.7],
      [93.32, 26.68],
      [93.3, 26.57],
    ],
  },
  {
    id: "11111111-1111-4111-8111-111111111102",
    name: "Kaziranga Buffer",
    category: "caution",
    risk_level: "medium",
    ring: [
      [93.18, 26.5],
      [93.58, 26.5],
      [93.62, 26.78],
      [93.2, 26.78],
      [93.18, 26.5],
    ],
  },
  {
    id: "11111111-1111-4111-8111-111111111103",
    name: "Tawang Town",
    category: "safe",
    risk_level: "low",
    ring: [
      [91.85, 27.575],
      [91.88, 27.575],
      [91.88, 27.6],
      [91.85, 27.6],
      [91.85, 27.575],
    ],
  },
  {
    id: "11111111-1111-4111-8111-111111111104",
    name: "Bum La Pass Approach",
    category: "border",
    risk_level: "high",
    ring: [
      [91.82, 27.72],
      [91.86, 27.72],
      [91.86, 27.76],
      [91.82, 27.76],
      [91.82, 27.72],
    ],
  },
  {
    id: "11111111-1111-4111-8111-111111111105",
    name: "Cherrapunji Viewpoints",
    category: "caution",
    risk_level: "medium",
    ring: [
      [91.67, 25.25],
      [91.74, 25.25],
      [91.74, 25.32],
      [91.67, 25.32],
      [91.67, 25.25],
    ],
  },
  {
    id: "11111111-1111-4111-8111-111111111106",
    name: "Living Root Bridges Trail",
    category: "caution",
    risk_level: "medium",
    ring: [
      [91.655, 25.23],
      [91.695, 25.23],
      [91.695, 25.265],
      [91.655, 25.265],
      [91.655, 25.23],
    ],
  },
  {
    id: "11111111-1111-4111-8111-111111111107",
    name: "Loktak Lake",
    category: "safe",
    risk_level: "low",
    ring: [
      [93.76, 24.43],
      [93.92, 24.43],
      [93.92, 24.63],
      [93.76, 24.63],
      [93.76, 24.43],
    ],
  },
  {
    id: "11111111-1111-4111-8111-111111111108",
    name: "Dzukou Valley Trek",
    category: "high_risk",
    risk_level: "high",
    ring: [
      [94.04, 25.52],
      [94.105, 25.52],
      [94.105, 25.59],
      [94.04, 25.59],
      [94.04, 25.52],
    ],
  },
  {
    id: "11111111-1111-4111-8111-111111111109",
    name: "Guwahati City Centre",
    category: "safe",
    risk_level: "none",
    ring: [
      [91.72, 26.16],
      [91.78, 26.16],
      [91.78, 26.2],
      [91.72, 26.2],
      [91.72, 26.16],
    ],
  },
  {
    id: "11111111-1111-4111-8111-111111111110",
    name: "Manas National Park (night-restricted)",
    category: "forest_reserve",
    risk_level: "high",
    ring: [
      [90.85, 26.65],
      [91.15, 26.65],
      [91.15, 26.85],
      [90.85, 26.85],
      [90.85, 26.65],
    ],
  },
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Hotel Brahmaputra Ashok (Guwahati)",
    category: "accommodation",
    risk_level: "none",
    ring: [
      [91.7475, 26.1795],
      [91.7508, 26.1795],
      [91.7508, 26.1818],
      [91.7475, 26.1818],
      [91.7475, 26.1795],
    ],
  },
  {
    id: "11111111-1111-4111-8111-111111111112",
    name: "Hotel Polo Towers (Shillong)",
    category: "accommodation",
    risk_level: "none",
    ring: [
      [91.8915, 25.577],
      [91.895, 25.577],
      [91.895, 25.5802],
      [91.8915, 25.5802],
      [91.8915, 25.577],
    ],
  },
  {
    id: "11111111-1111-4111-8111-111111111113",
    name: "Jorabat Checkpoint",
    category: "checkpoint",
    risk_level: "low",
    ring: [
      [91.86, 26.096],
      [91.8665, 26.096],
      [91.8665, 26.1035],
      [91.86, 26.1035],
      [91.86, 26.096],
    ],
  },
  {
    id: "11111111-1111-4111-8111-111111111114",
    name: "Sela Pass Checkpoint",
    category: "checkpoint",
    risk_level: "medium",
    ring: [
      [92.1, 27.5],
      [92.11, 27.5],
      [92.11, 27.5085],
      [92.1, 27.5085],
      [92.1, 27.5],
    ],
  },
]

export const INCIDENT_ZONE_CATEGORIES: ReadonlySet<ZoneCategory> = new Set([
  "restricted",
  "high_risk",
  "border",
])

export function zonesContaining(point: LonLat): LocalZone[] {
  return LOCAL_ZONES.filter((z) => pointInRing(point, z.ring))
}

export function primaryZone(point: LonLat): LocalZone | null {
  const hits = zonesContaining(point)
  if (hits.length === 0) return null
  const rank: Record<ZoneCategory, number> = {
    restricted: 0,
    high_risk: 1,
    border: 2,
    forest_reserve: 3,
    caution: 4,
    checkpoint: 5,
    medical: 6,
    accommodation: 7,
    safe: 8,
  }
  return [...hits].sort((a, b) => rank[a.category] - rank[b.category])[0] ?? null
}

export function inIncidentZone(point: LonLat): LocalZone | null {
  return zonesContaining(point).find((z) => INCIDENT_ZONE_CATEGORIES.has(z.category)) ?? null
}
