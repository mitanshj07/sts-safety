// apps/web/src/components/shared/RealtimeProvider.tsx
"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { getBrowserSupabase } from "@/lib/supabase/client"
import { computeKpis, emptySeverityCounts } from "@/lib/command/kpis"
import type {
  CommandSnapshot,
  ConnectionStatus,
  OperatorPresence,
} from "@/lib/command/types"

const EMPTY: CommandSnapshot = {
  tourists: [],
  incidents: [],
  dispatches: [],
  zones: [],
  responders: [],
  kpis: {
    activeTourists: 0,
    openBySeverity: emptySeverityCounts(),
    mttaSeconds: null,
    mttrSeconds: null,
    onDutyResponders: 0,
    anchoredIncidents: 0,
  },
  fetchedAt: new Date(0).toISOString(),
}

type RealtimeContextValue = {
  snapshot: CommandSnapshot
  connection: ConnectionStatus
  presence: OperatorPresence[]
  selectedIncidentId: string | null
  setSelectedIncidentId: (id: string | null) => void
  lastCriticalId: string | null
  refresh: () => Promise<void>
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null)

export function useCommandRealtime(): RealtimeContextValue {
  const value = useContext(RealtimeContext)
  if (!value) {
    throw new Error("useCommandRealtime must be used inside RealtimeProvider")
  }
  return value
}

async function loadSnapshot(): Promise<CommandSnapshot> {
  const res = await fetch("/api/command/snapshot", { cache: "no-store" })
  if (!res.ok) throw new Error(`snapshot ${res.status}`)
  return (await res.json()) as CommandSnapshot
}

export function RealtimeProvider({
  initial,
  children,
}: {
  initial?: CommandSnapshot
  children: ReactNode
}) {
  const [snapshot, setSnapshot] = useState<CommandSnapshot>(initial ?? EMPTY)
  const [connection, setConnection] = useState<ConnectionStatus>("connecting")
  const [presence, setPresence] = useState<OperatorPresence[]>([])
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null)
  const [lastCriticalId, setLastCriticalId] = useState<string | null>(null)
  const knownIds = useRef(new Set((initial?.incidents ?? []).map((i) => i.id)))
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const next = await loadSnapshot()
      setSnapshot(next)
      for (const incident of next.incidents) {
        if (
          !knownIds.current.has(incident.id) &&
          incident.severity === "critical" &&
          ["open", "acknowledged", "dispatched"].includes(incident.status)
        ) {
          setLastCriticalId(incident.id)
        }
        knownIds.current.add(incident.id)
      }
    } catch {
      setConnection((prev) => (prev === "live" ? prev : "polling"))
    }
  }, [])

  const startPolling = useCallback(() => {
    if (pollRef.current) return
    setConnection("polling")
    pollRef.current = setInterval(() => {
      void refresh()
    }, 800)
  }, [refresh])

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  useEffect(() => {
    void refresh()
    const supabase = getBrowserSupabase()
    if (!supabase) {
      startPolling()
      return () => stopPolling()
    }

    const channel: RealtimeChannel = supabase.channel("command-centre", {
      config: { presence: { key: `op-${Math.random().toString(36).slice(2, 8)}` } },
    })

    const onChange = (): void => {
      void refresh()
    }

    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incidents" },
        onChange,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dispatches" },
        onChange,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tourists" },
        onChange,
      )
      .on("broadcast", { event: "incident" }, onChange)
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState()
        const next: OperatorPresence[] = []
        for (const [key, metas] of Object.entries(state)) {
          const meta = Array.isArray(metas) ? metas[0] : undefined
          const rec = (meta ?? {}) as { label?: unknown; at?: unknown }
          next.push({
            key,
            label: typeof rec.label === "string" ? rec.label : "Operator",
            arrivedAt: typeof rec.at === "string" ? rec.at : new Date().toISOString(),
          })
        }
        setPresence(next)
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setConnection("live")
          stopPolling()
          await channel.track({
            label: "Command operator",
            at: new Date().toISOString(),
          })
          return
        }
        if (status === "TIMED_OUT" || status === "CHANNEL_ERROR") {
          setConnection("reconnecting")
          startPolling()
          return
        }
        if (status === "CLOSED") {
          setConnection("offline")
          startPolling()
        }
      })

    const watchdog = window.setTimeout(() => {
      setConnection((prev) => {
        if (prev === "connecting") {
          startPolling()
          return "polling"
        }
        return prev
      })
    }, 3000)

    return () => {
      window.clearTimeout(watchdog)
      stopPolling()
      void supabase.removeChannel(channel)
    }
  }, [refresh, startPolling, stopPolling])

  const liveSnapshot = useMemo(() => {
    return {
      ...snapshot,
      kpis: computeKpis(
        snapshot.tourists,
        snapshot.incidents,
        snapshot.responders,
        snapshot.kpis?.anchoredIncidents ?? 0,
      ),
    }
  }, [snapshot])

  const value = useMemo<RealtimeContextValue>(
    () => ({
      snapshot: liveSnapshot,
      connection,
      presence,
      selectedIncidentId,
      setSelectedIncidentId,
      lastCriticalId,
      refresh,
    }),
    [
      liveSnapshot,
      connection,
      presence,
      selectedIncidentId,
      lastCriticalId,
      refresh,
    ],
  )

  return (
    <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
  )
}
