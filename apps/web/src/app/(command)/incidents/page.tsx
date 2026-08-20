// apps/web/src/app/(command)/incidents/page.tsx
"use client"

import Link from "next/link"
import { useCommandRealtime } from "@/components/shared/RealtimeProvider"
import { EmptyState } from "@/components/shared/EmptyState"
import { PageHeader } from "@/components/shared/PageHeader"
import { SeverityBadge, StatusBadge } from "@/components/command/SeverityBadge"
import { sortIncidentsCriticalFirst } from "@/lib/command/kpis"
import { formatIst, shortIncidentId } from "@/lib/ui/format"
import { cn } from "@/lib/utils"

export default function IncidentsPage() {
  const { snapshot } = useCommandRealtime()
  const rows = sortIncidentsCriticalFirst(snapshot.incidents)
  const assigned = new Map(
    snapshot.dispatches.map((d) => [d.incident_id, d.responder_name ?? d.responder_id]),
  )

  return (
    <main className="sts-enter p-4 sm:p-6">
      <PageHeader
        kicker="Triage"
        title="Incidents"
        description="Critical first. Severity, status, and identity at a glance."
      />
      {rows.length === 0 ? (
        <EmptyState
          kicker="All clear"
          title="No active incidents require attention."
          description="SOS, geofence, and anomaly events land here as soon as they open."
        />
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {rows.map((incident) => (
            <li key={incident.id}>
              <Link
                href={`/incidents/${incident.id}`}
                className="flex gap-3 py-3.5 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={cn(
                    "w-0.5 shrink-0",
                    incident.severity === "critical" && "bg-severity-critical",
                    incident.severity === "high" && "bg-severity-high",
                    incident.severity === "medium" && "bg-severity-medium",
                    incident.severity === "low" && "bg-severity-low",
                    incident.severity === "info" && "bg-severity-info",
                  )}
                  aria-hidden
                />
                <span className="grid min-w-0 flex-1 gap-1 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_auto] sm:items-baseline sm:gap-4">
                  <span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <SeverityBadge severity={incident.severity} />
                      <StatusBadge status={incident.status} />
                    </span>
                    <span className="mt-1 block text-sm font-medium">
                      {incident.tourist_name ?? "Unknown tourist"}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {incident.type.replaceAll("_", " ")} ·{" "}
                      {incident.zone_name ?? incident.address_text ?? "unlocated"}
                    </span>
                  </span>
                  <span className="sts-meta">
                    <span className="block">{formatIst(incident.occurred_at)}</span>
                    <span className="block">
                      {incident.tourist_token_id ? "Verified" : "Verification required"}
                    </span>
                    <span className="block">
                      {assigned.get(incident.id)
                        ? `Unit ${assigned.get(incident.id)}`
                        : "Unassigned"}
                    </span>
                  </span>
                  <span className="sts-meta text-foreground">
                    {shortIncidentId(incident.id)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
