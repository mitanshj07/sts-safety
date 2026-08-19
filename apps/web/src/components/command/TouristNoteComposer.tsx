// apps/web/src/components/command/TouristNoteComposer.tsx
"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { COMMAND_NOTE_MAX_LENGTH, COMMAND_NOTE_PRESETS } from "@sts/shared"
import { sendIncidentNote } from "@/app/(command)/actions"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function TouristNoteComposer({ incidentId }: { incidentId: string }) {
  const [message, setMessage] = useState("")
  const [pending, start] = useTransition()

  function send(body: string, presetId?: string) {
    const text = body.trim()
    if (!text) {
      toast.error("Write a note first")
      return
    }
    start(async () => {
      const result = await sendIncidentNote({
        incidentId,
        body: text,
        presetId,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(result.message ?? "Sent to tourist")
      setMessage("")
    })
  }

  return (
    <div>
      <p className="mb-3 text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
        Reply to tourist
      </p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {COMMAND_NOTE_PRESETS.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            size="xs"
            variant="outline"
            disabled={pending}
            onClick={() => send(preset.body, preset.id)}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`tourist-note-${incidentId}`}>Message</Label>
        <Textarea
          id={`tourist-note-${incidentId}`}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Custom note, ETA, or instructions…"
          maxLength={COMMAND_NOTE_MAX_LENGTH}
        />
      </div>
      <div className="mt-3">
        <Button
          size="sm"
          disabled={pending || message.trim().length === 0}
          onClick={() => send(message)}
        >
          Send to tourist
        </Button>
      </div>
    </div>
  )
}
