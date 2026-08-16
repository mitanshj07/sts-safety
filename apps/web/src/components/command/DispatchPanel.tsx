// apps/web/src/components/command/DispatchPanel.tsx
"use client"

import { useOptimistic, useState, useTransition } from "react"
import { toast } from "sonner"
import { dispatchResponder } from "@/app/(command)/actions"
import { Button } from "@/components/ui/button"
import { formatDuration } from "@/lib/command/kpis"
import type { NearestResponder } from "@/lib/command/types"

export function DispatchPanel({
  incidentId,
  responders,
}: {
  incidentId: string
  responders: NearestResponder[]
}) {
  const [pending, start] = useTransition()
  const [rows, setRows] = useState(responders)
  const [optimistic, apply] = useOptimistic(
    rows,
    (current, responderId: string) =>
      current.map((row) =>
        row.responder_id === responderId
          ? { ...row, already_dispatched: true, dispatch_status: "sent" as const }
          : row,
      ),
  )

  return (
    <div className="rounded-2xl border border-border bg-card/80">
      <div className="border-b border-border px-4 py-2">
        <p className="text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
          Nearest units · one-click dispatch
        </p>
      </div>
      <ul className="divide-y divide-border">
        {optimistic.length === 0 ? (
          <li className="px-4 py-6 text-sm text-muted-foreground">
            No on-duty unit within coverage.
          </li>
        ) : (
          optimistic.map((row) => (
            <li key={row.responder_id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{row.name}</p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {(row.distance_m / 1000).toFixed(1)} km · ETA{" "}
                  {formatDuration(row.eta_seconds)} ({row.eta_source})
                  {row.dispatch_status ? ` · ${row.dispatch_status}` : ""}
                </p>
              </div>
              <Button
                size="sm"
                disabled={pending || row.already_dispatched}
                onClick={() => {
                  start(async () => {
                    apply(row.responder_id)
                    const result = await dispatchResponder({
                      incidentId,
                      responderId: row.responder_id,
                    })
                    if (!result.ok) {
                      toast.error(result.error)
                      return
                    }
                    setRows((current) =>
                      current.map((item) =>
                        item.responder_id === row.responder_id
                          ? {
                              ...item,
                              already_dispatched: true,
                              dispatch_status: "sent",
                            }
                          : item,
                      ),
                    )
                    toast.success(result.message ?? "Dispatched")
                  })
                }}
              >
                {row.already_dispatched ? "Sent" : "Dispatch"}
              </Button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
