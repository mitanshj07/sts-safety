// apps/web/src/components/command/DashboardLive.tsx
"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { MapCanvas } from "@/components/map/MapCanvas"
import { ZoneLayer } from "@/components/map/ZoneLayer"
import { TouristLayer } from "@/components/map/TouristLayer"
import { IncidentLayer } from "@/components/map/IncidentLayer"
import { KpiStrip } from "@/components/command/KpiStrip"
import { IncidentQueue } from "@/components/command/IncidentQueue"
import { IncidentActions } from "@/components/command/IncidentActions"
import { TouristSosLine } from "@/components/command/TouristSosLine"
import { MapFlyTo } from "@/components/command/MapFlyTo"
import { SeverityBadge, StatusBadge } from "@/components/command/SeverityBadge"
import { ElapsedTimer } from "@/components/command/ElapsedTimer"
import { useCommandRealtime } from "@/components/shared/RealtimeProvider"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import {
  toIncidentPoints,
  toTouristPoints,
  toZoneInputs,
} from "@/lib/command/map-adapters"

export function DashboardLive() {
  const { snapshot, selectedIncidentId, setSelectedIncidentId } = useCommandRealtime()
  const selected = snapshot.incidents.find((i) => i.id === selectedIncidentId) ?? null
  const lastOpenedId = useRef<string | null>(null)

  useEffect(() => {
    if (selectedIncidentId) lastOpenedId.current = selectedIncidentId
  }, [selectedIncidentId])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <KpiStrip />
      <div className="flex min-h-0 flex-1">
        <div className="relative min-h-0 min-w-0 flex-1">
          <MapCanvas className="h-full min-h-0">
            <ZoneLayer zones={toZoneInputs(snapshot.zones)} />
            <TouristLayer tourists={toTouristPoints(snapshot.tourists)} />
            <IncidentLayer
              incidents={toIncidentPoints(snapshot.incidents)}
              selectedId={selectedIncidentId}
              onSelect={setSelectedIncidentId}
            />
            <MapFlyTo />
          </MapCanvas>
        </div>
        <div className="hidden h-full md:block">
          <IncidentQueue />
        </div>
      </div>
      <div className="h-48 border-t border-border md:hidden">
        <IncidentQueue />
      </div>
      <Sheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedIncidentId(null)
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-md"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            const id = lastOpenedId.current
            if (id) document.getElementById(`incident-${id}`)?.focus()
          }}
        >
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle className="flex flex-wrap items-center gap-2">
                  {selected.tourist_name ?? "Unknown"}
                  <SeverityBadge severity={selected.severity} />
                  <StatusBadge status={selected.status} />
                </SheetTitle>
                <SheetDescription>
                  {selected.type.replaceAll("_", " ")} ·{" "}
                  {selected.zone_name ?? selected.address_text ?? "unlocated"}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-3 px-4 pb-6">
                <p className="text-xs text-muted-foreground">
                  Elapsed <ElapsedTimer from={selected.occurred_at} />
                </p>
                {selected.ai_brief ? (
                  <p className="text-sm leading-relaxed">{selected.ai_brief}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Rules brief pending — alert already fired without the LLM.
                  </p>
                )}
                <TouristSosLine payload={selected.payload} />
                <IncidentActions incidentId={selected.id} status={selected.status} />
                <Button asChild>
                  <Link href={`/incidents/${selected.id}`}>Open incident</Link>
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
