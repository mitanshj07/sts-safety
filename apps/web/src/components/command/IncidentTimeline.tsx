// apps/web/src/components/command/IncidentTimeline.tsx
import { ScrollArea } from "@/components/ui/scroll-area"
import type { IncidentEvent } from "@/lib/command/types"

export function IncidentTimeline({ events }: { events: IncidentEvent[] }) {
  return (
    <div className="border border-border bg-surface">
      <div className="border-b border-border px-4 py-2">
        <p className="text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
          Timeline · append-only
        </p>
      </div>
      <ScrollArea className="h-64">
        <ol className="space-y-3 p-4">
          {events.length === 0 ? (
            <li className="text-sm text-muted-foreground">No events yet.</li>
          ) : (
            events.map((event) => (
              <li key={event.id} className="relative pl-4">
                <span className="absolute top-1.5 left-0 size-2 rounded-full bg-primary" />
                <p className="font-mono text-[11px] text-muted-foreground">
                  {new Date(event.created_at).toLocaleString("en-IN", { hour12: false })}
                </p>
                <p className="text-sm font-medium">
                  {event.event_type}
                  {event.actor_label ? ` · ${event.actor_label}` : ""}
                </p>
                {event.event_type === "note" && typeof event.detail.body === "string" ? (
                  <p className="mt-1 text-sm text-pretty">{event.detail.body}</p>
                ) : Object.keys(event.detail).length > 0 ? (
                  <pre className="mt-1 overflow-x-auto font-mono text-[11px] text-muted-foreground">
                    {JSON.stringify(event.detail)}
                  </pre>
                ) : null}
              </li>
            ))
          )}
        </ol>
      </ScrollArea>
    </div>
  )
}
