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
      className="border border-danger/30 bg-danger/10 px-4 py-4"
      data-testid="tourist-sos-line"
    >
      <p className="sts-kicker text-danger">Tourist said</p>
      <p className="mt-1 text-sm text-pretty">{message}</p>
    </div>
  )
}
