// apps/web/src/lib/ai/efir.ts
import "server-only"

import { createHash, randomUUID } from "node:crypto"

import { keccak256, stringToHex } from "viem"

import { generateIncidentNarrative } from "@/lib/ai/brief"
import { appendIncidentEvent, writeAudit } from "@/lib/command/audit"
import { fetchIncidentById } from "@/lib/command/queries"
import { activeChainId, incidentAnchorAddress } from "@/lib/chain/config"
import { storageBuckets } from "@/lib/chain/env"
import { createAdminClient } from "@/lib/supabase/admin"
import { renderEfirPdf } from "@/lib/utils/pdf"
import type { NotifyIncident } from "@/lib/notify/types"

export type EfirDraftResult = {
  ok: true
  draft_id: string
  pdf_path: string | null
  pdf_sha256: string | null
  emailed: boolean
  anchored: boolean
  failures: string[]
  model: string
}

async function emailDraft(args: {
  pdf: Buffer | null
  incidentId: string
  narrative: string
  touristName: string | null
  type: string
  occurredAt: string
}): Promise<boolean> {
  const { sendEfirEmail } = await import("@/lib/notify/channels/email")
  const { NotConfiguredError } = await import("@/lib/notify/errors")
  try {
    await sendEfirEmail({
      incident: {
        id: args.incidentId,
        touristName: args.touristName,
        type: args.type as NotifyIncident["type"],
        occurredAt: args.occurredAt,
      },
      narrative: args.narrative,
      stationName: "NE Tourist Safety Control Room",
      pdfPath: null,
      pdfBuffer: args.pdf,
    })
    return true
  } catch (cause) {
    if (cause instanceof NotConfiguredError) return false
    throw cause
  }
}

export async function draftEfir(incidentId: string): Promise<EfirDraftResult> {
  const incident = await fetchIncidentById(incidentId)
  if (!incident) {
    throw new Error("incident_not_found")
  }

  const failures: string[] = []
  const draftId = randomUUID()
  const narrative = await generateIncidentNarrative(incident, "efir")

  let pdf: Buffer | null = null
  try {
    pdf = await renderEfirPdf({
      draftId,
      incidentId,
      stationName: "NE Tourist Safety Control Room",
      touristName: incident.tourist_name,
      nationality: incident.nationality,
      occurredAt: incident.occurred_at,
      zoneName: incident.zone_name,
      addressText: incident.address_text,
      lat: incident.lat,
      lon: incident.lon,
      incidentType: incident.type,
      severity: incident.severity,
      narrative: narrative.text,
    })
  } catch (cause) {
    failures.push(`pdf:${cause instanceof Error ? cause.message : "failed"}`)
  }

  let pdfPath: string | null = null
  let pdfSha256: string | null = null
  if (pdf) {
    pdfSha256 = createHash("sha256").update(pdf).digest("hex")
    pdfPath = `${incidentId}/${draftId}.pdf`
    const admin = createAdminClient()
    const bucket = storageBuckets().efir
    const { error } = await admin.storage.from(bucket).upload(pdfPath, pdf, {
      contentType: "application/pdf",
      upsert: true,
    })
    if (error) {
      failures.push(`storage:${error.message}`)
      pdfPath = null
    }
  }

  let emailed = false
  try {
    emailed = await emailDraft({
      pdf,
      incidentId,
      narrative: narrative.text,
      touristName: incident.tourist_name,
      type: incident.type,
      occurredAt: incident.occurred_at,
    })
  } catch (cause) {
    failures.push(`email:${cause instanceof Error ? cause.message : "failed"}`)
  }

  const admin = createAdminClient()
  const { error: insertError } = await admin.from("efir_drafts").insert({
    id: draftId,
    incident_id: incidentId,
    tourist_id: incident.tourist_id,
    station_name: "NE Tourist Safety Control Room",
    narrative: narrative.text,
    structured: {
      type: incident.type,
      severity: incident.severity,
      occurred_at: incident.occurred_at,
      lat: incident.lat,
      lon: incident.lon,
      model: narrative.model,
      fallback_used: narrative.fallbackUsed,
    },
    pdf_path: pdfPath,
    pdf_sha256: pdfSha256,
  })
  if (insertError) {
    throw new Error(insertError.message)
  }

  let anchored = false
  if (pdfSha256) {
    try {
      const recordHash = keccak256(stringToHex(pdfSha256))
      const { error } = await admin.from("chain_anchors").insert({
        kind: "efir",
        subject_id: draftId,
        record_hash: recordHash,
        chain_id: activeChainId(),
        contract_address: incidentAnchorAddress(),
        status: "pending",
      })
      if (error) {
        failures.push(`anchor:${error.message}`)
      } else {
        anchored = true
      }
    } catch (cause) {
      failures.push(`anchor:${cause instanceof Error ? cause.message : "failed"}`)
    }
  }

  await appendIncidentEvent({
    incidentId,
    eventType: "note",
    actorLabel: "pipeline",
    detail: {
      kind: "efir",
      draft_id: draftId,
      model: narrative.model,
      pdf_sha256: pdfSha256,
    },
  })
  await writeAudit({
    action: "efir.generate",
    entity: "efir_drafts",
    entityId: draftId,
    after: { model: narrative.model, emailed, anchored },
  })

  return {
    ok: true,
    draft_id: draftId,
    pdf_path: pdfPath,
    pdf_sha256: pdfSha256,
    emailed,
    anchored,
    failures,
    model: narrative.model,
  }
}
