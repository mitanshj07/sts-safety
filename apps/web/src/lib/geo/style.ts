// apps/web/src/lib/geo/style.ts
import type { StyleSpecification } from "maplibre-gl";

import { mapTileMode, publicEnv, type MapTileMode } from "@/lib/config/public";
import { resolvePublicUrl } from "@/lib/geo/map-env";

/** Fully local basemap — no glyphs, no remote tiles. Used offline. */
export const LOCAL_GEOJSON_STYLE: StyleSpecification = {
  version: 8,
  name: "sts-local-geojson",
  sources: {
    outline: {
      type: "geojson",
      data: "/offline/northeast-outline.geojson",
    },
    zones: {
      type: "geojson",
      data: "/offline/zones.geojson",
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#1c1917" },
    },
    {
      id: "ne-fill",
      type: "fill",
      source: "outline",
      paint: { "fill-color": "#292524", "fill-opacity": 0.95 },
    },
    {
      id: "ne-line",
      type: "line",
      source: "outline",
      paint: { "line-color": "#a8a29e", "line-width": 1.2 },
    },
    {
      id: "zone-fill",
      type: "fill",
      source: "zones",
      paint: {
        "fill-color": [
          "match",
          ["get", "risk_level"],
          "critical",
          "#7f1d1d",
          "high",
          "#9a3412",
          "medium",
          "#854d0e",
          "low",
          "#14532d",
          "#1e3a5f",
        ],
        "fill-opacity": 0.35,
      },
    },
    {
      id: "zone-line",
      type: "line",
      source: "zones",
      paint: { "line-color": "#e7e5e4", "line-width": 1 },
    },
  ],
};

export const EMPTY_BASEMAP_STYLE: StyleSpecification = LOCAL_GEOJSON_STYLE;

export function buildPmtilesStyle(pmtilesHref: string): StyleSpecification {
  return {
    version: 8,
    name: "sts-pmtiles-local",
    sources: {
      osm: {
        type: "vector",
        url: `pmtiles://${pmtilesHref}`,
        attribution: "© OpenStreetMap contributors",
      },
      outline: {
        type: "geojson",
        data: "/offline/northeast-outline.geojson",
      },
      zones: {
        type: "geojson",
        data: "/offline/zones.geojson",
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#1c1917" },
      },
      {
        id: "osm-fill",
        type: "fill",
        source: "osm",
        "source-layer": "osm",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "fill-color": [
            "case",
            ["in", ["get", "natural"], ["literal", ["water", "bay", "strait"]]],
            "#1e3a5f",
            ["has", "building"],
            "#44403c",
            "#292524",
          ],
          "fill-opacity": 0.9,
        },
      },
      {
        id: "osm-line",
        type: "line",
        source: "osm",
        "source-layer": "osm",
        filter: ["==", ["geometry-type"], "LineString"],
        paint: {
          "line-color": [
            "case",
            ["has", "highway"],
            "#a8a29e",
            ["==", ["get", "waterway"], "river"],
            "#1e3a5f",
            "#57534e",
          ],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            6,
            0.35,
            14,
            1.6,
          ],
        },
      },
      {
        id: "ne-line",
        type: "line",
        source: "outline",
        paint: { "line-color": "#a8a29e", "line-width": 1.2 },
      },
    ],
  };
}

export type ResolvedMapStyle = {
  mode: MapTileMode;
  usesPmtiles: boolean;
  primary: string | StyleSpecification;
  fallbackUrl: string | StyleSpecification;
  empty: StyleSpecification;
};

export function resolveMapStyle(): ResolvedMapStyle {
  const mode = mapTileMode();
  const usesPmtiles = mode === "pmtiles-local" || mode === "protomaps";

  if (usesPmtiles) {
    return {
      mode,
      usesPmtiles,
      primary: buildPmtilesStyle(resolvePublicUrl(publicEnv.pmtilesUrl)),
      fallbackUrl: LOCAL_GEOJSON_STYLE,
      empty: LOCAL_GEOJSON_STYLE,
    };
  }

  return {
    mode,
    usesPmtiles,
    primary: publicEnv.mapStyleUrl,
    fallbackUrl: publicEnv.mapStyleFallback,
    empty: LOCAL_GEOJSON_STYLE,
  };
}
