// apps/web/src/components/command/AiBriefPanel.tsx
"use client"

import { useOptimistic, useState, useTransition } from "react"
import { toast } from "sonner"
import { regenerateBrief } from "@/app/(command)/actions"
import { Button } from "@/components/ui/button"

export function AiBriefPanel({
  incidentId,
  brief,
  model,
}: {
  incidentId: string
  brief: string | null
  model: string | null
}) {
  const [value, setValue] = useState(brief)
  const [modelName, setModelName] = useState(model)
  const [pending, start] = useTransition()
  const [optimisticBrief, apply] = useOptimistic(value)

  return (
    <div className="border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
            AI brief
          </p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {modelName ?? "rules-only"} · never on the hot path
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => {
            apply("Regenerating…")
            start(async () => {
              const result = await regenerateBrief({ incidentId })
              if (!result.ok) {
                toast.error(result.error)
                return
              }
              toast.success(result.message)
              setModelName(result.message?.replace("Brief updated (", "").replace(")", "") ?? modelName)
            })
          }}
        >
          {pending ? "Working…" : "Regenerate"}
        </Button>
      </div>
      <p className="text-sm leading-relaxed">{optimisticBrief ?? "No brief yet. Regenerate after an LLM key is set, or keep the rules fallback."}</p>
    </div>
  )
}
