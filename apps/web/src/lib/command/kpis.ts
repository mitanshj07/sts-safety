// apps/web/src/lib/command/kpis.ts
import type { CommandKpis, LiveIncident, LiveResponder, LiveTourist } from "@/lib/command/types"
import type { SeverityLevel } from "@sts/shared"

const SEVERITIES: SeverityLevel[] = ["info", "low", "medium", "high", "critical"]

const OPEN_STATUSES = new Set(["open", "acknowledged", "dispatched"])

export function emptySeverityCounts(): Record<SeverityLevel, number> {
  return { info: 0, low: 0, medium: 0, high: 0, critical: 0 }
}

export function computeKpis(
  tourists: LiveTourist[],
  incidents: LiveIncident[],
  responders: LiveResponder[],
  anchoredCount: number,
  signalLostMinutes = 20,
): CommandKpis {
  const cutoff = Date.now() - signalLostMinutes * 60_000
  const activeTourists = tourists.filter((t) => {
    if (t.status && t.status !== "active") return false
    if (!t.last_ping_at) return false
    return new Date(t.last_ping_at).getTime() >= cutoff
  }).length

  const openBySeverity = emptySeverityCounts()
  for (const incident of incidents) {
    if (OPEN_STATUSES.has(incident.status) && incident.severity in openBySeverity) {
      openBySeverity[incident.severity] += 1
    }
  }

  const ackDeltas: number[] = []
  const resolveDeltas: number[] = []
  for (const incident of incidents) {
    const occurred = new Date(incident.occurred_at).getTime()
    if (incident.acknowledged_at) {
      ackDeltas.push(new Date(incident.acknowledged_at).getTime() - occurred)
    }
    if (incident.resolved_at) {
      resolveDeltas.push(new Date(incident.resolved_at).getTime() - occurred)
    }
  }

  const mean = (values: number[]): number | null => {
    if (values.length === 0) return null
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length / 1000)
  }

  return {
    activeTourists,
    openBySeverity,
    mttaSeconds: mean(ackDeltas),
    mttrSeconds: mean(resolveDeltas),
    onDutyResponders: responders.filter((r) => r.on_duty).length,
    anchoredIncidents: anchoredCount,
  }
}

export function severityRank(severity: SeverityLevel): number {
  return SEVERITIES.indexOf(severity)
}

export function sortIncidentsCriticalFirst(incidents: LiveIncident[]): LiveIncident[] {
  return [...incidents].sort((a, b) => {
    const rank = severityRank(b.severity) - severityRank(a.severity)
    if (rank !== 0) return rank
    return new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
  })
}

export function formatDuration(totalSeconds: number | null): string {
  if (totalSeconds === null || !Number.isFinite(totalSeconds)) return "—"
  const seconds = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function formatElapsed(fromIso: string, now = Date.now()): string {
  return formatDuration(Math.floor((now - new Date(fromIso).getTime()) / 1000))
}
