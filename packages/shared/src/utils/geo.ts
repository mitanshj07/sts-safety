// packages/shared/src/utils/geo.ts
/** WGS-84 mean Earth radius used by the haversine helpers. */
export const EARTH_RADIUS_M = 6_371_000

export const COORDINATE_DECIMALS = 7

export type LonLat = { lat: number; lon: number }

export type GeoJsonPosition = [number, number] | [number, number, number]

export type GeoJsonPoint = { type: "Point"; coordinates: GeoJsonPosition }
export type GeoJsonLineString = {
  type: "LineString"
  coordinates: GeoJsonPosition[]
}
export type GeoJsonPolygon = {
  type: "Polygon"
  coordinates: GeoJsonPosition[][]
}
export type GeoJsonGeometry = GeoJsonPoint | GeoJsonLineString | GeoJsonPolygon

export type BoundingBox = {
  minLon: number
  minLat: number
  maxLon: number
  maxLat: number
}

const COORD_FACTOR = 10 ** COORDINATE_DECIMALS

export function roundCoordinate(value: number): number {
  return Math.round(value * COORD_FACTOR) / COORD_FACTOR
}
export const roundCoord = roundCoordinate

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180
}

function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI
}

/** Great-circle distance in metres. */
export function haversine(a: LonLat, b: LonLat): number {
  const dLat = toRadians(b.lat - a.lat)
  const dLon = toRadians(b.lon - a.lon)
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)
  const sinDLat = Math.sin(dLat / 2)
  const sinDLon = Math.sin(dLon / 2)
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

/** Initial bearing from `from` to `to`, degrees clockwise from north in [0, 360). */
export function bearing(from: LonLat, to: LonLat): number {
  const lat1 = toRadians(from.lat)
  const lat2 = toRadians(to.lat)
  const dLon = toRadians(to.lon - from.lon)
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return (toDegrees(Math.atan2(y, x)) + 360) % 360
}

function isLonLat(value: GeoJsonGeometry | LonLat[] | LonLat): value is LonLat {
  return !Array.isArray(value) && "lat" in value && "lon" in value && !("coordinates" in value)
}

