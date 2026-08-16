// apps/web/src/components/map/ZoneLayer.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { Popup, type MapLayerMouseEvent, type Map as MapLibreMap } from "maplibre-gl";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";

import { useMap } from "@/components/map/MapCanvas";
import { riskFillColor, ZONE_FILL_OPACITY } from "@/lib/geo/colors";
import {
  getGeoJsonSource,
  mapHasStyle,
  removeLayerIfPresent,
  removeSourceIfPresent,
} from "@/lib/geo/map-runtime";
import { parseZones, zoneInputSchema, type ZoneInput } from "@/lib/geo/schemas";

const SOURCE_ID = "sts-zones";
const FILL_LAYER_ID = "sts-zones-fill";
const LINE_LAYER_ID = "sts-zones-line";

type MapZoneProperties = {
  id: string;
  name: string;
  category: string;
  risk_level: string;
  advisory: string;
};

type ZoneFeature = Feature<Polygon | MultiPolygon, MapZoneProperties>;

export type ZoneLayerProps = {
  zones:
    | readonly ZoneInput[]
    | {
        type: "FeatureCollection";
        features: ReadonlyArray<Feature<Polygon | MultiPolygon>>;
      };
};

function isFeatureCollection(
  zones: ZoneLayerProps["zones"],
): zones is {
  type: "FeatureCollection";
  features: ReadonlyArray<Feature<Polygon | MultiPolygon>>;
} {
  return (
    typeof zones === "object" &&
    zones !== null &&
    "type" in zones &&
    zones.type === "FeatureCollection" &&
    "features" in zones
  );
}

function toZoneInput(raw: unknown): ZoneInput | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const rec = raw as Record<string, unknown>;
  const parsed = zoneInputSchema.safeParse({
    ...rec,
    advisory:
      rec["advisory"] ?? rec["advisory_text"] ?? null,
    geometry: rec["geometry"] ?? rec["geom"],
  });
  return parsed.success ? parsed.data : null;
}

function buildCollection(
  zones: ZoneLayerProps["zones"],
): FeatureCollection<Polygon | MultiPolygon, MapZoneProperties> {
  const inputs: ZoneInput[] = isFeatureCollection(zones)
    ? zones.features.flatMap((feature) => {
        const mapped = toZoneInput({
          ...(feature.properties ?? {}),
          id: feature.properties?.["id"] ?? feature.id,
          geometry: feature.geometry,
        });
        return mapped ? [mapped] : [];
      })
    : parseZones(zones);

  const features: ZoneFeature[] = inputs.map((zone) => ({
    type: "Feature",
    id: zone.id,
    geometry: zone.geometry,
    properties: {
      id: zone.id,
      name: zone.name,
      category: zone.category,
      risk_level: zone.risk_level,
      advisory: zone.advisory ?? "",
    },
  }));
  return { type: "FeatureCollection", features };
}

function popupNode(properties: MapZoneProperties): HTMLDivElement {
  const root = document.createElement("div");
  root.style.display = "grid";
  root.style.gap = "0.35rem";
  root.style.minWidth = "12rem";

  const name = document.createElement("p");
  name.textContent = properties.name;
  name.style.margin = "0";
  name.style.fontWeight = "600";
  name.style.fontSize = "0.9rem";

  const category = document.createElement("p");
  category.textContent = properties.category.replaceAll("_", " ");
  category.style.margin = "0";
  category.style.fontSize = "0.75rem";
  category.style.textTransform = "capitalize";
  category.style.opacity = "0.75";

  root.append(name, category);

  if (properties.advisory) {
    const advisory = document.createElement("p");
    advisory.textContent = properties.advisory;
    advisory.style.margin = "0";
    advisory.style.fontSize = "0.8rem";
    advisory.style.lineHeight = "1.35";
    root.append(advisory);
  }

  return root;
}

function bindPointer(map: MapLibreMap, layerId: string): () => void {
  const onEnter = (): void => {
    map.getCanvas().style.cursor = "pointer";
  };
  const onLeave = (): void => {
    map.getCanvas().style.cursor = "";
  };
  map.on("mouseenter", layerId, onEnter);
  map.on("mouseleave", layerId, onLeave);
  return () => {
    map.off("mouseenter", layerId, onEnter);
    map.off("mouseleave", layerId, onLeave);
  };
}

export function ZoneLayer({ zones }: ZoneLayerProps) {
  const { map, isLoaded, styleEpoch } = useMap();
  const popupRef = useRef<Popup | null>(null);

  const geojson = useMemo(() => buildCollection(zones), [zones]);
  const geojsonRef = useRef(geojson);
  geojsonRef.current = geojson;

  useEffect(() => {
    if (!map || !isLoaded || !mapHasStyle(map)) {
      return;
    }

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: "geojson", data: geojsonRef.current });
    }

    if (!map.getLayer(FILL_LAYER_ID)) {
      map.addLayer({
        id: FILL_LAYER_ID,
        type: "fill",
        source: SOURCE_ID,
        paint: {
          "fill-color": riskFillColor,
          "fill-opacity": ZONE_FILL_OPACITY,
        },
      });
    }

    if (!map.getLayer(LINE_LAYER_ID)) {
      map.addLayer({
        id: LINE_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        paint: {
          "line-color": riskFillColor,
          "line-width": 1.6,
          "line-opacity": 0.9,
        },
      });
    }

    const popup = new Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: "280px",
    });
    popupRef.current = popup;

    const onClick = (event: MapLayerMouseEvent): void => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type === "GeometryCollection") {
        return;
      }
      const properties: MapZoneProperties = {
        id: String(feature.properties?.["id"] ?? ""),
        name: String(feature.properties?.["name"] ?? "Zone"),
        category: String(feature.properties?.["category"] ?? ""),
        risk_level: String(feature.properties?.["risk_level"] ?? "none"),
        advisory: String(feature.properties?.["advisory"] ?? ""),
      };
      popup.setLngLat(event.lngLat).setDOMContent(popupNode(properties)).addTo(map);
    };

    map.on("click", FILL_LAYER_ID, onClick);
    const unbindFill = bindPointer(map, FILL_LAYER_ID);
    const unbindLine = bindPointer(map, LINE_LAYER_ID);

    return () => {
      popup.remove();
      popupRef.current = null;
      map.off("click", FILL_LAYER_ID, onClick);
      unbindFill();
      unbindLine();
      removeLayerIfPresent(map, LINE_LAYER_ID);
      removeLayerIfPresent(map, FILL_LAYER_ID);
      removeSourceIfPresent(map, SOURCE_ID);
    };
  }, [map, isLoaded, styleEpoch]);

  useEffect(() => {
    if (!map || !isLoaded) {
      return;
    }
    getGeoJsonSource(map, SOURCE_ID)?.setData(geojson);
  }, [map, isLoaded, geojson]);

  return null;
}
