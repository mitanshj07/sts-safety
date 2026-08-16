// apps/web/src/app/(command)/analytics/page.tsx
import { fetchCommandSnapshot, fetchZoneRiskRanking } from "@/lib/command/queries"
import { AnalyticsClient } from "./analytics-client"

export const dynamic = "force-dynamic"

export default async function AnalyticsPage() {
  const [snapshot, ranking] = await Promise.all([
    fetchCommandSnapshot(),
    fetchZoneRiskRanking(),
  ])
  return <AnalyticsClient incidents={snapshot.incidents} ranking={ranking} />
}
