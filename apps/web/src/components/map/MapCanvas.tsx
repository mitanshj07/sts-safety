// apps/web/src/components/map/MapCanvas.tsx
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  type LngLatLike,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { cn } from "@/lib/utils";
import { publicEnv } from "@/lib/config/public";
import { registerPmtilesProtocol } from "@/lib/geo/pmtiles";
import { resolveMapStyle } from "@/lib/geo/style";

export type MapContextValue = {
  map: MapLibreMap | null;
  loaded: boolean;
  isLoaded: boolean;
  styleEpoch: number;
};

const MapContext = createContext<MapContextValue>({
  map: null,
  loaded: false,
  isLoaded: false,
  styleEpoch: 0,
});

export function useMap(): MapContextValue {
  return useContext(MapContext);
}

export type MapCanvasProps = {
  initialCenter?: [number, number];
  initialZoom?: number;
  children?: ReactNode;
  onMapLoad?: (map: MapLibreMap) => void;
  className?: string;
  cooperativeGestures?: boolean;
};

export function MapCanvas({
  initialCenter = publicEnv.mapDefaultCenter,
  initialZoom = publicEnv.mapDefaultZoom,
  children,
  onMapLoad,
  className,
  cooperativeGestures = false,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onMapLoadRef = useRef(onMapLoad);
  const initialsRef = useRef({
    center: initialCenter,
    zoom: initialZoom,
    cooperativeGestures,
  });

  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [styleEpoch, setStyleEpoch] = useState(0);

  onMapLoadRef.current = onMapLoad;

  useEffect(() => {
    const node = containerRef.current;
    if (!node || mapRef.current) {
      return;
    }

    const resolved = resolveMapStyle();
    if (resolved.usesPmtiles) {
      registerPmtilesProtocol();
    }

    let cancelled = false;
    let instance: MapLibreMap | null = null;
    let fallbackStage = 0;
    let hasFiredLoad = false;

    const applyFallback = (): void => {
      if (!instance || hasFiredLoad) {
        return;
      }
      if (fallbackStage === 0) {
        fallbackStage = 1;
        instance.setStyle(resolved.fallbackUrl);
        return;
      }
      if (fallbackStage === 1) {
        fallbackStage = 2;
        instance.setStyle(resolved.empty);
      }
    };

    const frame = window.requestAnimationFrame(() => {
      if (cancelled || !containerRef.current) {
        return;
      }

      instance = new MapLibreMap({
        container: containerRef.current,
        style: resolved.primary,
        center: initialsRef.current.center as LngLatLike,
        zoom: initialsRef.current.zoom,
        attributionControl: { compact: true },
        cooperativeGestures: initialsRef.current.cooperativeGestures,
      });
      mapRef.current = instance;

      instance.addControl(
        new NavigationControl({ showCompass: false, visualizePitch: false }),
        "top-right",
      );

      instance.on("style.load", () => {
        if (cancelled || !instance) {
          return;
        }
        setMap(instance);
        setLoaded(true);
        setStyleEpoch((epoch) => epoch + 1);
      });

      instance.once("load", () => {
        if (cancelled || !instance) {
          return;
        }
        hasFiredLoad = true;
        onMapLoadRef.current?.(instance);
      });

      instance.on("error", (event: { error: { message: string } }) => {
        if (cancelled || hasFiredLoad) {
          return;
        }
        if (/style|failed to fetch|404|network/i.test(event.error.message)) {
          applyFallback();
        }
      });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      setLoaded(false);
      setMap(null);
      instance?.remove();
      mapRef.current = null;
    };
  }, []);

  const contextValue = useMemo<MapContextValue>(
    () => ({ map, loaded, isLoaded: loaded, styleEpoch }),
    [map, loaded, styleEpoch],
  );

  return (
    <div className={cn("sts-map-canvas relative h-full min-h-[24rem] w-full", className)}>
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />
      <MapContext.Provider value={contextValue}>
        <div className="pointer-events-none absolute inset-0 z-10">{children}</div>
      </MapContext.Provider>
    </div>
  );
}
