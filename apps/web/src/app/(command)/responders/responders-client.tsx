// apps/web/src/app/(command)/responders/responders-client.tsx
"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { setResponderDuty } from "@/app/(command)/actions"
import { MapCanvas, ResponderLayer } from "@/components/map/lazy"
import { Switch } from "@/components/ui/switch"
import { useCommandRealtime } from "@/components/shared/RealtimeProvider"

export function RespondersClient() {
  const { snapshot, refresh } = useCommandRealtime()
  const [pending, start] = useTransition()

  return (
    <main className="sts-enter grid h-full min-h-0 gap-4 p-4 xl:grid-cols-[1.3fr_24rem]">
      <div className="relative min-h-[28rem] overflow-hidden border border-border">
        <MapCanvas className="h-full">
          <ResponderLayer responders={snapshot.responders} />
        </MapCanvas>
      </div>
      <div className="border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <h1 className="text-xl font-semibold tracking-tight">Duty roster</h1>
          <p className="text-sm text-muted-foreground">Coverage circles on the map. Toggle units on duty.</p>
        </div>
        <ul className="divide-y divide-border">
          {snapshot.responders.map((responder) => (
            <li key={responder.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{responder.name}</p>
                <p className="text-xs text-muted-foreground">
                  {responder.unit_type.replaceAll("_", " ")} · {responder.station_name}
                </p>
              </div>
              <Switch
                checked={responder.on_duty}
                disabled={pending}
                onCheckedChange={(onDuty) => {
                  start(async () => {
                    const result = await setResponderDuty(responder.id, onDuty)
                    if (!result.ok) toast.error(result.error)
                    else {
                      toast.success(result.message)
                      void refresh()
                    }
                  })
                }}
              />
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
