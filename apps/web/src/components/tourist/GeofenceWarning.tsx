// apps/web/src/components/tourist/GeofenceWarning.tsx
"use client";

import { useTouristRuntime } from "@/components/tourist/TouristProvider";
import { Button } from "@/components/ui/button";
import { RISK_BANNER, RISK_LABEL } from "@/lib/geo/risk-colors";
import { cn } from "@/lib/utils";

export function GeofenceWarning() {
  const { warning, dismissWarning } = useTouristRuntime();
  if (!warning) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "fixed inset-x-3 top-3 z-[60] border p-4 shadow-md",
        RISK_BANNER[warning.risk_level],
      )}
    >
      <p className="sts-kicker text-current">{RISK_LABEL[warning.risk_level]}</p>
      <h2 className="mt-1 text-lg font-semibold tracking-tight">{warning.name}</h2>
      <p className="mt-1 text-sm leading-relaxed">
        {warning.advisory_text ??
          `You entered a ${warning.category.replaceAll("_", " ")} zone (${warning.risk_level} risk).`}
      </p>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="mt-3 min-h-11"
        onClick={dismissWarning}
      >
        I understand
      </Button>
    </div>
  );
}
