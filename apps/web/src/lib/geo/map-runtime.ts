// apps/web/src/lib/geo/map-runtime.ts
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";

export function mapHasStyle(map: MapLibreMap): boolean {
  try {
    return Boolean(map.getStyle());
  } catch {
    return false;
  }
}

export function removeLayerIfPresent(map: MapLibreMap, layerId: string): void {
  if (!mapHasStyle(map)) {
    return;
  }
  if (map.getLayer(layerId)) {
    map.removeLayer(layerId);
  }
}

export function removeSourceIfPresent(map: MapLibreMap, sourceId: string): void {
  if (!mapHasStyle(map)) {
    return;
  }
  if (map.getSource(sourceId)) {
    map.removeSource(sourceId);
  }
}

export function getGeoJsonSource(
  map: MapLibreMap,
  sourceId: string,
): GeoJSONSource | null {
  if (!mapHasStyle(map)) {
    return null;
  }
  const source = map.getSource(sourceId);
  if (!source || source.type !== "geojson") {
    return null;
  }
  return source as GeoJSONSource;
}

export function startPulseAnimation(
  map: MapLibreMap,
  layerId: string,
  options: { minRadius: number; maxRadius: number; periodMs?: number },
): () => void {
  const periodMs = options.periodMs ?? 1400;
  let frame = 0;

  const tick = (now: number): void => {
    if (!mapHasStyle(map) || !map.getLayer(layerId)) {
      return;
    }
    const phase = (now % periodMs) / periodMs;
    const wave = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
    map.setPaintProperty(
      layerId,
      "circle-radius",
      options.minRadius + (options.maxRadius - options.minRadius) * wave,
    );
    map.setPaintProperty(layerId, "circle-opacity", 0.55 * (1 - phase));
    frame = window.requestAnimationFrame(tick);
  };

  frame = window.requestAnimationFrame(tick);
  return () => {
    window.cancelAnimationFrame(frame);
  };
}
