// apps/web/src/lib/tourist/routes.ts
import { DEFAULT_ITINERARY_CORRIDOR_M } from "@/lib/config/ping";

export type Waypoint = {
  name: string;
  lat: number;
  lon: number;
  dwell_minutes: number;
  checkin_required: boolean;
  eta?: string;
  checked_in_at?: string;
  checkin_lat?: number;
  checkin_lon?: number;
};

export type PresetRoute = {
  id: string;
  title: string;
  entry_point: string;
  corridor_m: number;
  coordinates: [number, number][];
  waypoints: Waypoint[];
};

export const PRESET_NE_ROUTES: readonly PresetRoute[] = [
  {
    id: "ghy-shillong",
    title: "Guwahati → Shillong (NH-6)",
    entry_point: "Guwahati LGBI Airport",
    corridor_m: DEFAULT_ITINERARY_CORRIDOR_M,
    coordinates: [
      [91.7362, 26.1445],
      [91.778, 26.121],
      [91.821, 26.119],
      [91.8631, 26.1],
      [91.878, 26.051],
      [91.88, 25.908],
      [91.889, 25.748],
      [91.896, 25.653],
      [91.893, 25.5788],
    ],
    waypoints: [
      { name: "Guwahati", lat: 26.1445, lon: 91.7362, dwell_minutes: 30, checkin_required: true },
      { name: "Jorabat checkpoint", lat: 26.1, lon: 91.8631, dwell_minutes: 10, checkin_required: true },
      { name: "Umiam Lake", lat: 25.653, lon: 91.896, dwell_minutes: 20, checkin_required: false },
      { name: "Shillong", lat: 25.5788, lon: 91.893, dwell_minutes: 120, checkin_required: true },
    ],
  },
  {
    id: "ghy-sohra",
    title: "Guwahati → Shillong → Cherrapunji",
    entry_point: "Guwahati LGBI Airport",
    corridor_m: 2500,
    coordinates: [
      [91.7362, 26.1445],
      [91.8631, 26.1],
      [91.893, 25.5788],
      [91.88, 25.48],
      [91.75, 25.36],
      [91.6963, 25.3009],
    ],
    waypoints: [
      { name: "Guwahati", lat: 26.1445, lon: 91.7362, dwell_minutes: 20, checkin_required: true },
      { name: "Shillong", lat: 25.5788, lon: 91.893, dwell_minutes: 60, checkin_required: true },
      { name: "Sohra (Cherrapunji)", lat: 25.3009, lon: 91.6963, dwell_minutes: 180, checkin_required: true },
    ],
  },
  {
    id: "tezpur-tawang",
    title: "Tezpur → Tawang (NH-13)",
    entry_point: "Tezpur Airport (Salonibari)",
    corridor_m: 3000,
    coordinates: [
      [92.8, 26.633],
      [92.773, 26.83],
      [92.645, 27.011],
      [92.61, 27.038],
      [92.463, 27.217],
      [92.408, 27.265],
      [92.267, 27.35],
      [92.105, 27.504],
      [91.98, 27.575],
      [91.865, 27.586],
    ],
    waypoints: [
      { name: "Tezpur", lat: 26.633, lon: 92.8, dwell_minutes: 30, checkin_required: true },
      { name: "Bhalukpong", lat: 27.011, lon: 92.645, dwell_minutes: 20, checkin_required: true },
      { name: "Bomdila", lat: 27.265, lon: 92.408, dwell_minutes: 60, checkin_required: true },
      { name: "Sela Pass", lat: 27.504, lon: 92.105, dwell_minutes: 15, checkin_required: true },
      { name: "Tawang", lat: 27.586, lon: 91.865, dwell_minutes: 240, checkin_required: true },
    ],
  },
  {
    id: "ghy-kaziranga",
    title: "Guwahati → Kaziranga (NH-37)",
    entry_point: "Guwahati LGBI Airport",
    corridor_m: 2500,
    coordinates: [
      [91.7362, 26.1445],
      [92.05, 26.13],
      [92.2, 26.12],
      [92.45, 26.22],
      [92.68, 26.35],
      [93.04, 26.52],
      [93.269, 26.577],
      [93.4112, 26.5765],
    ],
    waypoints: [
      { name: "Guwahati", lat: 26.1445, lon: 91.7362, dwell_minutes: 20, checkin_required: true },
      { name: "Nagaon", lat: 26.35, lon: 92.68, dwell_minutes: 20, checkin_required: false },
      { name: "Kohora (Kaziranga)", lat: 26.5765, lon: 93.4112, dwell_minutes: 240, checkin_required: true },
    ],
  },
  {
    id: "imphal-loktak",
    title: "Imphal → Loktak Lake",
    entry_point: "Imphal Airport",
    corridor_m: DEFAULT_ITINERARY_CORRIDOR_M,
    coordinates: [
      [93.9368, 24.817],
      [93.9, 24.7],
      [93.84, 24.55],
      [93.8, 24.52],
    ],
    waypoints: [
      { name: "Imphal", lat: 24.817, lon: 93.9368, dwell_minutes: 30, checkin_required: true },
      { name: "Sendra / Loktak", lat: 24.52, lon: 93.8, dwell_minutes: 180, checkin_required: true },
    ],
  },
  {
    id: "kohima-dzukou",
    title: "Kohima → Dzukou Valley trek",
    entry_point: "Kohima",
    corridor_m: 1500,
    coordinates: [
      [94.1086, 25.6751],
      [94.08, 25.62],
      [94.07, 25.56],
    ],
    waypoints: [
      { name: "Kohima", lat: 25.6751, lon: 94.1086, dwell_minutes: 20, checkin_required: true },
      { name: "Viswema checkpost", lat: 25.62, lon: 94.08, dwell_minutes: 15, checkin_required: true },
      { name: "Dzukou Valley", lat: 25.56, lon: 94.07, dwell_minutes: 240, checkin_required: true },
    ],
  },
] as const;

export function routeById(id: string): PresetRoute | undefined {
  return PRESET_NE_ROUTES.find((r) => r.id === id);
}

export function itineraryLineString(route: PresetRoute): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: "Feature",
    properties: { id: route.id, title: route.title, corridor_m: route.corridor_m },
    geometry: { type: "LineString", coordinates: route.coordinates },
  };
}