function collectPositions(input: GeoJsonGeometry | LonLat[] | LonLat): LonLat[] {
  if (Array.isArray(input)) return input
  if (isLonLat(input)) return [input]
  switch (input.type) {
    case "Point":
      return [positionFromTuple(input.coordinates)]
    case "LineString":
      return input.coordinates.map(positionFromTuple)
    case "Polygon":
      return input.coordinates.flat().map(positionFromTuple)
    default: {
      const _exhaustive: never = input
      throw new TypeError(`unsupported geometry: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

function positionFromTuple(pos: GeoJsonPosition): LonLat {
  const lon = pos[0]
  const lat = pos[1]
  if (lon === undefined || lat === undefined) {
    throw new TypeError("invalid GeoJSON position")
  }
  return { lon, lat }
}

function bboxFromPoints(points: LonLat[]): BoundingBox {
  if (points.length === 0) {
    throw new TypeError("bbox requires at least one point")
  }
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  for (const p of points) {
    if (p.lon < minLon) minLon = p.lon
    if (p.lat < minLat) minLat = p.lat
    if (p.lon > maxLon) maxLon = p.lon
    if (p.lat > maxLat) maxLat = p.lat
  }
  return { minLon, minLat, maxLon, maxLat }
}

/** Axis-aligned bounding box. Pass `radiusM` to pad a point (or the geometry centroid envelope). */
export function bbox(
  input: GeoJsonGeometry | LonLat[] | LonLat,
  radiusM = 0,
): BoundingBox {
  const points = collectPositions(input)
  const box = bboxFromPoints(points)
  if (radiusM <= 0) return box

  const midLat = (box.minLat + box.maxLat) / 2
  const dLat = toDegrees(radiusM / EARTH_RADIUS_M)
  const cosLat = Math.cos(toRadians(midLat))
  const dLon =
    Math.abs(cosLat) < 1e-12
      ? 180
      : toDegrees(radiusM / (EARTH_RADIUS_M * cosLat))
  return {
    minLon: Math.max(-180, box.minLon - dLon),
    minLat: Math.max(-90, box.minLat - dLat),
    maxLon: Math.min(180, box.maxLon + dLon),
    maxLat: Math.min(90, box.maxLat + dLat),
  }
}

function formatOrdinate(n: number): string {
  return String(roundCoordinate(n))
}

function pairToWkt(pos: GeoJsonPosition): string {
  const extra = pos[2] === undefined ? "" : ` ${formatOrdinate(pos[2])}`
  return `${formatOrdinate(pos[0])} ${formatOrdinate(pos[1])}${extra}`
}

function closeRing(ring: GeoJsonPosition[]): GeoJsonPosition[] {
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (
    first &&
    last &&
    first[0] === last[0] &&
    first[1] === last[1] &&
    first[2] === last[2]
  ) {
    return ring
  }
  if (!first) return ring
  return [...ring, first]
}

export function geojsonToWkt(geometry: GeoJsonGeometry): string {
  switch (geometry.type) {
    case "Point":
      return `POINT(${pairToWkt(geometry.coordinates)})`
    case "LineString":
      return `LINESTRING(${geometry.coordinates.map(pairToWkt).join(", ")})`
    case "Polygon":
      return `POLYGON(${geometry.coordinates
        .map((ring) => `(${closeRing(ring).map(pairToWkt).join(", ")})`)
        .join(", ")})`
  }
}

function parseOrdinates(token: string): GeoJsonPosition {
  const parts = token.trim().split(/\s+/).map(Number)
  const lon = parts[0]
  const lat = parts[1]
  if (lon === undefined || lat === undefined || parts.some((n) => Number.isNaN(n))) {
    throw new TypeError(`invalid WKT ordinates: ${token}`)
  }
  const alt = parts[2]
  return alt === undefined ? [lon, lat] : [lon, lat, alt]
}

function splitPairs(body: string): GeoJsonPosition[] {
  return body
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(parseOrdinates)
}

function unwrapParens(body: string): string {
  const trimmed = body.trim()
  if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

/** Destination point after travelling `distanceM` along `bearingDeg` (0 = north). */
export function destination(from: LonLat, distanceM: number, bearingDeg: number): LonLat {
  const angular = distanceM / EARTH_RADIUS_M
  const brng = toRadians(bearingDeg)
  const lat1 = toRadians(from.lat)
  const lon1 = toRadians(from.lon)
  const sinLat1 = Math.sin(lat1)
  const cosLat1 = Math.cos(lat1)
  const sinAng = Math.sin(angular)
  const cosAng = Math.cos(angular)
  const lat2 = Math.asin(sinLat1 * cosAng + cosLat1 * sinAng * Math.cos(brng))
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * sinAng * cosLat1,
      cosAng - sinLat1 * Math.sin(lat2),
    )
  return {
    lat: roundCoordinate(toDegrees(lat2)),
    lon: roundCoordinate(((toDegrees(lon2) + 540) % 360) - 180),
  }
}

/** Approximate circle as a closed GeoJSON polygon (lon, lat). */
export function circlePolygon(
  center: LonLat,
  radiusM: number,
  steps = 24,
): GeoJsonPolygon {
  const count = Math.max(8, Math.round(steps))
  const ring: GeoJsonPosition[] = []
  for (let i = 0; i < count; i += 1) {
    const point = destination(center, radiusM, (i / count) * 360)
    ring.push([point.lon, point.lat])
  }
  const first = ring[0]
  if (first) ring.push([...first])
  return { type: "Polygon", coordinates: [ring] }
}

/** Parse POINT / LINESTRING / POLYGON WKT (optional `SRID=4326;` prefix). */
export function wktToGeojson(wkt: string): GeoJsonGeometry {
  const raw = wkt.trim().replace(/^SRID=\d+\s*;\s*/i, "")
  const match = /^(POINT|LINESTRING|POLYGON)\s*([\s\S]*)$/i.exec(raw)
  if (!match) {
    throw new TypeError(`unsupported WKT: ${wkt}`)
  }
  const kind = match[1]?.toUpperCase()
  const body = match[2]
  if (!kind || body === undefined) {
    throw new TypeError(`unsupported WKT: ${wkt}`)
  }

  if (kind === "POINT") {
    return { type: "Point", coordinates: parseOrdinates(unwrapParens(body)) }
  }
  if (kind === "LINESTRING") {
    return { type: "LineString", coordinates: splitPairs(unwrapParens(body)) }
  }

  const polygonBody = unwrapParens(body)
  const rings: GeoJsonPosition[][] = []
  const ringRe = /\(([^()]*)\)/g
  let ringMatch: RegExpExecArray | null
  while ((ringMatch = ringRe.exec(polygonBody)) !== null) {
    const coords = ringMatch[1]
    if (coords === undefined) continue
    rings.push(splitPairs(coords))
  }
  if (rings.length === 0) {
    throw new TypeError(`invalid POLYGON WKT: ${wkt}`)
  }
  return { type: "Polygon", coordinates: rings }
}
