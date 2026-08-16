// apps/web/src/app/(command)/verify/verify-client.tsx
"use client"

import { useState } from "react"
import { z } from "zod"
import { QrScanner } from "@/components/shared/QrScanner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { qrPayloadSchema } from "@/lib/command/schemas"
import { cn } from "@/lib/utils"

const verifyResponseSchema = z.object({
  tokenId: z.string(),
  onChain: z.object({
    valid: z.boolean(),
    status: z.number(),
    validUntil: z.number(),
    commitment: z.string(),
    explorerUrl: z.string().nullable(),
    source: z.enum(["chain", "offline"]),
    error: z.string().optional(),
  }),
  mirror: z.record(z.string(), z.unknown()).nullable(),
})

function extractToken(raw: string): string | null {
  const trimmed = raw.trim()
  const asUrl = (() => {
    try {
      return new URL(trimmed)
    } catch {
      return null
    }
  })()
  if (asUrl) {
    return asUrl.searchParams.get("token") ?? asUrl.searchParams.get("tokenId")
  }
  if (/^\d+$/.test(trimmed)) return trimmed
  try {
    const parsed = qrPayloadSchema.safeParse(JSON.parse(trimmed))
    if (!parsed.success) return null
    if ("tokenId" in parsed.data) return String(parsed.data.tokenId)
    if ("token_id" in parsed.data) return String(parsed.data.token_id)
    if ("t" in parsed.data) return String(parsed.data.t)
    return null
  } catch {
    return null
  }
}

export function VerifyClient() {
  const [manual, setManual] = useState("")
  const [result, setResult] = useState<z.infer<typeof verifyResponseSchema> | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function verify(tokenId: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/identity/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tokenId }),
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

  return (
    <main className="sts-enter mx-auto grid max-w-4xl gap-4 p-6 md:grid-cols-2">
      <div className="space-y-3">
        <h1 className="text-xl font-semibold tracking-tight">Checkpoint verify</h1>
        <p className="text-sm text-muted-foreground">
          20-second demo beat: scan a tourist QR, show on-chain status. No PII on chain.
        </p>
        <QrScanner
          onDecode={(text) => {
            const token = extractToken(text)
            if (token) void verify(token)
          }}
        />
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const token = extractToken(manual) ?? manual.trim()
            if (token) void verify(token)
          }}
        >
          <Input
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            placeholder="Or paste token id / QR JSON"
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
                className={cn(
                  result.onChain.valid
                    ? "border-verified/40 bg-verified/15 text-verified"
                    : "border-broken/40 bg-broken/15 text-broken",
                )}
              >
                {result.onChain.valid
                  ? "Valid on Polygon Amoy"
                  : result.onChain.source === "offline"
                    ? "Chain offline"
                    : "Not valid"}
              </Badge>
              <p className="text-lg font-medium">
                {typeof touristRec?.full_name === "string"
                  ? touristRec.full_name
                  : `Token ${result.tokenId}`}
              </p>
              <dl className="space-y-1 font-mono text-[11px] text-muted-foreground">
                <div>token {result.tokenId}</div>
                <div>status {result.onChain.status}</div>
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
