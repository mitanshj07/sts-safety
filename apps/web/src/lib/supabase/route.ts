import { createServerClient } from "@supabase/ssr";
import { type NextRequest, type NextResponse } from "next/server";

import { tryGetSupabasePublicConfig } from "./config";
import type { Database } from "./database.types";

/** Bind a Supabase client to a Route Handler response so auth cookies survive redirects. */
export function createSupabaseOnResponse(
  request: NextRequest,
  response: NextResponse,
) {
  const config = tryGetSupabasePublicConfig();
  if (!config) return null;
  return createServerClient<Database>(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}
