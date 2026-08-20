// apps/web/src/lib/supabase/config.ts
// Public Supabase URL/anon-key resolution. Safe to import from client, server,
// and the request proxy. Never reads the service-role key.

import { z } from "zod";

import {
  LOCAL_SUPABASE_ANON_JWT,
  LOCAL_SUPABASE_URL_DEFAULT,
} from "@/lib/supabase/local-demo";

const dbModeSchema = z.enum(["supabase-cloud", "supabase-local"]);

export type DbMode = z.infer<typeof dbModeSchema>;

function readDbMode(): DbMode {
  const parsed = dbModeSchema.safeParse(process.env.DB_MODE);
  return parsed.success ? parsed.data : "supabase-cloud";
}

export function getDbMode(): DbMode {
  return readDbMode();
}

export function getSupabaseUrl(): string {
  if (readDbMode() === "supabase-local") {
    const local = process.env.LOCAL_SUPABASE_URL;
    if (local && local.length > 0) {
      return local;
    }
    return LOCAL_SUPABASE_URL_DEFAULT;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || url.length === 0) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  return url;
}

export function getSupabaseAnonKey(): string {
  if (readDbMode() === "supabase-local") {
    const local = process.env.LOCAL_SUPABASE_ANON_KEY;
    if (local && local.length > 0) {
      return local;
    }
    return LOCAL_SUPABASE_ANON_JWT;
  }
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key || key.length === 0) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return key;
}

export function tryGetSupabasePublicConfig(): {
  url: string;
  anonKey: string;
} | null {
  try {
    return { url: getSupabaseUrl(), anonKey: getSupabaseAnonKey() };
  } catch {
    return null;
  }
}
