// apps/web/src/components/map/ResponderLayer.tsx
"use client"

import { useEffect, useMemo } from "react"
import type { FeatureCollection, Polygon } from "geojson"
import { useMap } from "@/components/map/MapCanvas"
import { circlePolygon } from "@/lib/command/map-adapters"
import {
  getGeoJsonSource,
  mapHasStyle,
  removeLayerIfPresent,
  removeSourceIfPresent,
} from "@/lib/geo/map-runtime"
import type { LiveResponder } from "@/lib/command/types"

const SOURCE_ID = "sts-responder-coverage"
const FILL_ID = "sts-responder-fill"
const LINE_ID = "sts-responder-line"
const DOT_SOURCE = "sts-responder-dots"
const DOT_ID = "sts-responder-dots-layer"

export function ResponderLayer({ responders }: { responders: readonly LiveResponder[] }) {
  const { map, isLoaded, styleEpoch } = useMap()
  const coverage = useMemo<FeatureCollection<Polygon>>(() => {
    return {
      type: "FeatureCollection",
      features: responders.map((responder) => ({
        type: "Feature",
        id: responder.id,
        properties: { name: responder.name, on_duty: responder.on_duty },
        geometry: circlePolygon(responder.lon, responder.lat, responder.coverage_m),
      })),
    }
  }, [responders])

  const dots = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: responders.map((responder) => ({
        type: "Feature" as const,
        properties: { name: responder.name },
        geometry: {
          type: "Point" as const,
          coordinates: [responder.lon, responder.lat],
        },
      })),
    }),
    [responders],
  )

  useEffect(() => {
    if (!map || !isLoaded || !mapHasStyle(map)) return
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: "geojson", data: coverage })
    }
    if (!map.getSource(DOT_SOURCE)) {
      map.addSource(DOT_SOURCE, { type: "geojson", data: dots })
    }
    if (!map.getLayer(FILL_ID)) {
      map.addLayer({
        id: FILL_ID,
        type: "fill",
        source: SOURCE_ID,
        paint: { "fill-color": "#38bdf8", "fill-opacity": 0.08 },
      })
    }
    if (!map.getLayer(LINE_ID)) {
      map.addLayer({
        id: LINE_ID,
        type: "line",
        source: SOURCE_ID,
        paint: { "line-color": "#38bdf8", "line-width": 1, "line-dasharray": [2, 2] },
      })
    }
    if (!map.getLayer(DOT_ID)) {
      map.addLayer({
        id: DOT_ID,
        type: "circle",
        source: DOT_SOURCE,
        paint: {
          "circle-radius": 5,
          "circle-color": "#38bdf8",
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ecfeff",
        },
      })
    }
    return () => {
      removeLayerIfPresent(map, DOT_ID)
      removeLayerIfPresent(map, LINE_ID)
      removeLayerIfPresent(map, FILL_ID)
      removeSourceIfPresent(map, DOT_SOURCE)
      removeSourceIfPresent(map, SOURCE_ID)
    }
  }, [map, isLoaded, styleEpoch, coverage, dots])

  useEffect(() => {
    if (!map || !isLoaded) return
    getGeoJsonSource(map, SOURCE_ID)?.setData(coverage)
    getGeoJsonSource(map, DOT_SOURCE)?.setData(dots)
  }, [map, isLoaded, coverage, dots])

  return null
}
