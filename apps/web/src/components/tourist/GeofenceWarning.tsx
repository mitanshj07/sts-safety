// apps/web/src/components/tourist/GeofenceWarning.tsx
"use client";

import { useTouristRuntime } from "@/components/tourist/TouristProvider";
import { Button } from "@/components/ui/button";
import { RISK_BANNER } from "@/lib/geo/risk-colors";
import { cn } from "@/lib/utils";

export function GeofenceWarning() {
  const { warning, dismissWarning } = useTouristRuntime();
  if (!warning) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "fixed inset-x-3 top-3 z-50 rounded-2xl border border-white/10 p-4 shadow-2xl backdrop-blur-sm",
        RISK_BANNER[warning.risk_level],
      )}
    >
      <p className="text-xs tracking-widest uppercase opacity-80">Geofence warning</p>
      <h2 className="mt-1 text-lg font-semibold">{warning.name}</h2>
      <p className="mt-1 text-sm opacity-90">
        {warning.advisory_text ??
          `You entered a ${warning.category.replaceAll("_", " ")} zone (${warning.risk_level} risk).`}
      </p>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="mt-3"
        onClick={dismissWarning}
      >
        I understand
      </Button>
    </div>
  );
}
