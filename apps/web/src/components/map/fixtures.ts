// apps/web/src/components/map/fixtures.ts
import type {
  IncidentMapPoint,
  TouristMapPoint,
  ZoneInput,
} from "@/lib/geo/schemas";

export const SAMPLE_ZONES: ZoneInput[] = [
  {
    id: "11111111-1111-4111-8111-111111111109",
    name: "Guwahati City Centre",
    category: "safe",
    risk_level: "none",
    advisory: "Central Guwahati urban core: Panbazar, Fancy Bazaar, riverfront.",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [91.72, 26.16],
          [91.78, 26.16],
          [91.78, 26.2],
          [91.72, 26.2],
          [91.72, 26.16],
        ],
      ],
    },
  },
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Hotel Brahmaputra Ashok (Guwahati)",
    category: "accommodation",
    risk_level: "none",
    advisory: "Licensed tourist accommodation on MG Road.",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [91.7475, 26.1795],
          [91.7508, 26.1795],
          [91.7508, 26.1818],
          [91.7475, 26.1818],
          [91.7475, 26.1795],
        ],
      ],
    },
  },
  {
    id: "11111111-1111-4111-8111-111111111113",
    name: "Jorabat Checkpoint",
    category: "checkpoint",
    risk_level: "low",
    advisory: "Keep passport/ILP ready. Do not queue on the blind curve.",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [91.86, 26.096],
          [91.8665, 26.096],
          [91.8665, 26.1035],
          [91.86, 26.1035],
          [91.86, 26.096],
        ],
      ],
    },
  },
  {
    id: "11111111-1111-4111-8111-111111111110",
    name: "Manas National Park (night-restricted)",
    category: "forest_reserve",
    risk_level: "high",
    advisory: "Forest roads close at 17:30.",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [90.85, 26.65],
          [91.15, 26.65],
          [91.15, 26.85],
          [90.85, 26.85],
          [90.85, 26.65],
        ],
      ],
    },
  },
  {
    id: "11111111-1111-4111-8111-111111111101",
    name: "Kaziranga Core Range",
    category: "restricted",
    risk_level: "critical",
    advisory: "Restricted forest. Leave immediately and contact Kohora range.",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [93.3, 26.57],
          [93.38, 26.54],
          [93.47, 26.56],
          [93.49, 26.64],
          [93.42, 26.7],
          [93.32, 26.68],
          [93.3, 26.57],
        ],
      ],
    },
  },
];

function hashUnit(index: number, salt: number): number {
  const x = Math.sin(index * 12.9898 + salt) * 43758.5453;
  return x - Math.floor(x);
}

export const SAMPLE_TOURISTS: TouristMapPoint[] = Array.from(
  { length: 55 },
  (_, index) => {
    const n = index + 1;
    const lon = 91.7362 + (hashUnit(n, 1) - 0.5) * 0.08;
    const lat = 26.1445 + (hashUnit(n, 2) - 0.5) * 0.06;
    const scores = [92, 81, 67, 54, 38, 22] as const;
    const score = scores[n % scores.length] ?? 67;
    return {
      id: `demo-tourist-${n}`,
      lon,
      lat,
      safety_score: score,
      name: `Tourist ${n}`,
    };
  },
);

export const SAMPLE_INCIDENTS: IncidentMapPoint[] = [
  {
    id: "demo-incident-sos",
    lon: 91.749,
    lat: 26.1805,
    severity: "critical",
    type: "sos",
  },
  {
    id: "demo-incident-zone",
    lon: 91.863,
    lat: 26.1,
    severity: "medium",
    type: "geofence_entry_restricted",
  },
];

export const SAMPLE_TRACK: [number, number][] = [
  [91.7362, 26.1445],
  [91.7405, 26.156],
  [91.7448, 26.168],
  [91.7488, 26.1798],
  [91.752, 26.185],
];
