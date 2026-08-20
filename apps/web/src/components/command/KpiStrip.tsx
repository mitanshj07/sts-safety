// apps/web/src/components/command/KpiStrip.tsx
"use client"

import { emptySeverityCounts, formatDuration } from "@/lib/command/kpis"
import { useCommandRealtime } from "@/components/shared/RealtimeProvider"
import { cn } from "@/lib/utils"

function Cell({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "critical" | "live" | "muted"
}) {
  return (
    <div className="min-w-0 px-3 py-2.5">
      <p className="sts-kicker">{label}</p>
      <p
        className={cn(
          "mt-1 font-mono text-2xl font-medium tabular-nums tracking-tight",
          tone === "critical" && "text-danger",
          tone === "live" && "text-success",
          tone === "muted" && "text-muted-foreground",
        )}
        aria-label={`${label} ${value}`}
      >
        {value}
      </p>
    </div>
  )
}

export function AttentionBanner() {
  const { snapshot } = useCommandRealtime()
  const bySeverity = snapshot.kpis?.openBySeverity ?? emptySeverityCounts()
  const critical = bySeverity.critical ?? 0
  const high = bySeverity.high ?? 0
  const touristsInTrouble = snapshot.tourists.filter(
    (t) => t.open_incidents > 0 || t.safety_score < 55,
  ).length

  if (critical === 0 && high === 0 && touristsInTrouble === 0) {
    return (
      <div className="border-b border-border px-4 py-2">
        <p className="sts-kicker text-success">All clear</p>
        <p className="text-sm">No active incidents require attention.</p>
      </div>
    )
  }

  const parts = [
    critical > 0 ? `${critical} critical` : null,
    high > 0 ? `${high} high` : null,
    touristsInTrouble > 0 ? `${touristsInTrouble} tourists requiring attention` : null,
  ].filter(Boolean)

  return (
    <div
      className={cn(
        "border-b px-4 py-2",
        critical > 0 ? "border-danger/30 bg-danger/10" : "border-warning/30 bg-warning/10",
      )}
      role="status"
    >
      <p className="sts-kicker">{critical > 0 ? "Active emergencies" : "Needs attention"}</p>
      <p className="text-sm font-medium">{parts.join(" · ")}</p>
    </div>
  )
}

export function KpiStrip() {
  const { snapshot } = useCommandRealtime()
  const kpis = snapshot.kpis
  const bySeverity = kpis?.openBySeverity ?? emptySeverityCounts()
  const open =
    (bySeverity.critical ?? 0) +
    (bySeverity.high ?? 0) +
    (bySeverity.medium ?? 0) +
    (bySeverity.low ?? 0) +
    (bySeverity.info ?? 0)
  const watch = snapshot.tourists.filter(
    (t) => t.open_incidents > 0 || t.safety_score < 55,
  ).length

  return (
    <div>
      <AttentionBanner />
      <div className="grid grid-cols-2 divide-x divide-border border-b border-border bg-surface md:grid-cols-6">
        <Cell
          label="Open incidents"
          value={`${open} · ${bySeverity.critical}C / ${bySeverity.high}H`}
          tone={bySeverity.critical > 0 ? "critical" : "muted"}
        />
        <Cell
          label="Tourists at risk"
          value={String(watch)}
          tone={watch > 0 ? "critical" : "muted"}
        />
        <Cell label="Active tourists" value={String(kpis?.activeTourists ?? 0)} tone="live" />
        <Cell label="On-duty units" value={String(kpis?.onDutyResponders ?? 0)} />
        <Cell label="MTTA" value={formatDuration(kpis?.mttaSeconds ?? null)} />
        <Cell label="MTTR" value={formatDuration(kpis?.mttrSeconds ?? null)} />
      </div>
    </div>
  )
}
