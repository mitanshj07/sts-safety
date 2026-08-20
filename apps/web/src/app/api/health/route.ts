// apps/web/src/app/api/health/route.ts
import { createPublicClient, fallback, http } from "viem";
import { z } from "zod";

import { onnxAvailable } from "@/lib/ai/onnx-local";
import {
  healthResponseSchema,
  type HealthResponse,
} from "@/lib/auth/schemas";
import { serverEnv } from "@/lib/env/server";
import { digilockerMode } from "@/lib/identity/digilocker";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/config";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_VERSION = "0.0.0";

const chainModeSchema = z.enum(["amoy", "anvil-local", "disabled"]);

function rpcUrls(): string[] {
  const mode = chainModeSchema.safeParse(process.env.CHAIN_MODE);
  if (mode.success && mode.data === "disabled") {
    return [];
  }
  if (mode.success && mode.data === "anvil-local") {
    const local = process.env.LOCAL_RPC_URL || "http://127.0.0.1:8545";
    return [local];
  }
  return [
    process.env.RPC_URL_PRIMARY,
    process.env.RPC_URL_FALLBACK_1,
    process.env.RPC_URL_FALLBACK_2,
  ].filter((url): url is string => typeof url === "string" && url.length > 0);
}

async function pingDb(): Promise<number | null> {
  const started = Date.now();
  try {
    const admin = tryCreateAdminClient();
    const client =
      admin ??
      createAnonClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
        auth: { persistSession: false, autoRefreshToken: false },
      });

    const { error } = await client.rpc("health_ping");
    if (!error) {
      return Date.now() - started;
    }

    const fallbackPing = await client.from("profiles").select("id").limit(1);
    if (fallbackPing.error) {
      return null;
    }
    return Date.now() - started;
  } catch {
    return null;
  }
}

async function pingChain(): Promise<number | null> {
  const mode = chainModeSchema.safeParse(process.env.CHAIN_MODE);
  if (mode.success && mode.data === "disabled") {
    return 0;
  }
  const urls = rpcUrls();
  if (urls.length === 0) {
    return null;
  }
  try {
    const client = createPublicClient({
      transport: fallback(
        urls.map((url) => http(url, { timeout: 4_000, retryCount: 0 })),
      ),
    });
    const block = await client.getBlockNumber();
    return Number(block);
  } catch {
    return null;
  }
}

async function pingAi(): Promise<boolean> {
  const mode = serverEnv.aiMode;
  if (mode === "rules-only") return true;
  if (mode === "onnx-local") {
    return onnxAvailable();
  }
  const base = process.env.HF_SPACE_URL;
  if (!base || base.includes("<user>")) {
    return onnxAvailable();
  }
  const timeoutMs = Number(process.env.HF_SPACE_TIMEOUT_MS ?? "8000");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(new URL("/health", base), {
      method: "GET",
      signal: controller.signal,
      headers: process.env.HF_SPACE_TOKEN
        ? { Authorization: `Bearer ${process.env.HF_SPACE_TOKEN}` }
        : undefined,
    });
    if (response.ok) return true;
  } catch {
    // fall through to local ONNX
  } finally {
    clearTimeout(timer);
  }
  return onnxAvailable();
}

export async function GET(): Promise<Response> {
  const [dbResult, chainResult, aiResult] = await Promise.allSettled([
    pingDb(),
    pingChain(),
    pingAi(),
  ]);

  const db = dbResult.status === "fulfilled" ? dbResult.value : null;
  const chain = chainResult.status === "fulfilled" ? chainResult.value : null;
  const ai = aiResult.status === "fulfilled" ? aiResult.value : false;

  const payload: HealthResponse = healthResponseSchema.parse({
    ok: db !== null,
    db,
    chain,
    ai,
    version: process.env.npm_package_version ?? APP_VERSION,
    modes: {
      db: process.env.DB_MODE ?? "supabase-cloud",
      chain: process.env.CHAIN_MODE ?? "amoy",
      ai: process.env.AI_MODE ?? "groq",
      map: process.env.NEXT_PUBLIC_MAP_TILE_MODE ?? "openfreemap",
      digilocker: digilockerMode(),
    },
  });

  return Response.json(payload, {
    status: payload.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
