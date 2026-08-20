// apps/web/src/app/(command)/zones/zones-client.tsx
"use client"

import { useMemo, useState, useTransition } from "react"
import type { Feature, Polygon } from "geojson"
import { toast } from "sonner"
import { saveZone } from "@/app/(command)/actions"
import { MapCanvas } from "@/components/map/MapCanvas"
import { ZoneDrawEditor } from "@/components/map/ZoneDrawEditor"
import { ZoneLayer } from "@/components/map/ZoneLayer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toZoneInputs } from "@/lib/command/map-adapters"
import { useCommandRealtime } from "@/components/shared/RealtimeProvider"
import type { RiskLevel, ZoneCategory } from "@sts/shared"
import kinks from "@turf/kinks"
import booleanIntersects from "@turf/boolean-intersects"

const CATEGORIES: ZoneCategory[] = [
  "safe",
  "caution",
  "restricted",
  "high_risk",
  "border",
  "forest_reserve",
  "accommodation",
  "checkpoint",
  "medical",
]

const RISKS: RiskLevel[] = ["none", "low", "medium", "high", "critical"]

export function ZonesClient() {
  const { snapshot, refresh } = useCommandRealtime()
  const [name, setName] = useState("")
  const [category, setCategory] = useState<ZoneCategory>("caution")
  const [risk, setRisk] = useState<RiskLevel>("medium")
  const [from, setFrom] = useState("05:30")
  const [to, setTo] = useState("17:30")
  const [geom, setGeom] = useState<Polygon | null>(null)
  const [pending, start] = useTransition()

  const validity = useMemo(() => {
    if (!geom) return { ok: false, message: "Draw a polygon to begin." }
    try {
      const kinked = kinks(geom)
      if (kinked.features.length > 0) {
        return { ok: false, message: "ST_IsValid would fail: self-intersection." }
      }
    } catch {
      return { ok: false, message: "ST_IsValid would fail: unparseable ring." }
    }
    const overlaps = snapshot.zones.filter((zone) => {
      if (!zone.geom) return false
      try {
        return booleanIntersects(geom, zone.geom)
      } catch {
        return false
      }
    })
    if (overlaps.length > 0) {
      return {
        ok: true,
        message: `Valid geometry. Overlaps: ${overlaps.map((z) => z.name).join(", ")}`,
      }
    }
    return { ok: true, message: "ST_IsValid: polygon looks clean. No overlaps." }
  }, [geom, snapshot.zones])

  return (
    <main className="sts-enter grid h-full min-h-0 gap-4 p-4 xl:grid-cols-[1.4fr_22rem]">
      <div className="relative min-h-[28rem] overflow-hidden border border-border">
        <MapCanvas className="h-full">
          <ZoneLayer zones={toZoneInputs(snapshot.zones)} />
          <ZoneDrawEditor
            onComplete={(feature: Feature<Polygon>) => setGeom(feature.geometry)}
          />
        </MapCanvas>
      </div>
      <form
        className="space-y-3 border border-border bg-surface p-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (!geom) {
            toast.error("Draw a zone first")
            return
          }
          start(async () => {
            const result = await saveZone({
              name,
              category,
              risk_level: risk,
              geom,
              time_windows: [
                {
                  days: [0, 1, 2, 3, 4, 5, 6],
                  from,
                  to,
                  risk_level: risk,
                },
              ],
            })
            if (!result.ok) {
              toast.error(result.error)
              return
            }
            toast.success(result.message)
            void refresh()
          })
        }}
      >
        <h1 className="text-xl font-semibold tracking-tight">Zone editor</h1>
        <p className="text-sm text-muted-foreground">
          Draw a polygon. Geometry is validated before save.
        </p>
        <p className="text-xs text-muted-foreground">{validity.message}</p>
        <div className="grid gap-1">
          <Label htmlFor="zone-name">Name</Label>
          <Input id="zone-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="grid gap-1">
          <Label>Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as ZoneCategory)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label>Risk</Label>
          <Select value={risk} onValueChange={(v) => setRisk(v as RiskLevel)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RISKS.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1">
            <Label htmlFor="from">Window from</Label>
            <Input id="from" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="to">to</Label>
            <Input id="to" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <Textarea readOnly value={geom ? JSON.stringify(geom.coordinates[0]?.length) + " vertices" : ""} />
        <Button type="submit" disabled={pending || !validity.ok || name.trim().length === 0}>
          {pending ? "Saving…" : "Save zone"}
        </Button>
      </form>
    </main>
  )
}
