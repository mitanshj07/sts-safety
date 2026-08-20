// apps/web/src/lib/supabase/server.ts
import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/config";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component; proxy will refresh the session.
        }
      },
    },
  });
}

export async function createClient() {
  return createSupabaseServerClient();
}

export async function createServerSupabase() {
  try {
    return await createSupabaseServerClient();
  } catch {
    return null;
  }
}
