// apps/web/next.config.ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { NextConfig } from "next";

import {
  LOCAL_SUPABASE_ANON_JWT,
  LOCAL_SUPABASE_URL_DEFAULT,
} from "./src/lib/supabase/local-demo";

type AnvilDeployment = {
  TouristIdentityRegistry?: { address?: string };
  IncidentAnchor?: { address?: string };
};

function readAnvilDeployment(): AnvilDeployment | null {
  const candidates = [
    join(__dirname, "../../packages/contracts/deployments/anvil.json"),
    join(process.cwd(), "packages/contracts/deployments/anvil.json"),
    join(process.cwd(), "../../packages/contracts/deployments/anvil.json"),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      return JSON.parse(readFileSync(path, "utf8")) as AnvilDeployment;
    } catch {
      return null;
    }
  }
  return null;
}

function isZeroHex(value: string | undefined): boolean {
  return !value || /^0x0+$/i.test(value);
}

const dbMode = process.env.DB_MODE ?? "supabase-cloud";
const chainMode = process.env.CHAIN_MODE ?? "amoy";
const mapTileMode = process.env.NEXT_PUBLIC_MAP_TILE_MODE ?? "openfreemap";

const localSupabaseUrl =
  process.env.LOCAL_SUPABASE_URL || LOCAL_SUPABASE_URL_DEFAULT;
const localAnon =
  process.env.LOCAL_SUPABASE_ANON_KEY || LOCAL_SUPABASE_ANON_JWT;

const anvil = chainMode === "anvil-local" ? readAnvilDeployment() : null;
const anvilRegistry = anvil?.TouristIdentityRegistry?.address;
const anvilAnchor = anvil?.IncidentAnchor?.address;

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tiles.openfreemap.org",
  "font-src 'self' data:",
  "manifest-src 'self'",
  [
    "connect-src 'self' blob:",
    "http://127.0.0.1:* http://localhost:*",
    "ws://127.0.0.1:* ws://localhost:* wss://127.0.0.1:* wss://localhost:*",
    "http://127.0.0.1:54321 ws://127.0.0.1:54321 http://127.0.0.1:8545",
    "https://*.supabase.co wss://*.supabase.co",
    "https://tiles.openfreemap.org https://*.openfreemap.org",
    "https://api.groq.com https://generativelanguage.googleapis.com",
    "https://photon.komoot.io https://nominatim.openstreetmap.org",
    "https://router.project-osrm.org https://*.huggingface.co https://*.hf.space",
    "https://rpc-amoy.polygon.technology https://polygon-amoy-bor-rpc.publicnode.com",
    "https://rpc.ankr.com https://amoy.polygonscan.com",
    "https://api.telegram.org https://api.resend.com",
    "https://*.ingest.sentry.io https://*.sentry.io",
  ].join(" "),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), geolocation=(self), microphone=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@sts/shared"],
  serverExternalPackages: ["onnxruntime-node", "pg"],
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      dbMode === "supabase-local"
        ? localSupabaseUrl
        : (process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""),
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      dbMode === "supabase-local"
        ? localAnon
        : (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""),
    NEXT_PUBLIC_CHAIN_ID:
      chainMode === "anvil-local"
        ? "31337"
        : (process.env.NEXT_PUBLIC_CHAIN_ID ?? "80002"),
    NEXT_PUBLIC_CHAIN_NAME:
      chainMode === "anvil-local"
        ? "Anvil"
        : (process.env.NEXT_PUBLIC_CHAIN_NAME ?? "Polygon Amoy"),
    NEXT_PUBLIC_BLOCK_EXPLORER:
      chainMode === "anvil-local"
        ? ""
        : (process.env.NEXT_PUBLIC_BLOCK_EXPLORER ?? "https://amoy.polygonscan.com"),
    NEXT_PUBLIC_TOURIST_ID_REGISTRY_ADDRESS:
      chainMode === "anvil-local" && !isZeroHex(anvilRegistry)
        ? (anvilRegistry as string)
        : (process.env.NEXT_PUBLIC_TOURIST_ID_REGISTRY_ADDRESS ??
          "0x0000000000000000000000000000000000000000"),
    NEXT_PUBLIC_INCIDENT_ANCHOR_ADDRESS:
      chainMode === "anvil-local" && !isZeroHex(anvilAnchor)
        ? (anvilAnchor as string)
        : (process.env.NEXT_PUBLIC_INCIDENT_ANCHOR_ADDRESS ??
          "0x0000000000000000000000000000000000000000"),
    NEXT_PUBLIC_MAP_TILE_MODE: mapTileMode,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Content-Type", value: "application/manifest+json" }],
      },
    ];
  },
};

export default nextConfig;
