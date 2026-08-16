// tools/simulator/src/routes/index.ts
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { z } from "zod"
import { lineStringSchema } from "@sts/shared"
import { buildRouteProfile, type RouteProfile } from "../geo.ts"
import type { RouteId, TravelMode } from "../types.ts"

const featureSchema = z.object({
  type: z.literal("Feature"),
  properties: z.object({
    id: z.string(),
    name: z.string(),
    mode: z.enum(["walk", "car", "trek"]),
    source: z.string(),
  }),
  geometry: lineStringSchema,
})

export type RouteDef = {
  id: RouteId
  name: string
  mode: TravelMode
  profile: RouteProfile
}

const dir = dirname(fileURLToPath(import.meta.url))

function load(id: RouteId, file: string): RouteDef {
  const raw: unknown = JSON.parse(readFileSync(join(dir, file), "utf8"))
  const feature = featureSchema.parse(raw)
  const coords = feature.geometry.coordinates.map((c) => {
    const lon = c[0]
    const lat = c[1]
    if (lon === undefined || lat === undefined) {
      throw new TypeError(`bad coordinate in ${file}`)
    }
    return [lon, lat] as [number, number]
  })
  return {
    id,
    name: feature.properties.name,
    mode: feature.properties.mode,
    profile: buildRouteProfile(coords),
  }
}

export const ROUTES: Record<RouteId, RouteDef> = {
  guwahati_shillong: load("guwahati_shillong", "guwahati-shillong.geojson"),
  shillong_cherrapunji: load("shillong_cherrapunji", "shillong-cherrapunji.geojson"),
  tezpur_tawang: load("tezpur_tawang", "tezpur-bomdila-tawang.geojson"),
  kaziranga_safari: load("kaziranga_safari", "kaziranga-safari-loop.geojson"),
  dzukou_trek: load("dzukou_trek", "dzukou-valley-trek.geojson"),
  imphal_loktak: load("imphal_loktak", "imphal-loktak.geojson"),
}

export const SAFE_ROUTE_IDS: readonly RouteId[] = [
  "guwahati_shillong",
  "shillong_cherrapunji",
  "tezpur_tawang",
  "imphal_loktak",
]

export function routeById(id: RouteId): RouteDef {
  const route = ROUTES[id]
  if (!route) throw new Error(`unknown route ${id}`)
  return route
}
