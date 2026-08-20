// apps/web/src/app/(command)/incidents/page.tsx
"use client"

import Link from "next/link"
import { ShieldAlert } from "lucide-react"
import { useCommandRealtime } from "@/components/shared/RealtimeProvider"
import { EmptyState } from "@/components/shared/EmptyState"
import { PageHeader } from "@/components/shared/PageHeader"
import { SeverityBadge, StatusBadge } from "@/components/command/SeverityBadge"
import { sortIncidentsCriticalFirst } from "@/lib/command/kpis"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function IncidentsPage() {
  const { snapshot } = useCommandRealtime()
  const rows = sortIncidentsCriticalFirst(snapshot.incidents)

  return (
    <main className="sts-enter p-6">
      <PageHeader
        kicker="Queue"
        title="Incidents"
        description="Critical-first, newest-first. Live via Realtime."
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No incidents yet"
          description="SOS, geofence, and anomaly events land here as soon as they open."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Tourist</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Zone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((incident) => (
                <TableRow key={incident.id}>
                  <TableCell className="font-mono text-xs">
                    {new Date(incident.occurred_at).toLocaleString("en-IN", {
                      hour12: false,
                    })}
                  </TableCell>
                  <TableCell>
                    <Link href={`/incidents/${incident.id}`} className="font-medium underline-offset-4 hover:underline">
                      {incident.tourist_name ?? incident.id.slice(0, 8)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs">{incident.type.replaceAll("_", " ")}</TableCell>
                  <TableCell>
                    <SeverityBadge severity={incident.severity} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={incident.status} />
                  </TableCell>
                  <TableCell className="text-xs">{incident.zone_name ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  )
}
