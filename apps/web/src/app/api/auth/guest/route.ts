import { type NextRequest, NextResponse } from "next/server";

import { DEMO_TOURIST_DISPLAY_NAME } from "@/lib/auth/demo";
import { ensureTouristSessionOnResponse } from "@/lib/auth/guest-session";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true });
  const minted = await ensureTouristSessionOnResponse({
    request,
    response,
    displayName: DEMO_TOURIST_DISPLAY_NAME,
  });
  if (!minted) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not start a guest tourist session. Enable anonymous sign-ins or check the service role key.",
      },
      { status: 401 },
    );
  }
  return response;
}
