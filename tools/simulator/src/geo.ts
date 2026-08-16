// tools/simulator/src/geo.ts
import {
  EARTH_RADIUS_M,
  bearing,
  haversine,
  type LonLat,
} from "@sts/shared"

export type LonLatTuple = [number, number]

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI
}

export function tupleToLonLat(t: LonLatTuple): LonLat {
  return { lon: t[0], lat: t[1] }
}

export function destination(start: LonLat, bearingDeg: number, distanceM: number): LonLat {
  const lat1 = toRad(start.lat)
  const lon1 = toRad(start.lon)
  const brng = toRad(bearingDeg)
  const ang = distanceM / EARTH_RADIUS_M
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(ang) + Math.cos(lat1) * Math.sin(ang) * Math.cos(brng),
  )
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(ang) * Math.cos(lat1),
      Math.cos(ang) - Math.sin(lat1) * Math.sin(lat2),
    )
  return { lat: toDeg(lat2), lon: ((toDeg(lon2) + 540) % 360) - 180 }
}

export function offsetMetres(start: LonLat, eastM: number, northM: number): LonLat {
  const north = destination(start, 0, northM)
  return destination(north, 90, eastM)
}

export type RouteProfile = {
  coords: LonLatTuple[]
  cumM: number[]
  lengthM: number
}

export function buildRouteProfile(coords: LonLatTuple[]): RouteProfile {
  if (coords.length < 2) {
    throw new TypeError("route needs at least 2 coordinates")
  }
  const cumM: number[] = [0]
  let total = 0
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1]
    const cur = coords[i]
    if (!prev || !cur) continue
    total += haversine(tupleToLonLat(prev), tupleToLonLat(cur))
    cumM.push(total)
  }
  return { coords, cumM, lengthM: total }
}

export function pointAlong(
  route: RouteProfile,
  distanceM: number,
): { point: LonLat; heading: number; done: boolean } {
  const clamped = Math.max(0, Math.min(distanceM, route.lengthM))
  const last = route.coords[route.coords.length - 1]
  if (!last) throw new TypeError("empty route")
  if (clamped >= route.lengthM) {
    const prev = route.coords[route.coords.length - 2] ?? last
    return {
      point: tupleToLonLat(last),
      heading: bearing(tupleToLonLat(prev), tupleToLonLat(last)),
      done: true,
    }
  }
  let i = 1
  while (i < route.cumM.length && (route.cumM[i] ?? 0) < clamped) i++
  const c0 = route.coords[i - 1]
  const c1 = route.coords[i]
  const d0 = route.cumM[i - 1]
  const d1 = route.cumM[i]
  if (!c0 || !c1 || d0 === undefined || d1 === undefined) {
    return { point: tupleToLonLat(last), heading: 0, done: true }
  }
  const span = d1 - d0
  const t = span <= 0 ? 0 : (clamped - d0) / span
  const a = tupleToLonLat(c0)
  const b = tupleToLonLat(c1)
  return {
    point: { lon: a.lon + (b.lon - a.lon) * t, lat: a.lat + (b.lat - a.lat) * t },
    heading: bearing(a, b),
    done: false,
  }
}

/** Ray-casting point-in-polygon. Ring is closed [lon,lat][]. */
export function pointInRing(point: LonLat, ring: LonLatTuple[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ri = ring[i]
    const rj = ring[j]
    if (!ri || !rj) continue
    const yi = ri[1]
    const yj = rj[1]
    const xi = ri[0]
    const xj = rj[0]
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lon < ((xj - xi) * (point.lat - yi)) / (yj - yi + Number.EPSILON) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function distanceToRingM(point: LonLat, ring: LonLatTuple[]): number {
  if (pointInRing(point, ring)) return 0
  let min = Infinity
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1]
    const b = ring[i]
    if (!a || !b) continue
    min = Math.min(min, distToSegmentM(point, tupleToLonLat(a), tupleToLonLat(b)))
  }
  return min
}

function distToSegmentM(p: LonLat, a: LonLat, b: LonLat): number {
  const ab = haversine(a, b)
  if (ab < 1) return haversine(p, a)
  const headingAB = bearing(a, b)
  const headingAP = bearing(a, p)
  const ap = haversine(a, p)
  const angle = ((headingAP - headingAB) * Math.PI) / 180
  const t = Math.max(0, Math.min(1, (ap * Math.cos(angle)) / ab))
  const proj = destination(a, headingAB, t * ab)
  return haversine(p, proj)
}

export function perpendicularOffset(
  point: LonLat,
  headingDeg: number,
  offsetM: number,
): LonLat {
  return destination(point, (headingDeg + 90) % 360, offsetM)
}

export function firstProgressInside(
  route: RouteProfile,
  ring: LonLatTuple[],
  stepM = 25,
): number | null {
  for (let d = 0; d <= route.lengthM; d += stepM) {
    const { point } = pointAlong(route, d)
    if (pointInRing(point, ring)) return d
  }
  return null
}
