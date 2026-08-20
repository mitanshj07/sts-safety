// apps/web/src/app/api/ai/suggestions/route.ts
import { jsonAuthError, requireRole } from "@/lib/auth/guards"
import { listStoredSuggestions, scanHotspotSuggestions } from "@/lib/command/hotspots"
import { fetchCommandSnapshot } from "@/lib/command/queries"

export const runtime = "nodejs"
export const maxDuration = 30

export async function GET(request: Request): Promise<Response> {
  try {
    await requireRole(request, ["admin", "responder", "auditor"])
  } catch (error) {
    return jsonAuthError(error)
  }

  const url = new URL(request.url)
  const refresh = url.searchParams.get("refresh") === "1"
  try {
    const suggestions = refresh
      ? await scanHotspotSuggestions((await fetchCommandSnapshot()).zones)
      : await listStoredSuggestions()
    return Response.json({ ok: true, suggestions })
  } catch (cause) {
    return Response.json(
      {
        ok: false,
        error: cause instanceof Error ? cause.message : "scan_failed",
        suggestions: [],
      },
      { status: 500 },
    )
  }
}
