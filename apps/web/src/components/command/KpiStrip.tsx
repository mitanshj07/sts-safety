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
    <div className="min-w-0 px-3 py-2">
      <p className="text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "font-mono text-2xl font-semibold tabular-nums tracking-tight",
          tone === "critical" && "text-severity-critical",
          tone === "live" && "text-live",
          tone === "muted" && "text-muted-foreground",
        )}
        aria-label={`${label} ${value}`}
      >
        {value}
      </p>
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

  return (
    <div className="grid grid-cols-2 divide-x divide-border border-b border-border bg-card/90 md:grid-cols-6">
      <Cell label="Active tourists" value={String(kpis?.activeTourists ?? 0)} tone="live" />
      <Cell
        label="Open incidents"
        value={`${open} · ${bySeverity.critical}C / ${bySeverity.high}H`}
        tone={bySeverity.critical > 0 ? "critical" : "muted"}
      />
      <Cell label="MTTA" value={formatDuration(kpis?.mttaSeconds ?? null)} />
      <Cell label="MTTR" value={formatDuration(kpis?.mttrSeconds ?? null)} />
      <Cell label="On-duty units" value={String(kpis?.onDutyResponders ?? 0)} />
      <Cell label="Anchored" value={String(kpis?.anchoredIncidents ?? 0)} />
    </div>
  )
}
