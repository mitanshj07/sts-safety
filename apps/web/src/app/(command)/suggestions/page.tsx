// apps/web/src/app/(command)/suggestions/page.tsx
import { listHotspotSuggestions } from "@/app/(command)/actions"
import { SuggestionsClient } from "./suggestions-client"

export const dynamic = "force-dynamic"

export default async function SuggestionsPage() {
  const initial = await listHotspotSuggestions(true)
  return <SuggestionsClient initial={initial} />
}
