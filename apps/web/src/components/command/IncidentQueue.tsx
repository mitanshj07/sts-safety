// apps/web/src/components/command/IncidentQueue.tsx
"use client"

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react"
import { useCommandRealtime } from "@/components/shared/RealtimeProvider"
import { SeverityBadge, StatusBadge } from "@/components/command/SeverityBadge"
import { formatElapsed, sortIncidentsCriticalFirst } from "@/lib/command/kpis"
import { cn } from "@/lib/utils"
import type { LiveIncident } from "@/lib/command/types"

function playCriticalChime(): void {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "triangle"
    osc.frequency.value = 880
    gain.gain.value = 0.08
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
    osc.stop(ctx.currentTime + 0.4)
  } catch {
    // Autoplay blocked until the operator clicks once.
  }
}

function announceText(incident: LiveIncident | undefined): string {
  if (!incident) return ""
  return `New ${incident.severity} incident: ${incident.type.replaceAll("_", " ")} for ${incident.tourist_name ?? "unknown tourist"}`
}

export function IncidentQueue() {
  const { snapshot, selectedIncidentId, setSelectedIncidentId, lastCriticalId } =
    useCommandRealtime()
  const flashed = useRef<string | null>(null)
  const [flash, setFlash] = useState(false)
  const [liveMessage, setLiveMessage] = useState("")
  const listId = useId()

  const open = sortIncidentsCriticalFirst(
    snapshot.incidents.filter((incident) =>
      ["open", "acknowledged", "dispatched"].includes(incident.status),
    ),
  )

  useEffect(() => {
    if (!lastCriticalId || flashed.current === lastCriticalId) return
    flashed.current = lastCriticalId
    playCriticalChime()
    setFlash(true)
    const incident = snapshot.incidents.find((row) => row.id === lastCriticalId)
    setLiveMessage(announceText(incident))
    const timer = window.setTimeout(() => setFlash(false), 1400)
    return () => window.clearTimeout(timer)
  }, [lastCriticalId, snapshot.incidents])

  function onListKeyDown(event: KeyboardEvent<HTMLUListElement>): void {
    if (open.length === 0) return
    const currentIndex = open.findIndex((row) => row.id === selectedIncidentId)
    if (event.key === "ArrowDown") {
      event.preventDefault()
      const next = open[Math.min(open.length - 1, currentIndex + 1)] ?? open[0]
      if (next) {
        setSelectedIncidentId(next.id)
        document.getElementById(`incident-${next.id}`)?.focus()
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      const next = open[Math.max(0, currentIndex - 1)] ?? open[0]
      if (next) {
        setSelectedIncidentId(next.id)
        document.getElementById(`incident-${next.id}`)?.focus()
      }
    } else if (event.key === "Home") {
      event.preventDefault()
      const first = open[0]
      if (first) {
        setSelectedIncidentId(first.id)
        document.getElementById(`incident-${first.id}`)?.focus()
      }
    } else if (event.key === "End") {
      event.preventDefault()
      const last = open[open.length - 1]
      if (last) {
        setSelectedIncidentId(last.id)
        document.getElementById(`incident-${last.id}`)?.focus()
      }
    }
  }

  return (
    <aside
      className={cn(
        "flex h-full w-full flex-col border-l border-border bg-card md:w-[22rem]",
        flash && "critical-flash",
      )}
    >
      <div
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
        role="status"
      >
        {liveMessage}
      </div>
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
        <p className="sts-kicker">Incident queue</p>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {open.length} open
        </span>
      </div>
      <ul
        id={listId}
        role="listbox"
        aria-label="Open incidents, critical first"
        tabIndex={0}
        onKeyDown={onListKeyDown}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {open.length === 0 ? (
            <li className="px-3 py-10 text-center text-sm text-muted-foreground">
              No open incidents
            </li>
        ) : (
          open.map((incident) => (
            <li key={incident.id} role="presentation">
              <button
                type="button"
                id={`incident-${incident.id}`}
                role="option"
                aria-selected={selectedIncidentId === incident.id}
                onClick={() => setSelectedIncidentId(incident.id)}
                className={cn(
                  "flex w-full flex-col gap-1 border-b border-border px-3 py-3 text-left transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  selectedIncidentId === incident.id && "bg-accent",
                  incident.severity === "critical" &&
                    incident.id === lastCriticalId &&
                    "critical-flash",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <SeverityBadge severity={incident.severity} />
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {formatElapsed(incident.occurred_at)}
                  </span>
                </div>
                <p className="text-sm font-medium">
                  {incident.tourist_name ?? "Unknown tourist"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {incident.type.replaceAll("_", " ")} ·{" "}
                  {incident.zone_name ?? incident.address_text ?? "unlocated"}
                </p>
                <StatusBadge status={incident.status} />
              </button>
            </li>
          ))
        )}
      </ul>
    </aside>
  )
}
