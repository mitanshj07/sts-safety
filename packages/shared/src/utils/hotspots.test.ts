import { describe, expect, it } from "vitest"
import { clusterHotspotIncidents, hotspotClusterKey, isHotspotIncidentType } from "./hotspots"
import type { ClusterableIncident } from "./hotspots"
import { haversine } from "./geo"

const NOW = new Date("2026-08-20T06:00:00.000Z")

function incident(
  overrides: Partial<ClusterableIncident> & Pick<ClusterableIncident, "id" | "tourist_id">,
): ClusterableIncident {
  return {
    type: "sos",
    lat: 25.1833,
    lon: 92.0167,
    occurred_at: "2026-08-20T05:10:00.000Z",
    address_text: "Dawki, Meghalaya",
    ...overrides,
  }
}

describe("isHotspotIncidentType", () => {
  it("counts SOS and related alerts, not speed spoofing", () => {
    expect(isHotspotIncidentType("sos")).toBe(true)
    expect(isHotspotIncidentType("signal_lost")).toBe(true)
    expect(isHotspotIncidentType("implausible_speed")).toBe(false)
  })
})

describe("clusterHotspotIncidents", () => {
  it("groups SOS from different tourists at similar GPS into one reserved-area suggestion", () => {
    const clusters = clusterHotspotIncidents(
      [
        incident({ id: "i1", tourist_id: "t1", lat: 25.1833, lon: 92.0167 }),
        incident({ id: "i2", tourist_id: "t2", lat: 25.1841, lon: 92.0179 }),
        incident({ id: "i3", tourist_id: "t3", lat: 25.1826, lon: 92.0154 }),
        incident({ id: "i4", tourist_id: "t4", lat: 25.1838, lon: 92.0182 }),
      ],
      { now: NOW },
    )
    expect(clusters).toHaveLength(1)
    const cluster = clusters[0]
    if (!cluster) throw new Error("expected one cluster")
    expect(cluster.uniqueTourists).toBe(4)
    expect(cluster?.sosCount).toBe(4)
    expect(cluster?.proposedCategory).toBe("restricted")
    expect(cluster?.proposedRisk).toBe("critical")
    expect(cluster?.proposedName).toContain("Dawki")
    expect(cluster?.proposedGeom.type).toBe("Polygon")
    expect(cluster?.proposedGeom.coordinates[0]?.length).toBeGreaterThan(8)
    expect(cluster?.key).toBe(hotspotClusterKey(cluster.centroid))
    expect(haversine(cluster.centroid, { lat: 25.1833, lon: 92.0167 })).toBeLessThan(250)
  })

  it("ignores a single tourist firing many SOS from the same point", () => {
    const clusters = clusterHotspotIncidents(
      [
        incident({ id: "a", tourist_id: "solo" }),
        incident({ id: "b", tourist_id: "solo", lat: 25.1834, lon: 92.0168 }),
        incident({ id: "c", tourist_id: "solo", lat: 25.1832, lon: 92.0166 }),
        incident({ id: "d", tourist_id: "solo", lat: 25.1835, lon: 92.0169 }),
      ],
      { now: NOW },
    )
    expect(clusters).toHaveLength(0)
  })

  it("splits two far-apart groups into separate clusters", () => {
    const dawki = [
      incident({ id: "d1", tourist_id: "t1" }),
      incident({ id: "d2", tourist_id: "t2", lat: 25.1839, lon: 92.0172 }),
      incident({ id: "d3", tourist_id: "t3", lat: 25.1829, lon: 92.0161 }),
    ]
    const tawang = [
      incident({
        id: "w1",
        tourist_id: "t4",
        lat: 27.586,
        lon: 91.859,
        address_text: "Tawang",
      }),
      incident({
        id: "w2",
        tourist_id: "t5",
        lat: 27.587,
        lon: 91.86,
        address_text: "Tawang",
      }),
      incident({
        id: "w3",
        tourist_id: "t6",
        lat: 27.585,
        lon: 91.858,
        address_text: "Tawang",
      }),
    ]
    const clusters = clusterHotspotIncidents([...dawki, ...tawang], { now: NOW })
    expect(clusters).toHaveLength(2)
    expect(new Set(clusters.map((c) => c.key)).size).toBe(2)
  })

  it("drops incidents outside the lookback window", () => {
    const clusters = clusterHotspotIncidents(
      [
        incident({ id: "i1", tourist_id: "t1" }),
        incident({ id: "i2", tourist_id: "t2" }),
        incident({
          id: "old",
          tourist_id: "t3",
          occurred_at: "2026-08-01T00:00:00.000Z",
        }),
      ],
      { now: NOW, lookbackHours: 48 },
    )
    expect(clusters).toHaveLength(0)
  })
})
