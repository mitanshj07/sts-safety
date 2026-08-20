// apps/web/src/app/(command)/incidents/[id]/page.tsx
import { notFound } from "next/navigation"
import { MapCanvas } from "@/components/map/MapCanvas"
import { ZoneLayer } from "@/components/map/ZoneLayer"
import { IncidentLayer } from "@/components/map/IncidentLayer"
import { TrackReplay } from "@/components/map/TrackReplay"
import { AiBriefPanel } from "@/components/command/AiBriefPanel"
import { ChainProofBadge } from "@/components/command/ChainProofBadge"
import { DispatchPanel } from "@/components/command/DispatchPanel"
import { ElapsedTimer } from "@/components/command/ElapsedTimer"
import { IncidentActions } from "@/components/command/IncidentActions"
import { IncidentTimeline } from "@/components/command/IncidentTimeline"
import { SeverityBadge, StatusBadge } from "@/components/command/SeverityBadge"
import { TouristCard } from "@/components/command/TouristCard"
import { TouristSosLine } from "@/components/command/TouristSosLine"
import {
  fetchCommandSnapshot,
  fetchIncidentById,
  fetchIncidentEvents,
  fetchNearestResponders,
  fetchTouristDetail,
  fetchTrackLastHour,
  signedPhotoUrl,
} from "@/lib/command/queries"
import { toIncidentPoints, toZoneInputs } from "@/lib/command/map-adapters"

type PageProps = { params: Promise<{ id: string }> }

export default async function IncidentDetailPage({ params }: PageProps) {
  const { id } = await params
  const incident = await fetchIncidentById(id)
  if (!incident) notFound()

  const [events, snapshot, track, nearest, touristDetail] = await Promise.all([
    fetchIncidentEvents(id),
    fetchCommandSnapshot(),
    incident.tourist_id ? fetchTrackLastHour(incident.tourist_id) : Promise.resolve([]),
    incident.lat !== null && incident.lon !== null
      ? fetchNearestResponders(incident.lat, incident.lon, id)
      : Promise.resolve([]),
    incident.tourist_id ? fetchTouristDetail(incident.tourist_id) : Promise.resolve(null),
  ])

  const zone = snapshot.zones.filter((z) => z.id === incident.zone_id)
  const photoUrl = touristDetail
    ? await signedPhotoUrl(touristDetail.tourist.photo_path)
    : null

  const core =
    incident.lat !== null && incident.lon !== null
      ? {
          id: incident.id,
          tourist_token_id: incident.tourist_token_id,
          type: incident.type,
          severity: incident.severity,
          occurred_at: incident.occurred_at,
          lat: incident.lat,
          lon: incident.lon,
          zone_id: incident.zone_id,
          detected_by: incident.detected_by,
          payload: incident.payload,
        }
      : undefined

  return (
    <main className="sts-enter grid gap-4 p-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        <header className="flex flex-wrap items-center gap-2">
          <div className="mr-auto">
            <p className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
              Incident
            </p>
            <h1 className="text-xl font-semibold tracking-tight">
              {incident.type.replaceAll("_", " ")}
            </h1>
          </div>
          <SeverityBadge severity={incident.severity} />
          <StatusBadge status={incident.status} />
          <ElapsedTimer from={incident.occurred_at} />
        </header>
        <ChainProofBadge
          incidentId={incident.id}
          core={core}
          blockNumber={incident.anchor_block}
        />
        <AiBriefPanel
          incidentId={incident.id}
          brief={incident.ai_brief}
          model={incident.ai_brief_model}
        />
        <TouristSosLine payload={incident.payload} />
        {touristDetail ? (
          <TouristCard
            tourist={touristDetail.tourist}
            contacts={touristDetail.contacts}
            digitalId={touristDetail.digitalId}
            photoUrl={photoUrl}
          />
        ) : null}
        <div className="relative h-[28rem] overflow-hidden rounded-2xl border border-border">
          <MapCanvas
            className="h-full"
            initialCenter={
              incident.lon !== null && incident.lat !== null
                ? [incident.lon, incident.lat]
                : undefined
            }
            initialZoom={12}
          >
            <ZoneLayer zones={toZoneInputs(zone)} />
            <IncidentLayer incidents={toIncidentPoints([incident])} selectedId={incident.id} />
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
        <IncidentActions incidentId={incident.id} status={incident.status} />
        <DispatchPanel incidentId={incident.id} responders={nearest} />
        <IncidentTimeline events={events} />
      </div>
    </main>
  )
}
