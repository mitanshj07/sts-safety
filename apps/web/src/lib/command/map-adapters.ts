// apps/web/src/lib/command/map-adapters.ts
import type { IncidentMapPoint, TouristMapPoint, ZoneInput } from "@/lib/geo/schemas"
import type { LiveIncident, LiveTourist, LiveZone } from "@/lib/command/types"

export function toZoneInputs(zones: readonly LiveZone[]): ZoneInput[] {
  return zones.flatMap((zone) => {
    if (!zone.geom) return []
    const geometry: ZoneInput["geometry"] = {
      type: "Polygon",
      coordinates: zone.geom.coordinates.map((ring) =>
        ring.map((pos) => [pos[0], pos[1]] as [number, number]),
      ),
    }
    return [
      {
        id: zone.id,
        name: zone.name,
        category: zone.category,
        risk_level: zone.risk_level,
        advisory: zone.advisory_text,
        geometry,
      },
    ]
  })
}

export function toTouristPoints(tourists: readonly LiveTourist[]): TouristMapPoint[] {
  return tourists.flatMap((tourist) => {
    if (tourist.lat === null || tourist.lon === null) return []
    return [
      {
        id: tourist.id,
        lat: tourist.lat,
        lon: tourist.lon,
        safety_score: tourist.safety_score,
        name: tourist.full_name,
      },
    ]
  })
}

export function toIncidentPoints(
  incidents: readonly LiveIncident[],
): IncidentMapPoint[] {
  return incidents.flatMap((incident) => {
    if (incident.lat === null || incident.lon === null) return []
    if (!["open", "acknowledged", "dispatched"].includes(incident.status)) {
      return []
    }
    return [
      {
        id: incident.id,
        lat: incident.lat,
        lon: incident.lon,
        severity: incident.severity,
        type: incident.type,
      },
    ]
  })
}

export function circlePolygon(
  lon: number,
  lat: number,
  radiusM: number,
  steps = 64,
): GeoJSON.Polygon {
  const coords: [number, number][] = []
  const latRad = (lat * Math.PI) / 180
  const dLat = radiusM / 6_371_000
  const dLon = radiusM / (6_371_000 * Math.cos(latRad))
  for (let i = 0; i <= steps; i += 1) {
    const theta = (i / steps) * 2 * Math.PI
    coords.push([
      lon + ((dLon * 180) / Math.PI) * Math.cos(theta),
      lat + ((dLat * 180) / Math.PI) * Math.sin(theta),
    ])
  }
  return { type: "Polygon", coordinates: [coords] }
}
