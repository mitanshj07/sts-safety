// apps/web/src/components/command/KpiStrip.tsx
"use client"

import { formatDuration } from "@/lib/command/kpis"
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
  const { kpis } = snapshot
  const open =
    kpis.openBySeverity.critical +
    kpis.openBySeverity.high +
    kpis.openBySeverity.medium +
    kpis.openBySeverity.low +
    kpis.openBySeverity.info

  return (
    <div className="grid grid-cols-2 divide-x divide-border border-b border-border bg-card/90 md:grid-cols-6">
      <Cell label="Active tourists" value={String(kpis.activeTourists)} tone="live" />
      <Cell
        label="Open incidents"
        value={`${open} · ${kpis.openBySeverity.critical}C / ${kpis.openBySeverity.high}H`}
        tone={kpis.openBySeverity.critical > 0 ? "critical" : "muted"}
      />
      <Cell label="MTTA" value={formatDuration(kpis.mttaSeconds)} />
      <Cell label="MTTR" value={formatDuration(kpis.mttrSeconds)} />
      <Cell label="On-duty units" value={String(kpis.onDutyResponders)} />
      <Cell label="Anchored" value={String(kpis.anchoredIncidents)} />
    </div>
  )
}
