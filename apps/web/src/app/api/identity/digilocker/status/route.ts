// apps/web/src/app/api/identity/digilocker/status/route.ts
import { digilockerPublicStatus } from "@/lib/identity/digilocker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json(digilockerPublicStatus(), {
    headers: { "Cache-Control": "no-store" },
  });
}
