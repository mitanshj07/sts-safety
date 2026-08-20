import "server-only";

import { type NextRequest, type NextResponse } from "next/server";

import { ensureTouristSessionOnResponse } from "@/lib/auth/guest-session";
import { identityLog } from "./log";

export async function ensureTouristSessionAfterDigilocker(args: {
  request: NextRequest;
  response: NextResponse;
  displayName: string;
}): Promise<void> {
  const minted = await ensureTouristSessionOnResponse(args);
  if (!minted) {
    identityLog("digilocker_session_failed", { ok: false });
  }
}
