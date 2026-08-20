// apps/web/src/components/map/SuggestionLayer.tsx
"use client"

import { useEffect, useMemo } from "react"
import type { Feature, FeatureCollection, Polygon } from "geojson"

import { useMap } from "@/components/map/MapCanvas"
import {
  getGeoJsonSource,
  mapHasStyle,
  removeLayerIfPresent,
  removeSourceIfPresent,
} from "@/lib/geo/map-runtime"
import type { HotspotSuggestion } from "@/lib/command/types"

const SOURCE_ID = "sts-suggestions"
const FILL_LAYER_ID = "sts-suggestions-fill"
const LINE_LAYER_ID = "sts-suggestions-line"
const CENTER_SOURCE_ID = "sts-suggestions-centers"
const CENTER_LAYER_ID = "sts-suggestions-centers-circle"

const EMPTY_COLLECTION: FeatureCollection = { type: "FeatureCollection", features: [] }

type SuggestionProperties = {
  id: string
  name: string
  selected: boolean
}

export function SuggestionLayer({
  suggestions,
  selectedId,
}: {
  suggestions: readonly HotspotSuggestion[]
  selectedId?: string | null
}) {
  const { map, isLoaded, styleEpoch } = useMap()

  const polygons = useMemo((): FeatureCollection<Polygon, SuggestionProperties> => {
    const features: Feature<Polygon, SuggestionProperties>[] = suggestions.map((row) => ({
      type: "Feature",
      id: row.id,
      geometry: {
        type: "Polygon",
        coordinates: row.proposed_geom.coordinates.map((ring) =>
          ring.map((pos) => [pos[0], pos[1]] as [number, number]),
        ),
      },
      properties: {
        id: row.id,
        name: row.proposed_name,
        selected: row.id === selectedId,
      },
    }))
    return { type: "FeatureCollection", features }
  }, [suggestions, selectedId])

  const centers = useMemo((): FeatureCollection => {
    return {
      type: "FeatureCollection",
      features: suggestions.map((row) => ({
        type: "Feature",
        id: row.id,
        geometry: { type: "Point", coordinates: [row.lon, row.lat] },
        properties: { id: row.id, selected: row.id === selectedId },
      })),
    }
  }, [suggestions, selectedId])

  useEffect(() => {
    if (!map || !isLoaded || !mapHasStyle(map)) return

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: "geojson", data: EMPTY_COLLECTION })
    }
    if (!map.getLayer(FILL_LAYER_ID)) {
      map.addLayer({
        id: FILL_LAYER_ID,
        type: "fill",
        source: SOURCE_ID,
        paint: {
          "fill-color": [
            "case",
            ["==", ["get", "selected"], true],
            "#f97316",
            "#38bdf8",
          ],
          "fill-opacity": 0.22,
        },
      })
    }
    if (!map.getLayer(LINE_LAYER_ID)) {
      map.addLayer({
        id: LINE_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        paint: {
          "line-color": [
            "case",
            ["==", ["get", "selected"], true],
            "#fb923c",
            "#7dd3fc",
          ],
          "line-width": 2,
          "line-dasharray": [2, 1.4],
        },
      })
    }
    if (!map.getSource(CENTER_SOURCE_ID)) {
      map.addSource(CENTER_SOURCE_ID, { type: "geojson", data: EMPTY_COLLECTION })
    }
    if (!map.getLayer(CENTER_LAYER_ID)) {
      map.addLayer({
        id: CENTER_LAYER_ID,
        type: "circle",
        source: CENTER_SOURCE_ID,
        paint: {
          "circle-radius": 6,
          "circle-color": "#f97316",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff7ed",
        },
      })
    }

    return () => {
      removeLayerIfPresent(map, CENTER_LAYER_ID)
      removeLayerIfPresent(map, LINE_LAYER_ID)
      removeLayerIfPresent(map, FILL_LAYER_ID)
      removeSourceIfPresent(map, CENTER_SOURCE_ID)
      removeSourceIfPresent(map, SOURCE_ID)
    }
  }, [map, isLoaded, styleEpoch])

  useEffect(() => {
    if (!map || !isLoaded) return
    getGeoJsonSource(map, SOURCE_ID)?.setData(polygons)
    getGeoJsonSource(map, CENTER_SOURCE_ID)?.setData(centers)
  }, [map, isLoaded, polygons, centers])

  return null
}
