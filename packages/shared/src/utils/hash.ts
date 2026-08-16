// packages/shared/src/utils/hash.ts
import { encodePacked, keccak256, stringToHex, type Hex } from "viem"
import { roundCoordinate } from "./geo"
import { toUnixSeconds } from "./time"

const COORD_KEYS = new Set(["lat", "lon", "lng", "latitude", "longitude"])

const ISO_DATETIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  )
}

function prepare(value: unknown, key?: string): unknown {
  if (value === null || value === undefined) return undefined

  if (value instanceof Date) return toUnixSeconds(value)

  if (typeof value === "string") {
    if (ISO_DATETIME.test(value)) return toUnixSeconds(value)
    return value
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return undefined
    if (value > 1e12) return Math.floor(value / 1000)
    if (key && (COORD_KEYS.has(key) || key === "coordinates")) {
      return roundCoordinate(value)
    }
    return value
  }

  if (typeof value === "boolean") return value

  if (Array.isArray(value)) {
    if (key === "coordinates") {
      return value.map((entry) => {
        if (typeof entry === "number") return roundCoordinate(entry)
        if (Array.isArray(entry)) {
          return entry.map((n) =>
            typeof n === "number" ? roundCoordinate(n) : prepare(n, "coordinates"),
          )
        }
        return prepare(entry, "coordinates")
      })
    }
    return value.map((item) => {
      const prepared = prepare(item)
      return prepared === undefined ? null : prepared
    })
  }

  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(value).sort()) {
      const prepared = prepare(value[k], k)
      if (prepared !== undefined && prepared !== null) {
        out[k] = prepared
      }
    }
    return out
  }

  return String(value)
}

/**
 * Deterministic JSON: lexicographic keys at every depth, no whitespace,
 * nulls omitted, timestamps as unix seconds, coordinates rounded to 7 d.p.
 */
export function canonicalJson(obj: unknown): string {
  const prepared = prepare(obj)
  if (prepared === undefined) return ""
  return JSON.stringify(prepared)
}

/** Uppercase, strip whitespace and hyphens — matches the Solidity commitment. */
export function normaliseKycNumber(kycNumber: string): string {
  return kycNumber.toUpperCase().replace(/[\s-]/g, "")
}

/**
 * keccak256(abi.encodePacked(uint8 kycType, string kycNumber, bytes32 salt)).
 * kycType ordinals: 1 passport, 2 aadhaar, 3 voter_id, 4 driving_licence.
 */
export function kycCommitment(
  kycType: number,
  kycNumber: string,
  salt: Hex,
): Hex {
  return keccak256(
    encodePacked(
      ["uint8", "string", "bytes32"],
      [kycType, normaliseKycNumber(kycNumber), salt],
    ),
  )
}

/** Immutable incident core hashed on-chain. Status / AI brief / timestamps excluded. */
export type IncidentRecordCore = {
  id: string
  tourist_token_id: string | number | bigint | null
  type: string
  severity: string
  occurred_at: Date | string | number
  lat: number
  lon: number
  zone_id: string | null
  detected_by: string
  payload: unknown
}
export type IncidentHashInput = IncidentRecordCore

export function incidentRecordHash(incident: IncidentRecordCore): Hex {
  const tokenId = incident.tourist_token_id
  return keccak256(
    stringToHex(
      canonicalJson({
        detected_by: incident.detected_by,
        id: incident.id,
        lat: incident.lat,
        lon: incident.lon,
        occurred_at: incident.occurred_at,
        payload: incident.payload,
        severity: incident.severity,
        tourist_token_id:
          typeof tokenId === "bigint" ? tokenId.toString() : tokenId,
        type: incident.type,
        zone_id: incident.zone_id,
      }),
    ),
  )
}

export function itineraryHash(geojson: unknown): Hex {
  return keccak256(stringToHex(canonicalJson(geojson)))
}

/** UUID → bytes16 hex (hyphens stripped, 16 raw bytes). */
export function uuidToBytes16(uuid: string): Hex {
  const hex = uuid.replaceAll("-", "").toLowerCase()
  if (!/^[0-9a-f]{32}$/.test(hex)) {
    throw new TypeError(`invalid uuid: ${uuid}`)
  }
  return `0x${hex}`
}
