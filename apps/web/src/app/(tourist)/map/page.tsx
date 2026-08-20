// apps/web/src/app/(tourist)/map/page.tsx
"use client";

import dynamic from "next/dynamic";
import { StatusPills } from "@/components/tourist/StatusPills";
import { useTouristRuntime } from "@/components/tourist/TouristProvider";
import { zoneCollectionToInputs } from "@/lib/tourist/zone-inputs";

const MapCanvas = dynamic(
  () => import("@/components/map/MapCanvas").then((m) => m.MapCanvas),
  {
    ssr: false,
    loading: () => <div className="h-full min-h-[24rem] animate-pulse bg-muted" />,
  },
);
const ZoneLayer = dynamic(
  () => import("@/components/map/ZoneLayer").then((m) => m.ZoneLayer),
  { ssr: false },
);
const SelfMarker = dynamic(
  () => import("@/components/map/SelfMarker").then((m) => m.SelfMarker),
  { ssr: false },
);
const CorridorLayer = dynamic(
  () => import("@/components/map/CorridorLayer").then((m) => m.CorridorLayer),
  { ssr: false },
);

export default function TouristMapPage() {
  const { zones, lastFix, itinerary } = useTouristRuntime();
  const center: [number, number] | undefined = lastFix
    ? [lastFix.lon, lastFix.lat]
    : itinerary?.geometry.coordinates[0]
      ? [
          itinerary.geometry.coordinates[0][0] ?? 91.7362,
          itinerary.geometry.coordinates[0][1] ?? 26.1445,
        ]
      : undefined;

  return (
    <main className="relative h-[calc(100dvh-5rem)]">
      <div className="pointer-events-none absolute top-3 left-3 z-10">
        <div className="pointer-events-auto border border-border bg-surface/95 p-3 shadow-sm">
          <StatusPills />
        </div>
      </div>
      <MapCanvas initialCenter={center} initialZoom={lastFix ? 12 : 7} className="h-full w-full">
        <ZoneLayer zones={zoneCollectionToInputs(zones)} />
        <CorridorLayer itinerary={itinerary} />
        <SelfMarker fix={lastFix} />
      </MapCanvas>
    </main>
  );
}
