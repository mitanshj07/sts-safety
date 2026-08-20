// apps/web/src/app/(command)/suggestions/suggestions-client.tsx
"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { Sparkles } from "lucide-react"
import {
  acceptHotspotSuggestion,
  dismissHotspotSuggestion,
  listHotspotSuggestions,
} from "@/app/(command)/actions"
import { MapCanvas } from "@/components/map/MapCanvas"
import { SuggestionLayer } from "@/components/map/SuggestionLayer"
import { ZoneLayer } from "@/components/map/ZoneLayer"
import { IncidentLayer } from "@/components/map/IncidentLayer"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/shared/PageHeader"
import { useCommandRealtime } from "@/components/shared/RealtimeProvider"
import { useMap } from "@/components/map/MapCanvas"
import { toIncidentPoints, toZoneInputs } from "@/lib/command/map-adapters"
import type { HotspotSuggestion } from "@/lib/command/types"
import { cn } from "@/lib/utils"

function FlyToSuggestion({ suggestion }: { suggestion: HotspotSuggestion | null }) {
  const { map, isLoaded } = useMap()
  useEffect(() => {
    if (!map || !isLoaded || !suggestion) return
    map.flyTo({
      center: [suggestion.lon, suggestion.lat],
      zoom: 13,
      speed: 1.2,
      essential: true,
    })
  }, [map, isLoaded, suggestion])
  return null
}

export function SuggestionsClient({ initial }: { initial: HotspotSuggestion[] }) {
  const { snapshot } = useCommandRealtime()
  const [suggestions, setSuggestions] = useState(initial)
  const [selectedId, setSelectedId] = useState<string | null>(initial[0]?.id ?? null)
  const [pending, start] = useTransition()

  const selected = suggestions.find((row) => row.id === selectedId) ?? suggestions[0] ?? null

  function reload(refresh: boolean) {
    start(async () => {
      const next = await listHotspotSuggestions(refresh)
      setSuggestions(next)
      setSelectedId((current) => {
        if (current && next.some((row) => row.id === current)) return current
        return next[0]?.id ?? null
      })
    })
  }

  return (
    <main className="sts-enter grid h-full min-h-0 gap-4 p-4 xl:grid-cols-[1.4fr_24rem]">
      <div className="flex min-h-0 flex-col gap-4">
        <PageHeader
          kicker="Intelligence"
          title="AI zone suggestions"
          description="When SOS and similar alerts cluster from different tourists at similar GPS, the model proposes a reserved geofence. Accepting writes a real restricted zone."
          actions={
            <Button variant="outline" size="sm" disabled={pending} onClick={() => reload(true)}>
              Rescan GPS clusters
            </Button>
          }
        />
        <div className="relative min-h-[28rem] flex-1 overflow-hidden rounded-2xl border border-border">
          <MapCanvas
            className="h-full"
            initialCenter={selected ? [selected.lon, selected.lat] : undefined}
            initialZoom={selected ? 12 : undefined}
          >
            <ZoneLayer zones={toZoneInputs(snapshot.zones)} />
            <SuggestionLayer suggestions={suggestions} selectedId={selected?.id ?? null} />
            <IncidentLayer incidents={toIncidentPoints(snapshot.incidents)} />
            <FlyToSuggestion suggestion={selected} />
          </MapCanvas>
        </div>
      </div>
      <div className="space-y-3 overflow-auto">
        {suggestions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 p-6 text-sm text-muted-foreground">
            No GPS clusters yet. The detector needs at least three distinct tourists raising SOS
            (or similar alerts) within about 500 m in the last 48 hours.
          </div>
        ) : null}
        {suggestions.map((row) => {
          const active = row.id === selected?.id
          return (
            <article
              key={row.id}
              className={cn(
                "space-y-3 rounded-2xl border bg-card/80 p-4",
                active ? "border-primary/60" : "border-border",
              )}
            >
              <button
                type="button"
                className="flex w-full items-start gap-2 text-left"
                onClick={() => setSelectedId(row.id)}
              >
                <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold tracking-tight">{row.proposed_name}</h2>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {row.lat.toFixed(5)}, {row.lon.toFixed(5)} · {row.radius_m} m
                  </p>
                </div>
              </button>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="font-mono uppercase">
                  {row.unique_tourists} tourists
                </Badge>
                <Badge variant="outline" className="font-mono uppercase">
                  {row.incident_count} alerts
                </Badge>
                <Badge variant="outline" className="font-mono uppercase">
                  {row.sos_count} SOS
                </Badge>
                <Badge variant="outline" className="font-mono uppercase">
                  {row.proposed_category.replaceAll("_", " ")}
                </Badge>
                <Badge variant="outline" className="font-mono uppercase">
                  {row.proposed_risk}
                </Badge>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{row.rationale}</p>
              {row.already_reserved ? (
                <p className="text-xs text-severity-medium">
                  Centroid already sits inside reserved zone {row.covering_zone_name ?? "unknown"}.
                </p>
              ) : null}
              <p className="text-[11px] text-muted-foreground">
                Model {row.rationale_model ?? "rules-only"} · {row.window_hours}h window
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={pending || row.already_reserved}
                  onClick={() => {
                    start(async () => {
                      const result = await acceptHotspotSuggestion({ suggestionId: row.id })
                      if (!result.ok) {
                        toast.error(result.error)
                        return
                      }
                      toast.success(result.message ?? "Reserved zone created")
                      reload(false)
                    })
                  }}
                >
                  Mark reserved
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    start(async () => {
                      const result = await dismissHotspotSuggestion({ suggestionId: row.id })
                      if (!result.ok) {
                        toast.error(result.error)
                        return
                      }
                      toast.success("Dismissed")
                      reload(false)
                    })
                  }}
                >
                  Dismiss
                </Button>
              </div>
            </article>
          )
        })}
      </div>
    </main>
  )
}
