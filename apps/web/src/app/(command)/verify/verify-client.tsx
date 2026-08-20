// apps/web/src/app/(command)/verify/verify-client.tsx
"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { z } from "zod"
import { QrScanner } from "@/components/shared/QrScanner"
import { TouristCard } from "@/components/command/TouristCard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { idStatusSchema } from "@sts/shared"
import { formatIstDate } from "@/lib/ui/format"
import { cn } from "@/lib/utils"

const contactSchema = z.object({
  name: z.string(),
  relation: z.string(),
  phone_e164: z.string(),
})

const touristSchema = z.object({
  id: z.string(),
  full_name: z.string(),
  nationality: z.string(),
  photoUrl: z.string().nullable(),
  phone_e164: z.string().nullable(),
  safety_score: z.number(),
  kyc_type: z.string().nullable(),
  kyc_last4: z.string().nullable(),
  trip_start: z.string().nullable(),
  trip_end: z.string().nullable(),
  emergency_contacts: z.array(contactSchema),
})

const digitalIdSchema = z.object({
  token_id: z.string().nullable(),
  status: idStatusSchema.nullable(),
  valid_from: z.string().nullable(),
  valid_until: z.string().nullable(),
  issue_tx_hash: z.string().nullable(),
})

const verifyResponseSchema = z.object({
  tokenId: z.string().nullable(),
  onChain: z.object({
    valid: z.boolean(),
    status: z.number(),
    validUntil: z.number(),
    commitment: z.string(),
    explorerUrl: z.string().nullable(),
    source: z.enum(["chain", "offline"]),
    error: z.string().optional(),
  }),
  tourist: touristSchema.nullable(),
  digitalId: digitalIdSchema.nullable(),
  mirror: z.record(z.string(), z.unknown()).nullable().optional(),
})

type VerifyResult = z.infer<typeof verifyResponseSchema>

type ScanIdentity = {
  tokenId?: string
  touristId?: string
  vcPath?: string
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function asToken(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value))
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return null
  return /^\d+$/.test(trimmed) ? trimmed : null
}

function asUuid(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return UUID_RE.test(trimmed) ? trimmed : null
}

function asPath(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed && trimmed !== "null" ? trimmed : null
}

function extractScan(raw: string): ScanIdentity | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const asUrl = (() => {
    try {
      return new URL(trimmed)
    } catch {
      return null
    }
  })()
  if (asUrl) {
    const tokenId =
      asToken(
        asUrl.searchParams.get("token") ??
          asUrl.searchParams.get("tokenId") ??
          asUrl.searchParams.get("t"),
      ) ?? undefined
    const touristId =
      asUuid(
        asUrl.searchParams.get("tourist") ??
          asUrl.searchParams.get("touristId") ??
          asUrl.searchParams.get("i"),
      ) ?? undefined
    const vcPath =
      asPath(asUrl.searchParams.get("vcPath") ?? asUrl.searchParams.get("vc")) ?? undefined
    return tokenId || touristId || vcPath ? { tokenId, touristId, vcPath } : null
  }

  const tokenOnly = asToken(trimmed)
  if (tokenOnly) return { tokenId: tokenOnly }
  const uuidOnly = asUuid(trimmed)
  if (uuidOnly) return { touristId: uuidOnly }

  try {
    const json: unknown = JSON.parse(trimmed)
    if (!json || typeof json !== "object") return null
    const rec = json as Record<string, unknown>
    const tokenId = asToken(rec.tokenId ?? rec.token_id ?? rec.t) ?? undefined
    const touristId = asUuid(rec.touristId ?? rec.tourist_id ?? rec.i) ?? undefined
    const vcPath = asPath(rec.vcPath ?? rec.vc_path) ?? undefined
    return tokenId || touristId || vcPath ? { tokenId, touristId, vcPath } : null
  } catch {
    return null
  }
}

function scanKey(scan: ScanIdentity): string {
  return [scan.tokenId ?? "", scan.touristId ?? "", scan.vcPath ?? ""].join("|")
}

