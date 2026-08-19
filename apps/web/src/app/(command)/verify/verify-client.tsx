// apps/web/src/app/(command)/verify/verify-client.tsx
"use client"

import { useState } from "react"
import { z } from "zod"
import { parseCredentialQr } from "@sts/shared"
import { QrScanner } from "@/components/shared/QrScanner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const verifyResponseSchema = z.object({
  tokenId: z.string(),
  digitalId: z.string().nullable().optional(),
  onChain: z.object({
    valid: z.boolean(),
    status: z.number(),
    validUntil: z.number(),
    commitment: z.string(),
    explorerUrl: z.string().nullable(),
    source: z.enum(["chain", "offline", "mirror"]),
    error: z.string().optional(),
  }),
  mirror: z.record(z.string(), z.unknown()).nullable(),
})

function extractRaw(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const parsed = parseCredentialQr(trimmed)
  if (!parsed) return trimmed
  return trimmed
}

export function VerifyClient() {
  const [manual, setManual] = useState("")
  const [result, setResult] = useState<z.infer<typeof verifyResponseSchema> | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function verify(raw: string) {
    const parsedQr = parseCredentialQr(raw)
    if (!parsedQr) {
      setError("Could not read that credential")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/identity/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tokenId: parsedQr.tokenId ?? undefined,
          digitalId: parsedQr.digitalId ?? undefined,
          touristId: parsedQr.touristId ?? undefined,
          qr: raw,
        }),
      })
      const json: unknown = await res.json()
      const parsed = verifyResponseSchema.safeParse(json)
      if (!parsed.success) {
        setError("Unexpected verify payload")
        setResult(null)
        return
      }
      setResult(parsed.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verify failed")
    } finally {
      setBusy(false)
    }
  }

  const tourist = result?.mirror?.tourist
  const touristRec =
    tourist && typeof tourist === "object" ? (tourist as Record<string, unknown>) : null
  const itinerary = result?.mirror?.itinerary
  const itinRec =
    itinerary && typeof itinerary === "object" ? (itinerary as Record<string, unknown>) : null
  const kycStatus = typeof touristRec?.kyc_status === "string" ? touristRec.kyc_status : null

  return (
    <main className="sts-enter mx-auto grid max-w-4xl gap-4 p-6 md:grid-cols-2">
      <div className="space-y-3">
        <h1 className="text-xl font-semibold tracking-tight">Checkpoint verify</h1>
        <p className="text-sm text-muted-foreground">
          Scan a tourist QR. Guest IDs and pending chain writes still resolve from the command-centre mirror.
        </p>
        <QrScanner
          onDecode={(text) => {
            const raw = extractRaw(text)
            if (raw) void verify(raw)
          }}
        />
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const raw = extractRaw(manual) ?? manual.trim()
            if (raw) void verify(raw)
          }}
        >
          <Input
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            placeholder="Or paste token id / QR JSON / digital id"
          />
          <Button type="submit" disabled={busy}>
            Verify
          </Button>
        </form>
      </div>
      <Card className="border-border/80 bg-card/80">
        <CardHeader>
          <CardTitle>On-chain card</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <p className="text-sm text-broken">{error}</p> : null}
          {!result ? (
            <p className="text-sm text-muted-foreground">Awaiting scan.</p>
          ) : (
            <>
              <Badge
                variant="outline"
                data-testid="verify-badge"
                className={cn(
                  result.onChain.valid && kycStatus === "verified"
                    ? "border-verified/40 bg-verified/15 text-verified"
                    : result.onChain.valid
                      ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
                      : "border-broken/40 bg-broken/15 text-broken",
                )}
              >
                {result.onChain.valid
                  ? kycStatus === "skipped"
                    ? "Guest ID · valid at checkpoint"
                    : result.onChain.source === "chain"
                      ? "Valid on Polygon Amoy"
                      : "Valid (command mirror)"
                  : result.onChain.source === "offline"
                    ? "Chain offline"
                    : "Not valid"}
              </Badge>
              <p className="text-lg font-medium">
                {typeof touristRec?.full_name === "string"
                  ? touristRec.full_name
                  : `Token ${result.tokenId}`}
              </p>
              {typeof itinRec?.title === "string" ? (
                <p className="text-sm text-muted-foreground">{itinRec.title}</p>
              ) : null}
              <dl className="space-y-1 font-mono text-[11px] text-muted-foreground">
                <div>token {result.tokenId || "—"}</div>
                <div>digital {result.digitalId ?? "—"}</div>
                <div>status {result.onChain.status}</div>
                <div>kyc {kycStatus ?? "—"}</div>
                <div>
                  until{" "}
                  {result.onChain.validUntil
                    ? new Date(result.onChain.validUntil * 1000).toLocaleString("en-IN")
                    : "—"}
                </div>
                <div className="truncate">commitment {result.onChain.commitment}</div>
              </dl>
              {result.onChain.explorerUrl ? (
                <a
                  className="text-sm underline"
                  href={result.onChain.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open explorer
                </a>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
