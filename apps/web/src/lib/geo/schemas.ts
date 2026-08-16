// apps/web/src/lib/geo/schemas.ts
import { z } from "zod";

import {
  RISK_LEVELS,
  SEVERITY_LEVELS,
  type RiskLevel,
  type SeverityLevel,
} from "@/lib/geo/colors";

const lonSchema = z.number().gte(-180).lte(180);
const latSchema = z.number().gte(-90).lte(90);
export const lngLatSchema = z.union([
  z.tuple([lonSchema, latSchema]),
  z
    .tuple([lonSchema, latSchema, z.number()])
    .transform(([lon, lat]): [number, number] => [lon, lat]),
]);

const ringSchema = z.array(lngLatSchema).min(4);

export const polygonGeometrySchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(ringSchema).min(1),
});

export const multiPolygonGeometrySchema = z.object({
  type: z.literal("MultiPolygon"),
  coordinates: z.array(z.array(ringSchema).min(1)).min(1),
});

export const zoneGeometrySchema = z.union([
  polygonGeometrySchema,
  multiPolygonGeometrySchema,
]);

export const riskLevelSchema = z.enum(RISK_LEVELS);
export const severityLevelSchema = z.enum(SEVERITY_LEVELS);

export const zoneInputSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  risk_level: riskLevelSchema,
  advisory: z.string().nullable().optional(),
  geometry: zoneGeometrySchema,
});

export const touristMapPointSchema = z.object({
  id: z.string().min(1),
  lon: lonSchema,
  lat: latSchema,
  safety_score: z.number().min(0).max(100),
  name: z.string().optional(),
});

export const incidentMapPointSchema = z.object({
  id: z.string().min(1),
  lon: lonSchema,
  lat: latSchema,
  severity: severityLevelSchema,
  type: z.string().optional(),
});

export const trackInputSchema = z.object({
  coordinates: z.array(lngLatSchema).min(2),
  times: z.array(z.union([z.number(), z.string()])).optional(),
});

export type ZoneInput = z.infer<typeof zoneInputSchema>;
export type TouristMapPoint = z.infer<typeof touristMapPointSchema>;
export type IncidentMapPoint = z.infer<typeof incidentMapPointSchema>;
export type TrackInput = z.infer<typeof trackInputSchema>;

export type { RiskLevel, SeverityLevel };

export function parseZones(input: readonly unknown[]): ZoneInput[] {
  return input.flatMap((item) => {
    const parsed = zoneInputSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

export function parseTourists(input: readonly unknown[]): TouristMapPoint[] {
  return input.flatMap((item) => {
    const parsed = touristMapPointSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

export function parseIncidents(input: readonly unknown[]): IncidentMapPoint[] {
  return input.flatMap((item) => {
    const parsed = incidentMapPointSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}
