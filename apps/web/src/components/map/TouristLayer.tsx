// apps/web/src/components/map/TouristLayer.tsx
"use client";

import { useEffect, useMemo } from "react";
import { useLatestRef } from "@/hooks/useLatestRef";
import type { Feature, FeatureCollection, Point } from "geojson";

import { useMap } from "@/components/map/MapCanvas";
import { safetyScoreColor } from "@/lib/geo/colors";
import { ensureMapImages, TOURIST_DOT_IMAGE_ID } from "@/lib/geo/map-images";
import {
  getGeoJsonSource,
  mapHasStyle,
  removeLayerIfPresent,
  removeSourceIfPresent,
  startPulseAnimation,
} from "@/lib/geo/map-runtime";
import { parseTourists, type TouristMapPoint } from "@/lib/geo/schemas";

const SOURCE_ID = "sts-tourists";
const CLUSTER_LAYER_ID = "sts-tourists-clusters";
const CLUSTER_COUNT_LAYER_ID = "sts-tourists-cluster-count";
const POINT_LAYER_ID = "sts-tourists-point";
const HALO_LAYER_ID = "sts-tourists-halo";
const CLUSTER_THRESHOLD = 50;

type TouristProperties = {
  id: string;
  name: string;
  safety_score: number;
};

export type TouristLayerProps = {
  tourists: readonly TouristMapPoint[];
};

function buildCollection(
  tourists: readonly TouristMapPoint[],
): FeatureCollection<Point, TouristProperties> {
  const features: Feature<Point, TouristProperties>[] = parseTourists(tourists).map(
    (tourist) => ({
      type: "Feature",
      id: tourist.id,
      geometry: { type: "Point", coordinates: [tourist.lon, tourist.lat] },
      properties: {
        id: tourist.id,
        name: tourist.name ?? tourist.id,
        safety_score: tourist.safety_score,
      },
    }),
  );
  return { type: "FeatureCollection", features };
}

export function TouristLayer({ tourists }: TouristLayerProps) {
  const { map, isLoaded, styleEpoch } = useMap();
  const geojson = useMemo(() => buildCollection(tourists), [tourists]);
  const cluster = geojson.features.length > CLUSTER_THRESHOLD;
  const geojsonRef = useLatestRef(geojson);

  useEffect(() => {
    if (!map || !isLoaded || !mapHasStyle(map)) {
      return;
    }

    ensureMapImages(map);

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: geojsonRef.current,
        cluster,
        clusterMaxZoom: 14,
        clusterRadius: 48,
        promoteId: "id",
      });
    }

    if (cluster && !map.getLayer(CLUSTER_LAYER_ID)) {
      map.addLayer({
        id: CLUSTER_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#64748b",
            10,
            "#f59e0b",
            25,
            "#f97316",
            50,
            "#ef4444",
          ],
          "circle-radius": [
            "step",
            ["get", "point_count"],
            16,
            10,
            20,
            25,
            26,
          ],
          "circle-opacity": 0.85,
        },
      });
    }

    if (cluster && !map.getLayer(CLUSTER_COUNT_LAYER_ID)) {
      map.addLayer({
        id: CLUSTER_COUNT_LAYER_ID,
        type: "symbol",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
          "text-font": ["Noto Sans Regular"],
        },
        paint: { "text-color": "#f8fafc" },
      });
    }

    if (!map.getLayer(HALO_LAYER_ID)) {
      map.addLayer({
        id: HALO_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        filter: [
          "all",
          ["!", ["has", "point_count"]],
          ["<", ["get", "safety_score"], 40],
        ],
        paint: {
          "circle-color": "#ef4444",
          "circle-radius": 14,
          "circle-opacity": 0.35,
        },
      });
    }

    if (!map.getLayer(POINT_LAYER_ID)) {
      map.addLayer({
        id: POINT_LAYER_ID,
        type: "symbol",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        layout: {
          "icon-image": TOURIST_DOT_IMAGE_ID,
          "icon-size": 0.45,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: {
          "icon-color": safetyScoreColor,
        },
      });
    }

    const stopPulse = startPulseAnimation(map, HALO_LAYER_ID, {
      minRadius: 10,
      maxRadius: 22,
    });

    const onEnter = (): void => {
      map.getCanvas().style.cursor = "pointer";
    };
    const onLeave = (): void => {
      map.getCanvas().style.cursor = "";
    };
    map.on("mouseenter", POINT_LAYER_ID, onEnter);
    map.on("mouseleave", POINT_LAYER_ID, onLeave);

    return () => {
      stopPulse();
      map.off("mouseenter", POINT_LAYER_ID, onEnter);
      map.off("mouseleave", POINT_LAYER_ID, onLeave);
      removeLayerIfPresent(map, POINT_LAYER_ID);
      removeLayerIfPresent(map, HALO_LAYER_ID);
      removeLayerIfPresent(map, CLUSTER_COUNT_LAYER_ID);
      removeLayerIfPresent(map, CLUSTER_LAYER_ID);
      removeSourceIfPresent(map, SOURCE_ID);
    };
  }, [map, isLoaded, styleEpoch, cluster, geojsonRef]);

  useEffect(() => {
    if (!map || !isLoaded) {
      return;
    }
    getGeoJsonSource(map, SOURCE_ID)?.setData(geojson);
  }, [map, isLoaded, geojson]);

  return null;
}
