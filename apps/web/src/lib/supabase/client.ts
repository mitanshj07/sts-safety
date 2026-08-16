// apps/web/src/lib/supabase/client.ts
"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/config/public";

import type { Database } from "./database.types";

export function createClient(): SupabaseClient<Database> {
  const url = publicEnv.supabaseUrl;
  const anonKey = publicEnv.supabaseAnonKey;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  return createBrowserClient<Database>(url, anonKey);
}

/** Offline-tolerant alias for trackers that must no-op when env is unset. */
export function getBrowserSupabase(): SupabaseClient<Database> | null {
  try {
    return createClient();
  } catch {
    return null;
  }
}
