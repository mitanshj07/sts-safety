// apps/web/src/components/command/ChainProofBadge.tsx
"use client"

import { useEffect, useState } from "react"
import { incidentRecordHash, type IncidentRecordCore } from "@sts/shared"
import { verifyIncidentProof, verifyTokenOnChain, type IntegrityProof } from "@/app/(command)/actions"
import { Badge } from "@/components/ui/badge"
import { publicEnv } from "@/lib/config/public"
import { cn } from "@/lib/utils"

export function ChainProofBadge({
  incidentId,
  core,
  blockNumber,
  kind = "incident",
  tokenId,
  idStatus,
}: {
  incidentId?: string
  core?: IncidentRecordCore
  blockNumber?: number | null
  kind?: "incident" | "identity"
  tokenId?: string | null
  idStatus?: string | null
}) {
  const [proof, setProof] = useState<IntegrityProof | null>(null)
  const [idLive, setIdLive] = useState<{
    valid: boolean
    status: number
    explorerUrl: string | null
    source: "chain" | "mirror" | "offline"
  } | null>(null)
  const localHash = core ? incidentRecordHash(core) : null

  useEffect(() => {
    if (kind !== "incident" || !incidentId) return
    let cancelled = false
    void verifyIncidentProof(incidentId).then((result) => {
      if (!cancelled) setProof(result)
    })
    return () => {
      cancelled = true
    }
  }, [incidentId, kind])

  useEffect(() => {
    if (kind !== "identity" || !tokenId) return
    let cancelled = false
    void verifyTokenOnChain(tokenId).then((result) => {
      if (cancelled) return
      if (result.ok) {
        setIdLive({
          valid: result.valid,
          status: result.status,
          explorerUrl: result.explorerUrl,
          source: "chain",
        })
        return
      }
      setIdLive({
        valid: idStatus === "active",
        status: 0,
        explorerUrl: null,
        source: "offline",
      })
    })
    return () => {
      cancelled = true
    }
  }, [kind, tokenId, idStatus])

  if (kind === "identity") {
    const explorer =
      idLive?.explorerUrl ??
      (tokenId
        ? `${publicEnv.blockExplorer}/token/${publicEnv.touristIdRegistry}?a=${tokenId}`
        : `${publicEnv.blockExplorer}/address/${publicEnv.touristIdRegistry}`)
    const ok = idLive?.valid ?? idStatus === "active"
    const label = !idLive
      ? `Checking token ${tokenId ?? "—"}`
      : idLive.source === "offline"
        ? `Chain offline · DB ${idStatus ?? "missing"}`
        : ok
          ? `Verified on ${publicEnv.chainName} · token ${tokenId ?? "—"}`
          : "Integrity broken"
    return (
      <a href={explorer} target="_blank" rel="noreferrer" className="inline-flex">
        <Badge
          variant="outline"
          className={cn(
            "font-mono",
            ok
              ? "border-verified/40 bg-verified/15 text-verified"
              : "border-broken/40 bg-broken/15 text-broken",
            idLive?.source === "offline" && "border-border text-muted-foreground",
          )}
        >
          {label}
        </Badge>
      </a>
    )
  }

  const hashMismatch =
    localHash !== null && proof !== null && proof.recordHash !== "0x" && proof.recordHash !== localHash
  const status = hashMismatch ? "broken" : (proof?.status ?? "offline")
  const block = proof?.blockNumber ?? blockNumber ?? null
  const href = proof?.explorerUrl ?? `${publicEnv.blockExplorer}/address/${publicEnv.incidentAnchor}`

  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex max-w-full">
      <Badge
        variant="outline"
        title={localHash ?? undefined}
        className={cn(
          "max-w-full truncate font-mono",
          status === "verified" && "border-verified/40 bg-verified/15 text-verified",
          status === "broken" && "border-broken/40 bg-broken/15 text-broken",
          status === "offline" && "border-border text-muted-foreground",
        )}
      >
        {status === "verified" &&
          `Verified on ${publicEnv.chainName} · block ${block ?? "—"}`}
        {status === "broken" && "Integrity broken"}
        {status === "offline" && (proof?.reason ?? "Chain offline · hash computed locally")}
      </Badge>
    </a>
  )
}
