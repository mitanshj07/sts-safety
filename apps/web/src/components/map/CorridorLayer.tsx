// apps/web/src/components/map/CorridorLayer.tsx
"use client";

import { useEffect, useMemo } from "react";
import buffer from "@turf/buffer";
import { lineString } from "@turf/helpers";
import { useMap } from "@/components/map/MapCanvas";
import { getGeoJsonSource, mapHasStyle } from "@/lib/geo/map-runtime";
import type { CachedItinerary } from "@/lib/offline/db";

const SRC_LINE = "sts-corridor-line";
const SRC_BUF = "sts-corridor-buf";
const LAYER_BUF = "sts-corridor-fill";
const LAYER_LINE = "sts-corridor-stroke";

export function CorridorLayer({ itinerary }: { itinerary: CachedItinerary | null }) {
  const { map, isLoaded } = useMap();

  const { line, buf } = useMemo(() => {
    if (!itinerary || itinerary.geometry.coordinates.length < 2) {
      return {
        line: { type: "FeatureCollection", features: [] } as GeoJSON.FeatureCollection,
        buf: { type: "FeatureCollection", features: [] } as GeoJSON.FeatureCollection,
      };
    }
    const ls = lineString(itinerary.geometry.coordinates);
    const buffered = buffer(ls, itinerary.corridor_m, { units: "meters" });
    return {
      line: { type: "FeatureCollection", features: [ls] } as GeoJSON.FeatureCollection,
      buf: {
        type: "FeatureCollection",
        features: buffered ? [buffered] : [],
      } as GeoJSON.FeatureCollection,
    };
  }, [itinerary]);

  useEffect(() => {
    if (!map || !isLoaded || !mapHasStyle(map)) return;

    const ensure = (id: string, data: GeoJSON.FeatureCollection) => {
      if (!map.getSource(id)) {
        map.addSource(id, { type: "geojson", data });
      } else {
        getGeoJsonSource(map, id)?.setData(data);
      }
    };

    ensure(SRC_BUF, buf);
    ensure(SRC_LINE, line);

    if (!map.getLayer(LAYER_BUF)) {
      map.addLayer({
        id: LAYER_BUF,
        type: "fill",
        source: SRC_BUF,
        paint: { "fill-color": "#38bdf8", "fill-opacity": 0.12 },
      });
    }
    if (!map.getLayer(LAYER_LINE)) {
      map.addLayer({
        id: LAYER_LINE,
        type: "line",
        source: SRC_LINE,
        paint: { "line-color": "#38bdf8", "line-width": 3, "line-opacity": 0.8 },
      });
    }
  }, [map, isLoaded, line, buf]);

  return null;
}
