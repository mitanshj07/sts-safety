import { describe, expect, it } from "vitest"
import { circlePolygon, destination, haversine } from "./geo"

describe("destination / circlePolygon", () => {
  it("travels ~500 m due north from Dawki", () => {
    const start = { lat: 25.1833, lon: 92.0167 }
    const north = destination(start, 500, 0)
    expect(haversine(start, north)).toBeGreaterThan(490)
    expect(haversine(start, north)).toBeLessThan(510)
    expect(north.lat).toBeGreaterThan(start.lat)
  })

  it("closes a circular reserved polygon", () => {
    const poly = circlePolygon({ lat: 25.1833, lon: 92.0167 }, 200, 16)
    const ring = poly.coordinates[0]
    expect(ring?.length).toBe(17)
    expect(ring?.[0]).toEqual(ring?.[ring.length - 1])
  })
})
