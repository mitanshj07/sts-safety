// apps/web/src/components/map/MapFoundationPreviewLazy.tsx
"use client";

import dynamic from "next/dynamic";

export const MapFoundationPreviewLazy = dynamic(
  () =>
    import("@/components/map/MapFoundationPreview").then(
      (mod) => mod.MapFoundationPreview,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[min(70vh,640px)] animate-pulse rounded-xl bg-muted" />
    ),
  },
);