export function VerifyClient() {
  const [manual, setManual] = useState("")
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [reveal, setReveal] = useState(false)
  const inFlight = useRef(false)
  const lastKey = useRef<string | null>(null)

  function reset() {
    inFlight.current = false
    lastKey.current = null
    setResult(null)
    setError(null)
    setReveal(false)
    setBusy(false)
    setManual("")
  }

  async function verify(scan: ScanIdentity) {
    const key = scanKey(scan)
    if (!key.replaceAll("|", "") || inFlight.current || lastKey.current === key) return
    inFlight.current = true
    lastKey.current = key
    setBusy(true)
    setError(null)
    setReveal(false)
    try {
      const res = await fetch("/api/identity/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(scan),
      })
      const json: unknown = await res.json()
      const parsed = verifyResponseSchema.safeParse(json)
      if (!parsed.success) {
        lastKey.current = null
        const message =
          json && typeof json === "object" && "error" in json && typeof json.error === "string"
            ? json.error
            : "Unexpected verify payload"
        setError(message)
        setResult(null)
        return
      }
      setResult(parsed.data)
    } catch (err) {
      lastKey.current = null
      setError(err instanceof Error ? err.message : "Verify failed")
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  const tourist = result?.tourist ?? null
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
        {result ? (
          <div className="space-y-3 border border-border bg-surface p-5">
            <p className="text-sm text-muted-foreground">
              Credential captured. Scan another tourist to return to the live camera.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={reset}>
                Scan another
              </Button>
              <Button type="button" variant="ghost" asChild>
                <Link href="/dashboard">Back to dashboard</Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <QrScanner
              onDecode={(text) => {
                const scan = extractScan(text)
                if (scan) void verify(scan)
              }}
            />
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                const scan = extractScan(manual)
                if (scan) {
                  void verify(scan)
                  return
                }
                setError("Paste a token id, tourist id, or QR JSON")
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
          </>
        )}
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
          <div className="mt-4 space-y-4">
            {tourist ? (
              <TouristCard
                tourist={{
                  full_name: tourist.full_name,
                  nationality: tourist.nationality,
                  photo_path: null,
                  phone_e164: tourist.phone_e164,
                  safety_score: tourist.safety_score,
                }}
                contacts={tourist.emergency_contacts.map((contact) => ({
                  ...contact,
                  notify: true,
                }))}
                digitalId={{
                  token_id: result.digitalId?.token_id ?? result.tokenId,
                  status: result.digitalId?.status ?? null,
                  chain_id: null,
                  contract_address: null,
                  kyc_commitment: null,
                  valid_from: result.digitalId?.valid_from ?? null,
                  valid_until: result.digitalId?.valid_until ?? null,
                  issue_tx_hash: result.digitalId?.issue_tx_hash ?? null,
                  issue_block: null,
                  holder_address: null,
                }}
                photoUrl={tourist.photoUrl}
              />
            ) : (
              <p className="text-lg font-medium">Token {result.tokenId ?? "pending"}</p>
            )}
            <p className="text-sm text-muted-foreground">
              {result.onChain.source === "offline"
                ? "Chain unreachable or token still queued. Showing the registry mirror."
                : verified
                  ? "Credential matches the on-chain commitment."
                  : "This token is not valid for travel."}
            </p>
            {tourist ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                {tourist.kyc_last4 ? (
                  <>
                    <dt className="text-muted-foreground">KYC</dt>
                    <dd className="font-mono">•••• {tourist.kyc_last4}</dd>
                  </>
                ) : null}
                {tourist.trip_start && tourist.trip_end ? (
                  <>
                    <dt className="text-muted-foreground">Valid</dt>
                    <dd>
                      {formatIstDate(tourist.trip_start)} – {formatIstDate(tourist.trip_end)}
                    </dd>
                  </>
                ) : null}
              </dl>
            ) : null}
            <div className="flex flex-wrap gap-3 text-sm">
              {tourist ? (
                <Link href={`/tourists/${tourist.id}`} className="underline underline-offset-4">
                  Open tourist record
                </Link>
              ) : null}
              {result.onChain.explorerUrl ? (
                <a
                  className="underline underline-offset-4"
                  href={result.onChain.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open explorer
                </a>
              ) : null}
            </div>
            <button
              type="button"
              className="text-sm font-medium underline-offset-4 hover:underline"
              onClick={() => setReveal((v) => !v)}
            >
              {reveal ? "Hide technical detail" : "Show technical detail"}
            </button>
            {reveal ? (
              <dl className="space-y-1 font-mono text-[11px] text-muted-foreground">
                <div>token {result.tokenId ?? "—"}</div>
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
          </div>
        )}
      </section>
    </main>
  )
}
