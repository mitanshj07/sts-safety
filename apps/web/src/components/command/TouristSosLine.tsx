// apps/web/src/components/command/TouristSosLine.tsx
import { touristSosMessage } from "@sts/shared"

export function TouristSosLine({
  payload,
}: {
  payload: Record<string, unknown> | null | undefined
}) {
  const message = touristSosMessage(payload)
  if (!message) return null
  return (
    <div
      className="rounded-2xl border border-red-500/40 bg-red-950/30 p-4"
      data-testid="tourist-sos-line"
    >
      <p className="text-[10px] font-medium tracking-[0.16em] text-red-300/80 uppercase">
        Tourist said
      </p>
      <p className="mt-1 text-sm text-pretty">{message}</p>
    </div>
  )
}
