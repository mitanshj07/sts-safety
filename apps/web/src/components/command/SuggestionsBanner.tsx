// apps/web/src/components/command/SuggestionsBanner.tsx
"use client"

import Link from "next/link"
import { useMemo } from "react"
import { Sparkles } from "lucide-react"
import { clusterHotspotIncidents } from "@sts/shared"
import { useCommandRealtime } from "@/components/shared/RealtimeProvider"

export function SuggestionsBanner() {
  const { snapshot } = useCommandRealtime()
  const count = useMemo(() => {
    const incidents = snapshot.incidents.flatMap((incident) => {
      if (incident.lat === null || incident.lon === null) return []
      if (incident.status === "false_positive" || incident.status === "expired") return []
      return [
        {
          id: incident.id,
          tourist_id: incident.tourist_id,
          type: incident.type,
          lat: incident.lat,
          lon: incident.lon,
          occurred_at: incident.occurred_at,
          address_text: incident.address_text,
        },
      ]
    })
    return clusterHotspotIncidents(incidents).length
  }, [snapshot.incidents])

  if (count === 0) return null

  return (
    <Link
      href="/suggestions"
      className="flex items-center gap-2 border-b border-severity-high/30 bg-severity-high/10 px-4 py-2 text-sm text-severity-high hover:bg-severity-high/15"
    >
      <Sparkles className="size-4 shrink-0" />
      <span>
        AI detected {count} GPS hotspot{count === 1 ? "" : "s"} from clustered SOS / alerts.
        Review reserved-area suggestions.
      </span>
    </Link>
  )
}
