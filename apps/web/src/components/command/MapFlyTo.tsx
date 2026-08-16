// apps/web/src/components/command/MapFlyTo.tsx
"use client"

import { useEffect } from "react"
import { useMap } from "@/components/map/MapCanvas"
import { useCommandRealtime } from "@/components/shared/RealtimeProvider"

export function MapFlyTo() {
  const { map, isLoaded } = useMap()
  const { snapshot, selectedIncidentId } = useCommandRealtime()
  const selected = snapshot.incidents.find((i) => i.id === selectedIncidentId)

  useEffect(() => {
    if (!map || !isLoaded || !selected || selected.lat === null || selected.lon === null) {
      return
    }
    map.flyTo({
      center: [selected.lon, selected.lat],
      zoom: 13,
      speed: 1.4,
      essential: true,
    })
  }, [map, isLoaded, selected])

  return null
}
