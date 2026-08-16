// apps/web/src/lib/supabase/admin.ts
import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { serverEnv } from "@/lib/env/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/config";

let cached: SupabaseClient | undefined;

/** Service-role client. Bypasses RLS. Never import from a Client Component. */
export function createAdminClient(): SupabaseClient {
  if (cached) {
    return cached;
  }
  const key = serverEnv.supabaseServiceRoleKey;
  if (!key) {
    throw new Error("missing SUPABASE_SERVICE_ROLE_KEY");
  }
  cached = createClient(getSupabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export function createAnonServerClient(): SupabaseClient {
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function tryCreateAdminClient(): SupabaseClient | null {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

export const createAdminSupabase = createAdminClient;
