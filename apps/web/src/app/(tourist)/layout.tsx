// apps/web/src/app/(tourist)/layout.tsx
import type { ReactNode } from "react";

import { BottomNav } from "@/components/tourist/BottomNav";
import { GeofenceWarning } from "@/components/tourist/GeofenceWarning";
import { PermissionPrimer } from "@/components/tourist/PermissionPrimer";
import { ServiceWorkerRegistrar } from "@/components/tourist/ServiceWorkerRegistrar";
import { TouristProvider } from "@/components/tourist/TouristProvider";
import { TouristTopBar } from "@/components/tourist/TouristTopBar";
import { Toaster } from "@/components/ui/sonner";
import { requireRolePage } from "@/lib/auth/guards";

export default async function TouristLayout({ children }: { children: ReactNode }) {
  await requireRolePage("tourist");
  return (
    <TouristProvider>
      <div className="tourist-theme min-h-dvh bg-background text-foreground">
        <ServiceWorkerRegistrar />
        <PermissionPrimer />
        <GeofenceWarning />
        <TouristTopBar />
        <div id="main" className="pb-24">
          {children}
        </div>
        <BottomNav />
        <Toaster theme="light" />
      </div>
    </TouristProvider>
  );
}
