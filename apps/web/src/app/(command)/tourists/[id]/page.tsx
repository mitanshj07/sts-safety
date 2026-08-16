// apps/web/src/app/(command)/tourists/[id]/page.tsx
import { notFound } from "next/navigation"
import { MapCanvas } from "@/components/map/MapCanvas"
import { TrackReplay } from "@/components/map/TrackReplay"
import { TouristLayer } from "@/components/map/TouristLayer"
import { ChainProofBadge } from "@/components/command/ChainProofBadge"
import { ScoreSparkline } from "@/components/command/ScoreSparkline"
import { TouristCard } from "@/components/command/TouristCard"
import {
  fetchTouristDetail,
  fetchTrackLastHour,
  signedPhotoUrl,
} from "@/lib/command/queries"
import { createAdminClient } from "@/lib/supabase/admin"
import { toTouristPoints } from "@/lib/command/map-adapters"
import { asRecord } from "@/lib/geo/parse"

type PageProps = { params: Promise<{ id: string }> }

export default async function TouristDetailPage({ params }: PageProps) {
  const { id } = await params
  const detail = await fetchTouristDetail(id)
  if (!detail) notFound()

  const [track, photoUrl, incidents] = await Promise.all([
    fetchTrackLastHour(id),
    signedPhotoUrl(detail.tourist.photo_path),
    createAdminClient()
      .from("incidents")
      .select("id, occurred_at, safety_score_at, type, severity")
      .eq("tourist_id", id)
      .order("occurred_at", { ascending: true })
      .limit(48),
  ])

  const spark = (incidents.data ?? []).map((row) => {
    const rec = asRecord(row)
    return {
      t: String(rec.occurred_at),
      score:
        typeof rec.safety_score_at === "number"
          ? rec.safety_score_at
          : detail.tourist.safety_score,
    }
  })
  if (spark.length === 0) {
    spark.push({ t: new Date().toISOString(), score: detail.tourist.safety_score })
  }

  return (
    <main className="sts-enter grid gap-4 p-6 xl:grid-cols-[1.3fr_1fr]">
      <div className="space-y-4">
        <TouristCard
          tourist={detail.tourist}
          contacts={detail.contacts}
          digitalId={detail.digitalId}
          photoUrl={photoUrl}
        />
        <div className="rounded-2xl border border-border bg-card/80 p-4">
          <p className="mb-2 text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Safety score history
          </p>
          <ScoreSparkline data={spark} />
        </div>
        <div className="relative h-[28rem] overflow-hidden rounded-2xl border border-border">
          <MapCanvas
            className="h-full"
            initialCenter={
              detail.tourist.lon !== null && detail.tourist.lat !== null
                ? [detail.tourist.lon, detail.tourist.lat]
                : undefined
            }
            initialZoom={12}
          >
            <TouristLayer tourists={toTouristPoints([detail.tourist])} />
            {track.length >= 2 ? (
              <TrackReplay
                coordinates={track.map((p) => [p.lon, p.lat])}
                times={track.map((p) => p.recorded_at)}
              />
            ) : null}
          </MapCanvas>
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card/80 p-4">
          <p className="mb-2 text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
            ID verification
          </p>
          <ChainProofBadge
            kind="identity"
            tokenId={detail.digitalId.token_id}
            idStatus={detail.digitalId.status}
          />
          <dl className="mt-3 space-y-1 font-mono text-[11px] text-muted-foreground">
            <div>token {detail.digitalId.token_id ?? "—"}</div>
            <div>commitment {detail.digitalId.kyc_commitment ?? "—"}</div>
            <div>holder {detail.digitalId.holder_address ?? "—"}</div>
            <div>
              valid {detail.digitalId.valid_from ?? "—"} → {detail.digitalId.valid_until ?? "—"}
            </div>
          </dl>
        </div>
      </div>
    </main>
  )
}
