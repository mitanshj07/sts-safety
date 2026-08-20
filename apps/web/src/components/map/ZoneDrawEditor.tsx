// apps/web/src/components/map/ZoneDrawEditor.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { Feature, Polygon } from "geojson";
import {
  TerraDraw,
  TerraDrawCircleMode,
  TerraDrawPolygonMode,
} from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import { Circle, Pentagon, Trash2 } from "lucide-react";

import { useMap } from "@/components/map/MapCanvas";
import { Button } from "@/components/ui/button";
import { useLatestRef } from "@/hooks/useLatestRef";
import { mapHasStyle } from "@/lib/geo/map-runtime";
import { polygonGeometrySchema } from "@/lib/geo/schemas";

export type DrawTool = "polygon" | "circle";

export type ZoneDrawEditorProps = {
  enabled?: boolean;
  initialMode?: DrawTool;
  onComplete: (feature: Feature<Polygon>) => void;
};

export function ZoneDrawEditor({
  enabled = true,
  initialMode = "polygon",
  onComplete,
}: ZoneDrawEditorProps) {
  const { map, isLoaded, styleEpoch } = useMap();
  const drawRef = useRef<TerraDraw | null>(null);
  const onCompleteRef = useLatestRef(onComplete);
  const [mode, setMode] = useState<DrawTool>(initialMode);

  useEffect(() => {
    if (!enabled || !map || !isLoaded || !mapHasStyle(map)) {
      return;
    }

    const draw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map }),
      modes: [new TerraDrawPolygonMode(), new TerraDrawCircleMode()],
    });
    drawRef.current = draw;
    draw.start();
    draw.setMode(initialMode);

    const onFinish = (id: string | number, context: { action: string; mode: string }): void => {
      if (context.action !== "draw") {
        return;
      }
      const snapshot = draw.getSnapshotFeature(id);
      if (!snapshot) {
        return;
      }
      const geometry = polygonGeometrySchema.safeParse(snapshot.geometry);
      if (!geometry.success) {
        return;
      }
      const feature: Feature<Polygon> = {
        type: "Feature",
        id: String(id),
        properties: {
          source: "terra-draw",
          mode: context.mode,
        },
        geometry: geometry.data,
      };
      onCompleteRef.current(feature);
    };

    draw.on("finish", onFinish);

    return () => {
      try {
        draw.off("finish", onFinish);
      } catch {
        // MapLibre adapter already detached with the map.
      }
      try {
        draw.stop();
      } catch {
        // Style/sources are gone on unmount; Terra Draw still calls getSource.
      }
      drawRef.current = null;
    };
  }, [enabled, map, isLoaded, styleEpoch, initialMode, onCompleteRef]);

  useEffect(() => {
    drawRef.current?.setMode(mode);
  }, [mode]);

  if (!enabled) {
    return null;
  }

  return (
    <div className="pointer-events-auto absolute top-3 left-3 z-20 flex gap-1 rounded-lg border border-border bg-card/90 p-1 shadow-lg backdrop-blur">
      <Button
        type="button"
        size="sm"
        variant={mode === "polygon" ? "default" : "ghost"}
        onClick={() => {
          setMode("polygon");
          drawRef.current?.setMode("polygon");
        }}
      >
        <Pentagon />
        Polygon
      </Button>
      <Button
        type="button"
        size="sm"
        variant={mode === "circle" ? "default" : "ghost"}
        onClick={() => {
          setMode("circle");
          drawRef.current?.setMode("circle");
        }}
      >
        <Circle />
        Circle
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => drawRef.current?.clear()}
      >
        <Trash2 />
        Clear
      </Button>
    </div>
  );
}
