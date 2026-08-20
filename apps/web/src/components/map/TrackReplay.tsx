// apps/web/src/components/map/TrackReplay.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import { Pause, Play } from "lucide-react";

import { useMap } from "@/components/map/MapCanvas";
import { Button } from "@/components/ui/button";
import { useLatestRef } from "@/hooks/useLatestRef";
import {
  getGeoJsonSource,
  mapHasStyle,
  removeLayerIfPresent,
  removeSourceIfPresent,
} from "@/lib/geo/map-runtime";
import { lngLatSchema, trackInputSchema } from "@/lib/geo/schemas";

const LINE_SOURCE_ID = "sts-track-line";
const DOT_SOURCE_ID = "sts-track-dot";
const LINE_LAYER_ID = "sts-track-stroke";
const DOT_LAYER_ID = "sts-track-dot";
const DOT_HALO_LAYER_ID = "sts-track-dot-halo";

export type TrackReplayProps = {
  coordinates: [number, number][];
  times?: Array<number | string>;
  autoPlay?: boolean;
  onTimeChange?: (index: number, coord: [number, number]) => void;
};

function toEpochMs(value: number | string): number {
  if (typeof value === "number") {
    return value < 1e12 ? value * 1000 : value;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function syntheticTimes(count: number): number[] {
  const start = Date.now() - count * 60_000;
  return Array.from({ length: count }, (_, index) => start + index * 60_000);
}

function positionAt(
  coordinates: [number, number][],
  times: number[],
  fraction: number,
): { coord: [number, number]; index: number } {
  const first = coordinates[0] ?? [91.7362, 26.1445];
  if (coordinates.length < 2 || times.length < 2) {
    return { coord: first, index: 0 };
  }
  const start = times[0] ?? 0;
  const end = times[times.length - 1] ?? start + 1;
  const target = start + (end - start) * Math.min(1, Math.max(0, fraction));

  for (let i = 0; i < times.length - 1; i += 1) {
    const t0 = times[i] ?? start;
    const t1 = times[i + 1] ?? end;
    if (target <= t1 || i === times.length - 2) {
      const span = Math.max(1, t1 - t0);
      const local = (target - t0) / span;
      const a = coordinates[i] ?? first;
      const b = coordinates[i + 1] ?? a;
      return {
        index: i,
        coord: [a[0] + (b[0] - a[0]) * local, a[1] + (b[1] - a[1]) * local],
      };
    }
  }
  return { coord: coordinates[coordinates.length - 1] ?? first, index: coordinates.length - 1 };
}

function lineCollection(
  coordinates: [number, number][],
): FeatureCollection<LineString> {
  const feature: Feature<LineString> = {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates },
  };
  return { type: "FeatureCollection", features: [feature] };
}

function pointCollection(coord: [number, number]): FeatureCollection<Point> {
  const feature: Feature<Point> = {
    type: "Feature",
    properties: {},
    geometry: { type: "Point", coordinates: coord },
  };
  return { type: "FeatureCollection", features: [feature] };
}

export function TrackReplay({
  coordinates,
  times,
  autoPlay = false,
  onTimeChange,
}: TrackReplayProps) {
  const { map, isLoaded, styleEpoch } = useMap();
  const onTimeChangeRef = useLatestRef(onTimeChange);

  const parsed = useMemo(
    () => trackInputSchema.safeParse({ coordinates, times }),
    [coordinates, times],
  );

  const track = useMemo(() => {
    const coords = (parsed.success ? parsed.data.coordinates : coordinates).flatMap(
      (pair) => {
        const checked = lngLatSchema.safeParse(pair);
        return checked.success ? [checked.data] : [];
      },
    );
    const rawTimes = parsed.success ? parsed.data.times : times;
    const epochs =
      rawTimes && rawTimes.length === coords.length
        ? rawTimes.map(toEpochMs)
        : syntheticTimes(coords.length);
    return { coords, epochs };
  }, [parsed, coordinates, times]);

  const [fraction, setFraction] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const fractionRef = useRef(0);

  const lineGeojson = useMemo(() => lineCollection(track.coords), [track.coords]);
  const cursor = useMemo(
    () => positionAt(track.coords, track.epochs, fraction),
    [track, fraction],
  );
  const dotGeojson = useMemo(() => pointCollection(cursor.coord), [cursor.coord]);

  useEffect(() => {
    onTimeChangeRef.current?.(cursor.index, cursor.coord);
  }, [cursor, onTimeChangeRef]);

  useEffect(() => {
    if (!playing || track.coords.length < 2) {
      return;
    }
    let frame = 0;
    let last = performance.now();
    const tick = (now: number): void => {
      const dt = (now - last) / 12_000;
      last = now;
      const next = fractionRef.current + dt;
      if (next >= 1) {
        fractionRef.current = 1;
        setFraction(1);
        setPlaying(false);
        return;
      }
      fractionRef.current = next;
      setFraction(next);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [playing, track.coords.length]);

  useEffect(() => {
    if (!map || !isLoaded || !mapHasStyle(map) || track.coords.length < 2) {
      return;
    }

    if (!map.getSource(LINE_SOURCE_ID)) {
      map.addSource(LINE_SOURCE_ID, { type: "geojson", data: lineGeojson });
    }
    if (!map.getSource(DOT_SOURCE_ID)) {
      map.addSource(DOT_SOURCE_ID, { type: "geojson", data: dotGeojson });
    }
    if (!map.getLayer(LINE_LAYER_ID)) {
      map.addLayer({
        id: LINE_LAYER_ID,
        type: "line",
        source: LINE_SOURCE_ID,
        paint: {
          "line-color": "#38bdf8",
          "line-width": 3,
          "line-opacity": 0.9,
        },
      });
    }
    if (!map.getLayer(DOT_HALO_LAYER_ID)) {
      map.addLayer({
        id: DOT_HALO_LAYER_ID,
        type: "circle",
        source: DOT_SOURCE_ID,
        paint: {
          "circle-radius": 14,
          "circle-color": "#38bdf8",
          "circle-opacity": 0.25,
        },
      });
    }
    if (!map.getLayer(DOT_LAYER_ID)) {
      map.addLayer({
        id: DOT_LAYER_ID,
        type: "circle",
        source: DOT_SOURCE_ID,
        paint: {
          "circle-radius": 7,
          "circle-color": "#38bdf8",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ecfeff",
        },
      });
    }

    return () => {
      removeLayerIfPresent(map, DOT_LAYER_ID);
      removeLayerIfPresent(map, DOT_HALO_LAYER_ID);
      removeLayerIfPresent(map, LINE_LAYER_ID);
      removeSourceIfPresent(map, DOT_SOURCE_ID);
      removeSourceIfPresent(map, LINE_SOURCE_ID);
    };
  }, [map, isLoaded, styleEpoch, track.coords.length, lineGeojson, dotGeojson]);

  useEffect(() => {
    if (!map || !isLoaded) {
      return;
    }
    getGeoJsonSource(map, LINE_SOURCE_ID)?.setData(lineGeojson);
    getGeoJsonSource(map, DOT_SOURCE_ID)?.setData(dotGeojson);
  }, [map, isLoaded, lineGeojson, dotGeojson]);

  if (track.coords.length < 2) {
    return null;
  }

  const start = track.epochs[0] ?? 0;
  const end = track.epochs[track.epochs.length - 1] ?? start;
  const at = start + (end - start) * fraction;

  return (
    <div className="pointer-events-auto absolute inset-x-3 bottom-3 z-20 flex items-center gap-3 border border-border bg-surface/95 px-3 py-2 shadow-sm">
      <Button
        type="button"
        size="icon-sm"
        variant="secondary"
        aria-label={playing ? "Pause track replay" : "Play track replay"}
        onClick={() => {
          if (fractionRef.current >= 1) {
            fractionRef.current = 0;
            setFraction(0);
          }
          setPlaying((value) => !value);
        }}
      >
        {playing ? <Pause /> : <Play />}
      </Button>
      <input
        type="range"
        min={0}
        max={1000}
        value={Math.round(fraction * 1000)}
        aria-label="Track time"
        className="h-1.5 w-full cursor-pointer appearance-none bg-muted accent-[var(--brand)]"
        onChange={(event) => {
          const next = Number(event.target.value) / 1000;
          fractionRef.current = next;
          setFraction(next);
          setPlaying(false);
        }}
      />
      <p className="shrink-0 font-mono text-[11px] text-muted-foreground">
        {new Date(at).toLocaleTimeString("en-IN", { hour12: false })}
      </p>
    </div>
  );
}
