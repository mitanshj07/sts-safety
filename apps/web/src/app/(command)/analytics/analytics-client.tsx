// apps/web/src/app/(command)/analytics/analytics-client.tsx
"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { LiveIncident } from "@/lib/command/types"

const COLORS = ["#ef4444", "#f97316", "#f59e0b", "#10b981", "#64748b", "#38bdf8"]

export function AnalyticsClient({
  incidents,
  ranking,
}: {
  incidents: LiveIncident[]
  ranking: Array<{
    name: string
    incident_count_30d: number
    severe_count_30d: number
    risk_level: string
  }>
}) {
  const byZone = ranking.map((row) => ({
    name: row.name,
    count: row.incident_count_30d,
    severe: row.severe_count_30d,
  }))

  const byType = Object.entries(
    incidents.reduce<Record<string, number>>((acc, incident) => {
      acc[incident.type] = (acc[incident.type] ?? 0) + 1
      return acc
    }, {}),
  ).map(([name, value]) => ({ name: name.replaceAll("_", " "), value }))

  const byDay = Object.entries(
    incidents.reduce<Record<string, { ack: number[]; resolve: number[] }>>(
      (acc, incident) => {
        const day = incident.occurred_at.slice(0, 10)
        const bucket = acc[day] ?? { ack: [], resolve: [] }
        const occurred = new Date(incident.occurred_at).getTime()
        if (incident.acknowledged_at) {
          bucket.ack.push(
            (new Date(incident.acknowledged_at).getTime() - occurred) / 1000,
          )
        }
        if (incident.resolved_at) {
          bucket.resolve.push(
            (new Date(incident.resolved_at).getTime() - occurred) / 1000,
          )
        }
        acc[day] = bucket
        return acc
      },
      {},
    ),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, bucket]) => ({
      day,
      mtta:
        bucket.ack.length === 0
          ? 0
          : Math.round(bucket.ack.reduce((a, b) => a + b, 0) / bucket.ack.length),
      mttr:
        bucket.resolve.length === 0
          ? 0
          : Math.round(
              bucket.resolve.reduce((a, b) => a + b, 0) / bucket.resolve.length,
            ),
    }))

  return (
    <main className="sts-enter grid gap-4 p-6 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <p className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
          Intelligence
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Zone pressure, response times, and incident mix for the last window.
        </p>
      </div>
      <Card className="border-border/80 bg-card/80">
        <CardHeader>
          <CardTitle>Incidents by zone</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byZone}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#f59e0b" />
              <Bar dataKey="severe" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card className="border-border/80 bg-card/80">
        <CardHeader>
          <CardTitle>MTTA / MTTR trend</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={byDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis />
              <Tooltip />
              <Line dataKey="mtta" stroke="#38bdf8" dot={false} />
              <Line dataKey="mttr" stroke="#f97316" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card className="border-border/80 bg-card/80">
        <CardHeader>
          <CardTitle>Incident type distribution</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={byType} dataKey="value" nameKey="name" outerRadius={90} label>
                {byType.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card className="border-border/80 bg-card/80">
        <CardHeader>
          <CardTitle>Zone risk ranking</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm">
            {ranking.map((row, index) => (
              <li key={row.name} className="flex justify-between gap-2">
                <span>
                  {index + 1}. {row.name}{" "}
                  <span className="text-muted-foreground">({row.risk_level})</span>
                </span>
                <span className="font-mono text-xs">
                  {row.severe_count_30d} sev / {row.incident_count_30d}
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </main>
  )
}
