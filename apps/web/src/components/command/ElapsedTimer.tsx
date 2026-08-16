// apps/web/src/components/command/ElapsedTimer.tsx
"use client"

import { useEffect, useState } from "react"
import { formatElapsed } from "@/lib/command/kpis"

export function ElapsedTimer({ from }: { from: string }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [])
  return <span className="font-mono tabular-nums">{formatElapsed(from)}</span>
}
