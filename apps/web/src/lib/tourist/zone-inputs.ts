// apps/web/src/lib/tourist/zone-inputs.ts
import { parseZones, type ZoneInput } from "@/lib/geo/schemas";
import type { ZoneCollection } from "@/lib/offline/db";

export function zoneCollectionToInputs(zones: ZoneCollection): ZoneInput[] {
  return parseZones(
    zones.features.map((feature) => ({
      id: feature.properties.id,
      name: feature.properties.name,
      category: feature.properties.category,
      risk_level: feature.properties.risk_level,
      advisory: feature.properties.advisory_text,
      geometry: feature.geometry,
    })),
  );
}
