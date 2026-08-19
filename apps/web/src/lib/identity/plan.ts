import {
  defaultPresetRoute,
  guestKycForNationality,
  routeById,
  type IssueIdentityRequest,
  type KycStatus,
  type KycType,
  type PresetWaypoint,
  type SaveItineraryRequest,
} from "@sts/shared";

export type ResolvedItinerary = {
  geojson: { type: "LineString"; coordinates: [number, number][] };
  title: string;
  corridorM: number;
  waypoints: PresetWaypoint[];
  entryPoint: string | null;
  presetId: string | null;
};

export type ResolvedIssue = ResolvedItinerary & {
  skipKyc: boolean;
  name: string;
  nationality: string;
  kycType: KycType;
  kycNumber: string;
  kycStatus: KycStatus;
};

function corridorFallback(value: number | undefined): number {
  if (value && value > 0) return value;
  const fromEnv = Number.parseInt(process.env.DEFAULT_ITINERARY_CORRIDOR_M ?? "2000", 10);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 2000;
}

export function resolveItinerary(
  request: Pick<
    IssueIdentityRequest & SaveItineraryRequest,
    | "itineraryPresetId"
    | "itineraryGeoJSON"
    | "itineraryTitle"
    | "itineraryWaypoints"
    | "corridorM"
    | "entryPoint"
  >,
): ResolvedItinerary {
  const preset = request.itineraryPresetId
    ? routeById(request.itineraryPresetId)
    : undefined;
  const fallback =
    request.itineraryGeoJSON || request.itineraryWaypoints?.length
      ? null
      : defaultPresetRoute();
  const route = preset ?? fallback;
  const coordinates =
    request.itineraryGeoJSON?.coordinates ?? route?.coordinates ?? defaultPresetRoute().coordinates;
  return {
    geojson: { type: "LineString", coordinates },
    title: request.itineraryTitle ?? route?.title ?? "Planned route",
    corridorM: corridorFallback(request.corridorM ?? route?.corridor_m),
    waypoints: (request.itineraryWaypoints as PresetWaypoint[] | undefined) ??
      route?.waypoints ??
      defaultPresetRoute().waypoints,
    entryPoint: request.entryPoint ?? route?.entry_point ?? null,
    presetId: route?.id ?? request.itineraryPresetId ?? null,
  };
}

export function resolveIssuePlan(request: IssueIdentityRequest): ResolvedIssue {
  const skipKyc = request.skipKyc === true;
  const nationality = (request.nationality ?? "IN").toUpperCase();
  const seed = request.profileId ?? request.name ?? "guest";
  const guest = guestKycForNationality(nationality, seed);
  const kycType = skipKyc ? guest.kycType : (request.kycType ?? guest.kycType);
  const kycNumber = skipKyc ? guest.kycNumber : (request.kycNumber ?? guest.kycNumber);
  return {
    skipKyc,
    name: request.name?.trim() || "Guest traveller",
    nationality,
    kycType,
    kycNumber,
    kycStatus: skipKyc ? "skipped" : "verified",
    ...resolveItinerary(request),
  };
}
