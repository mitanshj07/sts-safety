"use client";

import dynamic from "next/dynamic";

function MapFallback({ className }: { className?: string }) {
  return (
    <div
      className={className}
      style={{ minHeight: "24rem" }}
      aria-hidden
    >
      <div className="h-full min-h-[24rem] animate-pulse bg-muted" />
    </div>
  );
}

export const MapCanvas = dynamic(
  () => import("@/components/map/MapCanvas").then((mod) => mod.MapCanvas),
  {
    ssr: false,
    loading: () => <MapFallback className="h-full min-h-[24rem] w-full" />,
  },
);

export const ZoneLayer = dynamic(
  () => import("@/components/map/ZoneLayer").then((mod) => mod.ZoneLayer),
  { ssr: false },
);

export const TouristLayer = dynamic(
  () => import("@/components/map/TouristLayer").then((mod) => mod.TouristLayer),
  { ssr: false },
);

export const IncidentLayer = dynamic(
  () => import("@/components/map/IncidentLayer").then((mod) => mod.IncidentLayer),
  { ssr: false },
);

export const MapFlyTo = dynamic(
  () => import("@/components/command/MapFlyTo").then((mod) => mod.MapFlyTo),
  { ssr: false },
);

export const TrackReplay = dynamic(
  () => import("@/components/map/TrackReplay").then((mod) => mod.TrackReplay),
  { ssr: false },
);

export const ResponderLayer = dynamic(
  () => import("@/components/map/ResponderLayer").then((mod) => mod.ResponderLayer),
  { ssr: false },
);

export const ZoneDrawEditor = dynamic(
  () => import("@/components/map/ZoneDrawEditor").then((mod) => mod.ZoneDrawEditor),
  { ssr: false },
);
