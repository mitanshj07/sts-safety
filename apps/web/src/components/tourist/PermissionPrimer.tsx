// apps/web/src/components/tourist/PermissionPrimer.tsx
"use client";

import { useTouristRuntime } from "@/components/tourist/TouristProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PermissionPrimer() {
  const { permissions, setPermissions } = useTouristRuntime();
  if (permissions.location) return null;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-background/80 p-4 backdrop-blur-sm">
      <Card className="max-w-md shadow-lg">
        <CardHeader>
          <p className="sts-kicker">Consent</p>
          <CardTitle className="mt-1">Enable safety tracking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            This app warns you before the server round-trip when you walk into a
            restricted North-East zone. Location stays on your device queue when
            you are offline. Your name and KYC never go on-chain — only a keccak256
            commitment.
          </p>
          <ul className="list-disc space-y-1 pl-4">
            <li>GPS is used for geofence warnings and SOS coordinates.</li>
            <li>Notifications are optional (Web Push / VAPID, no vendor).</li>
            <li>You can revoke either permission in the browser settings.</li>
          </ul>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="button"
              onClick={() => setPermissions({ location: true, notifications: false })}
            >
              Enable location
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPermissions({ location: true, notifications: true })}
            >
              Location + alerts
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
