// apps/web/src/components/map/IncidentLayer.tsx
"use client";

import { useEffect, useMemo } from "react";
import { useLatestRef } from "@/hooks/useLatestRef";
import type { Feature, FeatureCollection, Point } from "geojson";
import type { MapLayerMouseEvent } from "maplibre-gl";

import { useMap } from "@/components/map/MapCanvas";
import { severityColor } from "@/lib/geo/colors";
import { ensureMapImages, INCIDENT_PIN_IMAGE_ID } from "@/lib/geo/map-images";
import {
  getGeoJsonSource,
  mapHasStyle,
  removeLayerIfPresent,
  removeSourceIfPresent,
  startPulseAnimation,
} from "@/lib/geo/map-runtime";
import { parseIncidents, type IncidentMapPoint } from "@/lib/geo/schemas";

const SOURCE_ID = "sts-incidents";
const HALO_LAYER_ID = "sts-incidents-halo";
const PIN_LAYER_ID = "sts-incidents-pin";
const SELECTED_LAYER_ID = "sts-incidents-selected";

type IncidentProperties = {
  id: string;
  severity: string;
  type: string;
};

export type IncidentLayerProps = {
  incidents: readonly IncidentMapPoint[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

function buildCollection(
  incidents: readonly IncidentMapPoint[],
): FeatureCollection<Point, IncidentProperties> {
  const features: Feature<Point, IncidentProperties>[] = parseIncidents(
    incidents,
  ).map((incident) => ({
    type: "Feature",
    id: incident.id,
    geometry: { type: "Point", coordinates: [incident.lon, incident.lat] },
    properties: {
      id: incident.id,
      severity: incident.severity,
      type: incident.type ?? "incident",
    },
  }));
  return { type: "FeatureCollection", features };
}

export function IncidentLayer({
  incidents,
  selectedId = null,
  onSelect,
}: IncidentLayerProps) {
  const { map, isLoaded, styleEpoch } = useMap();
  const onSelectRef = useLatestRef(onSelect);

  const geojson = useMemo(() => buildCollection(incidents), [incidents]);
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
        promoteId: "id",
      });
    }

    if (!map.getLayer(HALO_LAYER_ID)) {
      map.addLayer({
        id: HALO_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-color": severityColor,
          "circle-radius": 16,
          "circle-opacity": 0.35,
        },
      });
    }

    if (!map.getLayer(PIN_LAYER_ID)) {
      map.addLayer({
        id: PIN_LAYER_ID,
        type: "symbol",
        source: SOURCE_ID,
        layout: {
          "icon-image": INCIDENT_PIN_IMAGE_ID,
          "icon-size": 0.7,
          "icon-anchor": "bottom",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: {
          "icon-color": severityColor,
        },
      });
    }

    if (!map.getLayer(SELECTED_LAYER_ID)) {
      map.addLayer({
        id: SELECTED_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        filter: ["==", ["get", "id"], selectedId ?? ""],
        paint: {
          "circle-radius": 18,
          "circle-color": "#ffffff",
          "circle-opacity": 0.15,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
    }

    const stopPulse = startPulseAnimation(map, HALO_LAYER_ID, {
      minRadius: 12,
      maxRadius: 28,
      periodMs: 1100,
    });

    const onClick = (event: MapLayerMouseEvent): void => {
      const id = event.features?.[0]?.properties?.["id"];
      if (typeof id === "string" && id.length > 0) {
        onSelectRef.current?.(id);
      }
    };
    const onEnter = (): void => {
      map.getCanvas().style.cursor = "pointer";
    };
    const onLeave = (): void => {
      map.getCanvas().style.cursor = "";
    };

    map.on("click", PIN_LAYER_ID, onClick);
    map.on("mouseenter", PIN_LAYER_ID, onEnter);
    map.on("mouseleave", PIN_LAYER_ID, onLeave);

    return () => {
      stopPulse();
      map.off("click", PIN_LAYER_ID, onClick);
      map.off("mouseenter", PIN_LAYER_ID, onEnter);
      map.off("mouseleave", PIN_LAYER_ID, onLeave);
      removeLayerIfPresent(map, SELECTED_LAYER_ID);
      removeLayerIfPresent(map, PIN_LAYER_ID);
      removeLayerIfPresent(map, HALO_LAYER_ID);
      removeSourceIfPresent(map, SOURCE_ID);
    };
  }, [map, isLoaded, styleEpoch, selectedId, geojsonRef, onSelectRef]);

  useEffect(() => {
    if (!map || !isLoaded) {
      return;
    }
    getGeoJsonSource(map, SOURCE_ID)?.setData(geojson);
  }, [map, isLoaded, geojson]);

  useEffect(() => {
    if (!map || !isLoaded || !mapHasStyle(map) || !map.getLayer(SELECTED_LAYER_ID)) {
      return;
    }
    map.setFilter(SELECTED_LAYER_ID, ["==", ["get", "id"], selectedId ?? ""]);
  }, [map, isLoaded, selectedId]);

  return null;
}
