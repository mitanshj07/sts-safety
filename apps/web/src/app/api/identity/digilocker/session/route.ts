// apps/web/src/app/api/identity/digilocker/session/route.ts
import { digilockerSessionSchema } from "@sts/shared";
import { NextResponse, type NextRequest } from "next/server";

import {
  DIGILOCKER_SESSION_COOKIE,
  cookieOptions,
  decodeSessionCookie,
  sessionToClient,
} from "@/lib/identity/digilocker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = decodeSessionCookie(request.cookies.get(DIGILOCKER_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ profile: null });
  }
  const parsed = digilockerSessionSchema.safeParse(sessionToClient(session));
  if (!parsed.success) {
    return NextResponse.json({ profile: null });
  }
  return NextResponse.json({ profile: parsed.data });
}

export async function DELETE(): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DIGILOCKER_SESSION_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
  return response;
}
