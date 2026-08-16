// apps/web/src/components/map/SelfMarker.tsx
"use client";

import { useEffect, useMemo } from "react";
import { useMap } from "@/components/map/MapCanvas";
import { getGeoJsonSource, mapHasStyle } from "@/lib/geo/map-runtime";
import type { GeoFix } from "@/lib/tourist/schemas";

const SOURCE = "sts-self";
const LAYER = "sts-self-dot";
const HALO = "sts-self-halo";

export function SelfMarker({ fix }: { fix: GeoFix | null }) {
  const { map, isLoaded } = useMap();
  const data = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(() => {
    if (!fix) return { type: "FeatureCollection", features: [] };
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { heading: fix.heading_deg },
          geometry: { type: "Point", coordinates: [fix.lon, fix.lat] },
        },
      ],
    };
  }, [fix]);

  useEffect(() => {
    if (!map || !isLoaded || !mapHasStyle(map)) return;
    if (!map.getSource(SOURCE)) {
      map.addSource(SOURCE, { type: "geojson", data });
      map.addLayer({
        id: HALO,
        type: "circle",
        source: SOURCE,
        paint: {
          "circle-radius": 14,
          "circle-color": "#34d399",
          "circle-opacity": 0.25,
        },
      });
      map.addLayer({
        id: LAYER,
        type: "circle",
        source: SOURCE,
        paint: {
          "circle-radius": 7,
          "circle-color": "#34d399",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ecfdf5",
        },
      });
    } else {
      getGeoJsonSource(map, SOURCE)?.setData(data);
    }
    if (fix) {
      map.easeTo({ center: [fix.lon, fix.lat], duration: 500 });
    }
  }, [map, isLoaded, data, fix]);

  return null;
}
