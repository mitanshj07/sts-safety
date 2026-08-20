// apps/web/src/components/shared/IncidentMessageThread.tsx
"use client"

import { useEffect, useState } from "react"
import {
  formatVoiceDuration,
  type IncidentMessage,
  type IncidentMessageSender,
} from "@sts/shared"
import { VoiceNoteRecorder } from "@/components/shared/VoiceNoteRecorder"
import {
  fetchIncidentMessages,
  fetchVoicePlaybackUrl,
  postIncidentMessage,
} from "@/lib/incidents/messages-client"
import { getBrowserSupabase } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

function VoicePlayback({ messageId, durationMs }: { messageId: string; durationMs: number | null }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchVoicePlaybackUrl(messageId).then((next) => {
      if (cancelled) return
      if (!next) setError("Could not load audio")
      else setUrl(next)
    })
    return () => {
      cancelled = true
    }
  }, [messageId])

  if (error) return <p className="text-xs text-destructive">{error}</p>
  if (!url) {
    return (
      <p className="text-xs text-muted-foreground">
        Loading voice note ({formatVoiceDuration(durationMs)})…
      </p>
    )
  }
  return <audio controls src={url} className="mt-2 w-full" preload="none" />
}

export function IncidentMessageThread({
  incidentId,
  senderKind,
  canSend = true,
  className,
}: {
  incidentId: string
  senderKind: IncidentMessageSender
  canSend?: boolean
  className?: string
}) {
  const [messages, setMessages] = useState<IncidentMessage[]>([])
  const [sendError, setSendError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      void fetchIncidentMessages(incidentId).then((rows) => {
        if (!cancelled) setMessages(rows)
      })
    }
    refresh()
    const supabase = getBrowserSupabase()
    if (!supabase) {
      return () => {
        cancelled = true
      }
    }
    const channel = supabase
      .channel(`incident-messages:${incidentId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "incident_messages",
          filter: `incident_id=eq.${incidentId}`,
        },
        () => {
          refresh()
        },
      )
      .subscribe()
    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [incidentId])

  async function sendVoice(blob: Blob, durationMs: number) {
    setSendError(null)
    const result = await postIncidentMessage({
      incidentId,
      kind: "voice",
      file: blob,
      durationMs,
    })
    if (!result.ok) {
      setSendError(result.error)
      throw new Error(result.error)
    }
    const rows = await fetchIncidentMessages(incidentId)
    setMessages(rows)
  }

  return (
    <section
      className={className}
      aria-label="SOS voice and text thread"
      data-testid="incident-message-thread"
    >
      <p className="mb-2 text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
        Voice notes
      </p>
      {messages.length === 0 ? (
        <p className="rounded-2xl border border-border/80 bg-card/70 p-3 text-sm text-muted-foreground">
          No voice notes yet. Record after SOS — command can reply the same way.
        </p>
      ) : (
        <ul className="max-h-64 space-y-2 overflow-y-auto">
          {messages.map((row) => {
            const mine = row.sender_kind === senderKind
            return (
              <li
                key={row.id}
                className={cn(
                  "rounded-2xl border p-3",
                  row.sender_kind === "command"
                    ? "border-emerald-700/40 bg-emerald-950/30"
                    : "border-red-700/30 bg-red-950/20",
                )}
              >
                <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                  {row.sender_kind === "command" ? "Control room" : "Tourist"}
                  {mine ? " · you" : ""}
                  {row.kind === "voice" ? " · voice" : ""}
                </p>
                {row.body ? <p className="mt-1 text-sm text-pretty">{row.body}</p> : null}
                {row.kind === "voice" ? (
                  <VoicePlayback messageId={row.id} durationMs={row.duration_ms ?? null} />
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(row.created_at).toLocaleString()}
                </p>
              </li>
            )
          })}
        </ul>
      )}
      {canSend ? (
        <div className="mt-3">
          <VoiceNoteRecorder onSend={sendVoice} />
          {sendError ? <p className="mt-1 text-xs text-destructive">{sendError}</p> : null}
        </div>
      ) : null}
    </section>
  )
}
