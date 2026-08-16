// apps/web/src/app/(command)/dashboard/dashboard-client.tsx
"use client"

import { DashboardLive } from "@/components/command/DashboardLive"

/** Alias kept so older imports keep working. */
export function DashboardClient() {
  return <DashboardLive />
}
