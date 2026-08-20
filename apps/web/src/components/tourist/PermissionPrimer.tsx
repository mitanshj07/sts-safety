// apps/web/src/components/tourist/PermissionPrimer.tsx
"use client";

import { useTouristRuntime } from "@/components/tourist/TouristProvider";
import { Button } from "@/components/ui/button";

export function PermissionPrimer() {
  const { permissions, setPermissions } = useTouristRuntime();
  if (permissions.location) return null;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-background/85 p-4">
      <div className="w-full max-w-md border border-border bg-surface p-6 shadow-md">
        <p className="sts-kicker">Before you walk</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight">Enable location</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Restricted-zone warnings fire on this device before the server round-trip. Location stays
          in a local queue when you are offline. Your name and KYC never go on-chain.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          <li>GPS is used for geofence warnings and SOS coordinates.</li>
          <li>Notifications are optional.</li>
          <li>You can revoke either permission in the browser settings.</li>
        </ul>
        <div className="mt-5 flex flex-col gap-2">
          <Button
            type="button"
            className="min-h-11"
            onClick={() => setPermissions({ location: true, notifications: false })}
          >
            Enable location
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => setPermissions({ location: true, notifications: true })}
          >
            Location + alerts
          </Button>
        </div>
      </div>
    </div>
  );
}
