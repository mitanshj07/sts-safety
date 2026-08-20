// apps/web/src/components/map/MapFoundationPreview.tsx
"use client";

import { useState } from "react";
import type { Feature, Polygon } from "geojson";

import { IncidentLayer } from "@/components/map/IncidentLayer";
import { MapCanvas } from "@/components/map/MapCanvas";
import { TrackReplay } from "@/components/map/TrackReplay";
import { TouristLayer } from "@/components/map/TouristLayer";
import { ZoneDrawEditor } from "@/components/map/ZoneDrawEditor";
import { ZoneLayer } from "@/components/map/ZoneLayer";
import {
  SAMPLE_INCIDENTS,
  SAMPLE_TOURISTS,
  SAMPLE_TRACK,
  SAMPLE_ZONES,
} from "@/components/map/fixtures";

export function MapFoundationPreview() {
  const [selectedIncident, setSelectedIncident] = useState<string | null>(
    SAMPLE_INCIDENTS[0]?.id ?? null,
  );
  const [drawn, setDrawn] = useState<Feature<Polygon> | null>(null);

  return (
    <div className="flex h-full min-h-[28rem] flex-col gap-2">
      <MapCanvas
        initialCenter={[91.7362, 26.1445]}
        initialZoom={12}
        cooperativeGestures
        className="min-h-[28rem] overflow-hidden border border-border"
      >
        <ZoneLayer zones={SAMPLE_ZONES} />
        <TouristLayer tourists={SAMPLE_TOURISTS} />
        <IncidentLayer
          incidents={SAMPLE_INCIDENTS}
          selectedId={selectedIncident}
          onSelect={setSelectedIncident}
        />
        <TrackReplay coordinates={SAMPLE_TRACK} />
        <ZoneDrawEditor
          onComplete={(feature) => {
            setDrawn(feature);
          }}
        />
      </MapCanvas>
      <p className="text-xs text-muted-foreground">
        Guwahati city centre (slate), Jorabat checkpoint (emerald), tourists
        clustered above 50, red halo when safety score &lt; 40.
        {drawn
          ? ` Last drawn polygon has ${drawn.geometry.coordinates[0]?.length ?? 0} vertices.`
          : " Draw a polygon or circle to emit GeoJSON."}
      </p>
    </div>
  );
}
