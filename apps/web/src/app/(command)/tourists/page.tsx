// apps/web/src/app/(command)/tourists/page.tsx
"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Users } from "lucide-react"
import { useCommandRealtime } from "@/components/shared/RealtimeProvider"
import { EmptyState } from "@/components/shared/EmptyState"
import { PageHeader } from "@/components/shared/PageHeader"
import { ScoreBar } from "@/components/shared/ScoreBar"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function TouristsPage() {
  const { snapshot } = useCommandRealtime()
  const [query, setQuery] = useState("")
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...snapshot.tourists]
      .filter((t) =>
        q.length === 0
          ? true
          : `${t.full_name} ${t.nationality} ${t.id}`.toLowerCase().includes(q),
      )
      .sort((a, b) => a.safety_score - b.safety_score)
  }, [snapshot.tourists, query])

  return (
    <main className="sts-enter p-6">
      <PageHeader
        kicker="Roster"
        title="Tourists"
        description="Searchable roster, lowest safety score first."
        actions={
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name / nationality"
            className="max-w-xs"
          />
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={query ? "No matches" : "No tourists in range"}
          description={
            query
              ? "Try a different name or nationality."
              : "Active travellers appear here once they issue an ID or ping."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Nationality</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Open</TableHead>
                <TableHead>Last ping</TableHead>
                <TableHead>ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((tourist) => (
                <TableRow key={tourist.id}>
                  <TableCell>
                    <Link href={`/tourists/${tourist.id}`} className="font-medium underline-offset-4 hover:underline">
                      {tourist.full_name}
                    </Link>
                  </TableCell>
                  <TableCell>{tourist.nationality}</TableCell>
                  <TableCell>
                    <ScoreBar score={tourist.safety_score} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{tourist.open_incidents}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {tourist.last_ping_at
                      ? new Date(tourist.last_ping_at).toLocaleTimeString("en-IN", {
                          hour12: false,
                        })
                      : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {tourist.id_status ?? "none"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  )
}
