// apps/web/src/app/(command)/verify/verify-client.tsx
"use client"

import { useState } from "react"
import { z } from "zod"
import { QrScanner } from "@/components/shared/QrScanner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  const [reveal, setReveal] = useState(false)

  async function verify(tokenId: string) {
    setBusy(true)
    setError(null)
    setReveal(false)
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
  const verified = Boolean(result?.onChain.valid)
  const identityKicker = !result
    ? "Awaiting scan"
    : verified
      ? "Verified"
      : result.onChain.source === "offline"
        ? "Verification required"
        : "Not valid"

  return (
    <main className="sts-enter mx-auto grid max-w-4xl gap-8 p-4 sm:p-6 md:grid-cols-2">
      <div className="space-y-4">
        <div>
          <p className="sts-kicker">Checkpoint</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Checkpoint verify</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Scan a tourist QR. Only a commitment is on-chain — no Aadhaar or passport numbers.
          </p>
        </div>
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
            className="h-11"
          />
          <Button type="submit" disabled={busy} className="min-h-11">
            Verify
          </Button>
        </form>
      </div>
      <section className="border border-border bg-surface p-5">
        <p className="sts-kicker">Identity state</p>
        <p
          className={cn(
            "mt-3 text-3xl font-semibold tracking-tight",
            verified && "text-success",
            result && !verified && "text-danger",
          )}
        >
          {identityKicker}
        </p>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        {!result ? (
          <p className="mt-3 text-sm text-muted-foreground">Scan or paste a token to begin.</p>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-lg font-medium">
              {typeof touristRec?.full_name === "string"
                ? touristRec.full_name
                : `Token ${result.tokenId}`}
            </p>
            <p className="text-sm text-muted-foreground">
              {result.onChain.source === "offline"
                ? "Chain unreachable. Showing the last known registry status."
                : verified
                  ? "Credential matches the on-chain commitment."
                  : "This token is not valid for travel."}
            </p>
            <button
              type="button"
              className="text-sm font-medium underline-offset-4 hover:underline"
              onClick={() => setReveal((v) => !v)}
            >
              {reveal ? "Hide technical detail" : "Show technical detail"}
            </button>
            {reveal ? (
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
            ) : null}
            {result.onChain.explorerUrl ? (
              <a
                className="block text-sm underline underline-offset-4"
                href={result.onChain.explorerUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open explorer
              </a>
            ) : null}
          </div>
        )}
      </section>
    </main>
  )
}
