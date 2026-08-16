// apps/web/src/app/api/ai/nl-query/route.ts
import { z } from "zod"

import { compileAndRunNlQuery } from "@/lib/ai/nl-sql"
import { jsonAuthError, requireRole } from "@/lib/auth/guards"

export const runtime = "nodejs"
export const maxDuration = 30

const bodySchema = z.object({
  query: z.string().min(1).max(500),
})

export async function POST(request: Request): Promise<Response> {
  try {
    await requireRole(request, ["admin", "responder", "auditor"])
  } catch (error) {
    return jsonAuthError(error)
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "validation_failed", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const result = await compileAndRunNlQuery(parsed.data.query)
  return Response.json({
    ok: result.error === null,
    sql: result.sql,
    params: result.params,
    rows: result.rows,
    source: result.source,
    error: result.error,
  })
}
