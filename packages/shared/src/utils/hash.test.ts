// packages/shared/src/utils/hash.test.ts
import { describe, expect, it } from "vitest"
import {
  canonicalJson,
  incidentRecordHash,
  kycCommitment,
  normaliseKycNumber,
  uuidToBytes16,
} from "./hash"

const SALT =
  "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" as const

const INCIDENT_ID = "550e8400-e29b-41d4-a716-446655440000"

describe("canonicalJson", () => {
  it("sorts keys at every depth so input key order does not change the output", () => {
    const a = canonicalJson({
      z: { b: 1, a: 2 },
      b: true,
      a: "ok",
    })
    const b = canonicalJson({
      a: "ok",
      b: true,
      z: { a: 2, b: 1 },
    })
    expect(a).toBe(b)
    expect(a).toBe('{"a":"ok","b":true,"z":{"a":2,"b":1}}')
  })

  it("omits null fields, emits no whitespace, and uses unix seconds for timestamps", () => {
    expect(
      canonicalJson({
        zone_id: null,
        occurred_at: "2025-01-01T00:00:00.000Z",
        type: "sos",
      }),
    ).toBe('{"occurred_at":1735689600,"type":"sos"}')
  })

  it("rounds coordinates to 7 decimal places", () => {
    expect(
      canonicalJson({
        lat: 26.144512345,
        lon: 91.736212345,
      }),
    ).toBe('{"lat":26.1445123,"lon":91.7362123}')
  })

  it("converts Date instances to unix seconds", () => {
    expect(canonicalJson({ occurred_at: new Date("2025-01-01T00:00:00.000Z") })).toBe(
      '{"occurred_at":1735689600}',
    )
  })
})

describe("normaliseKycNumber / kycCommitment", () => {
  it("uppercases and strips whitespace and hyphens", () => {
    expect(normaliseKycNumber("a12 3456-7")).toBe("A1234567")
  })

  it("matches the fixed keccak256 commitment vector", () => {
    expect(kycCommitment(1, "A12 3456-7", SALT)).toBe(
      "0xc03d6bf89ca70a118f0d0a1dd074574650ea7e7e9ab6710f90f45916a8f7d2d4",
    )
  })
})

describe("uuidToBytes16", () => {
  it("strips hyphens and returns 16 raw bytes as hex", () => {
    expect(uuidToBytes16(INCIDENT_ID)).toBe(
      "0x550e8400e29b41d4a716446655440000",
    )
    expect(uuidToBytes16("550E8400-E29B-41D4-A716-446655440000")).toBe(
      "0x550e8400e29b41d4a716446655440000",
    )
  })

  it("rejects malformed uuids", () => {
    expect(() => uuidToBytes16("not-a-uuid")).toThrow(/invalid uuid/)
  })
})

describe("incidentRecordHash", () => {
  const core = {
    id: INCIDENT_ID,
    tourist_token_id: 1,
    type: "sos",
    severity: "critical",
    occurred_at: "2025-01-01T00:00:00.000Z",
    lat: 26.144512345,
    lon: 91.736212345,
    zone_id: null as string | null,
    detected_by: "rules",
    payload: { ping_id: 42 },
  }

  it("is independent of input key order and excludes mutable fields", () => {
    const shuffled = {
      payload: { ping_id: 42 },
      detected_by: "rules",
      zone_id: null,
      lon: 91.736212345,
      lat: 26.144512345,
      occurred_at: "2025-01-01T00:00:00.000Z",
      severity: "critical",
      type: "sos",
      tourist_token_id: 1,
      id: INCIDENT_ID,
      status: "resolved",
      ai_brief: "should not be hashed",
      updated_at: "2025-01-02T00:00:00.000Z",
    }
    expect(incidentRecordHash(shuffled)).toBe(incidentRecordHash(core))
  })

  it("matches the fixed keccak256 record-hash vector", () => {
    expect(incidentRecordHash(core)).toBe(
      "0x2bd1b196c7efb2a4a9869466eb012b87e3897d756f16bc020f4c890038d142cb",
    )
  })
})
