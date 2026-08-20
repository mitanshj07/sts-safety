// apps/web/src/components/command/IncidentActions.tsx
"use client"

import { useOptimistic, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  acknowledgeIncident,
  escalateIncident,
  generateEfir,
  markFalsePositive,
  resolveIncident,
} from "@/app/(command)/actions"
import { TouristNoteComposer } from "@/components/command/TouristNoteComposer"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { IncidentStatus } from "@sts/shared"

export function IncidentActions({
  incidentId,
  status,
}: {
  incidentId: string
  status: IncidentStatus
}) {
  const [notes, setNotes] = useState("")
  const [pending, start] = useTransition()
  const [optimisticStatus, apply] = useOptimistic(status)

  function run(
    next: IncidentStatus,
    action: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>,
  ) {
    start(async () => {
      apply(next)
      const result = await action()
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(result.message ?? "Updated")
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="sts-kicker mb-3">
        Actions · {optimisticStatus.replaceAll("_", " ")}
      </p>
      <div className="mb-3 grid gap-2">
        <Label htmlFor="resolution-notes">Notes</Label>
        <Textarea
          id="resolution-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Resolution / escalation notes"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            run("acknowledged", () => acknowledgeIncident({ incidentId }))
          }
        >
          Acknowledge
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            run(optimisticStatus, () =>
              escalateIncident({ incidentId, notes: notes || undefined }),
            )
          }
        >
          Escalate
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || notes.trim().length === 0}
          onClick={() =>
            run("resolved", () => resolveIncident({ incidentId, notes }))
          }
        >
          Resolve
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            run("false_positive", () =>
              markFalsePositive({ incidentId, notes: notes || undefined }),
            )
          }
        >
          False positive
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            run(optimisticStatus, () => generateEfir({ incidentId }))
          }
        >
          Generate E-FIR
        </Button>
      </div>
      <div className="mt-4 border-t border-border pt-4">
        <TouristNoteComposer incidentId={incidentId} />
      </div>
    </div>
  )
}
