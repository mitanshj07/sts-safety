// apps/web/src/lib/geo/parse.ts
import type { GeoJsonPolygon } from "@sts/shared"

export type LonLat = { lon: number; lat: number }

export type GeoJsonPoint = {
  type: "Point"
  coordinates: [number, number] | [number, number, number]
}

export type GeoJsonLineString = {
  type: "LineString"
  coordinates: Array<[number, number] | [number, number, number]>
}

const WKB_POINT = 1
const WKB_LINESTRING = 2
const WKB_POLYGON = 3
const WKB_SRID = 0x20000000

const geoJsonPoint = {
  parse(value: unknown): GeoJsonPoint | null {
    if (!value || typeof value !== "object") return null
    const rec = value as { type?: unknown; coordinates?: unknown }
    if (rec.type !== "Point" || !Array.isArray(rec.coordinates)) return null
    const lon = rec.coordinates[0]
    const lat = rec.coordinates[1]
    if (typeof lon !== "number" || typeof lat !== "number") return null
    return { type: "Point", coordinates: [lon, lat] }
  },
}

class EwkbReader {
  private readonly view: DataView
  private offset = 0
  readonly little: boolean

  constructor(bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    this.little = this.view.getUint8(0) === 1
    this.offset = 1
  }

  u32(): number {
    const value = this.view.getUint32(this.offset, this.little)
    this.offset += 4
    return value
  }

  f64(): number {
    const value = this.view.getFloat64(this.offset, this.little)
    this.offset += 8
    return value
  }

  pair(): [number, number] {
    return [this.f64(), this.f64()]
  }
}

function hexToBytes(hex: string): Uint8Array | null {
  const trimmed = hex.startsWith("\\x") || hex.startsWith("\\X") ? hex.slice(2) : hex
  if (trimmed.length < 10 || trimmed.length % 2 !== 0) return null
  if (!/^[0-9a-fA-F]+$/.test(trimmed)) return null
  const bytes = new Uint8Array(trimmed.length / 2)
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(trimmed.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

function parseEwkb(hex: string): {
  type: string
  coordinates: unknown
} | null {
  const bytes = hexToBytes(hex)
  if (!bytes) return null
  try {
    const r = new EwkbReader(bytes)
    const rawType = r.u32()
    const type = rawType & 0xff
    if (rawType & WKB_SRID) {
      r.u32()
    }
    if (type === WKB_POINT) {
      const coordinates = r.pair()
      return { type: "Point", coordinates }
    }
    if (type === WKB_LINESTRING) {
      const n = r.u32()
      const coordinates: [number, number][] = []
      for (let i = 0; i < n; i += 1) coordinates.push(r.pair())
      return { type: "LineString", coordinates }
    }
    if (type === WKB_POLYGON) {
      const rings = r.u32()
      const coordinates: [number, number][][] = []
      for (let i = 0; i < rings; i += 1) {
        const n = r.u32()
        const ring: [number, number][] = []
        for (let j = 0; j < n; j += 1) ring.push(r.pair())
        coordinates.push(ring)
      }
      return { type: "Polygon", coordinates }
    }
  } catch {
    return null
  }
  return null
}

export function lonLatFromGeog(geog: unknown): LonLat | null {
  const point = geoJsonPoint.parse(geog)
  if (point) {
    return { lon: point.coordinates[0], lat: point.coordinates[1] }
  }
  if (typeof geog === "string") {
    const match = /POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)/i.exec(geog)
    if (match?.[1] && match[2]) {
      return { lon: Number(match[1]), lat: Number(match[2]) }
    }
    const ewkb = parseEwkb(geog)
    if (ewkb?.type === "Point" && Array.isArray(ewkb.coordinates)) {
      const [lon, lat] = ewkb.coordinates as [number, number]
      if (Number.isFinite(lon) && Number.isFinite(lat)) return { lon, lat }
    }
  }
  return null
}

function polygonFromWkt(wkt: string): GeoJsonPolygon | null {
  const match = /POLYGON\s*\(\s*\(([\s\S]+)\)\s*\)/i.exec(wkt)
  if (!match?.[1]) return null
  const ring = match[1]
    .split(",")
    .map((pair) => pair.trim().split(/\s+/))
    .map(([lon, lat]) => [Number(lon), Number(lat)] as [number, number])
  if (ring.length < 4 || ring.some((p) => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) {
    return null
  }
  return { type: "Polygon", coordinates: [ring] }
}

export function polygonFromGeog(geog: unknown): GeoJsonPolygon | null {
  if (typeof geog === "string") {
    const ewkb = parseEwkb(geog)
    if (ewkb?.type === "Polygon") {
      return { type: "Polygon", coordinates: ewkb.coordinates as GeoJsonPolygon["coordinates"] }
    }
    return polygonFromWkt(geog)
  }
  if (!geog || typeof geog !== "object") return null
  const rec = geog as { type?: unknown; coordinates?: unknown }
  if (rec.type !== "Polygon" || !Array.isArray(rec.coordinates)) return null
  return rec as GeoJsonPolygon
}

export function lineStringFromGeog(geog: unknown): GeoJsonLineString | null {
  if (typeof geog === "string") {
    const ewkb = parseEwkb(geog)
    if (ewkb?.type === "LineString") {
      return {
        type: "LineString",
        coordinates: ewkb.coordinates as GeoJsonLineString["coordinates"],
      }
    }
    return null
  }
  if (!geog || typeof geog !== "object") return null
  const rec = geog as { type?: unknown; coordinates?: unknown }
  if (rec.type !== "LineString" || !Array.isArray(rec.coordinates)) return null
  return rec as GeoJsonLineString
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}
