// apps/web/src/app/api/command/snapshot/route.ts
import { NextResponse } from "next/server"
import { COMMAND_ROLES } from "@/lib/auth/roles"
import { jsonAuthError, requireRole } from "@/lib/auth/guards"
import { fetchCommandSnapshot } from "@/lib/command/queries"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    await requireRole(request, COMMAND_ROLES)
  } catch (error) {
    return jsonAuthError(error)
  }
  try {
    const snapshot = await fetchCommandSnapshot()
    return NextResponse.json(snapshot)
  } catch (error) {
    const message = error instanceof Error ? error.message : "snapshot failed"
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
