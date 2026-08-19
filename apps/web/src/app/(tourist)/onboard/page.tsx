// apps/web/src/app/(tourist)/onboard/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  allowedKycTypes,
  defaultKycType,
  isIndianNationality,
  issueIdentityRequestSchema,
  kycIssuanceIssues,
  KYC_NUMBER_HINTS,
  KYC_NUMBER_PLACEHOLDERS,
  KYC_TYPE_LABELS,
  type IssueIdentityRequest,
  type KycType,
} from "@sts/shared";
import { skipToApp } from "@/lib/auth/actions";
import { useTouristRuntime } from "@/components/tourist/TouristProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { publicEnv } from "@/lib/config/public";
import type { CachedDigitalId, CachedItinerary, CachedTourist } from "@/lib/offline/db";
import { PRESET_NE_ROUTES, itineraryLineString, routeById } from "@/lib/tourist/routes";
import { cn } from "@/lib/utils";

const STEPS = ["Document", "You", "Emergency", "Trip"] as const;
const INDIAN_KEEP = new Set<KycType>(["aadhaar", "voter_id", "driving_licence"]);

type Residency = "indian" | "international";

type FormState = {
  kycType: KycType;
  kycNumber: string;
  name: string;
  nationality: string;
  dateOfBirth: string;
  phone: string;
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;
  tripStart: string;
  tripEnd: string;
  itineraryId: string;
};

type IssueStep = {
  id: string;
  label: string;
  status: "done" | "running" | "pending" | "failed";
  detail?: string;
};

type IssueView = {
  touristId: string;
  tokenId: string | null;
  digitalId: string | null;
  txHash: string | null;
  explorerUrl: string | null;
  vcPath: string | null;
  chainId: number;
  contract: string;
  status: "pending" | "active";
  steps: IssueStep[];
};

const EMPTY: FormState = {
  kycType: "aadhaar",
  kycNumber: "",
  name: "",
  nationality: "IN",
  dateOfBirth: "1998-01-01",
  phone: "+919800000001",
  emergencyName: "",
  emergencyRelation: "parent",
  emergencyPhone: "+919800000002",
  tripStart: new Date().toISOString(),
  tripEnd: new Date(Date.now() + 7 * 86400000).toISOString(),
  itineraryId: PRESET_NE_ROUTES[0]?.id ?? "ghy-shillong",
};

function residencyOf(nationality: string): Residency {
  return isIndianNationality(nationality) ? "indian" : "international";
}

function issuePayload(form: FormState): Record<string, unknown> {
  const route = routeById(form.itineraryId);
  return {
    kycType: form.kycType,
    kycNumber: form.kycNumber,
    name: form.name,
    nationality: form.nationality,
    dateOfBirth: form.dateOfBirth,
    phone: form.phone,
    emergencyContacts: [
      {
        name: form.emergencyName,
        relation: form.emergencyRelation,
        phone_e164: form.emergencyPhone,
        notify: true,
      },
    ],
    tripStart: form.tripStart,
    tripEnd: form.tripEnd,
    entryPoint: route?.entry_point,
    itineraryGeoJSON: route
      ? { type: "LineString", coordinates: route.coordinates }
      : undefined,
    itineraryTitle: route?.title,
    itineraryPresetId: form.itineraryId,
    itineraryWaypoints: route?.waypoints,
    corridorM: route?.corridor_m,
  };
}

function toRequest(form: FormState): IssueIdentityRequest | null {
  const parsed = issueIdentityRequestSchema.safeParse(issuePayload(form));
  return parsed.success ? parsed.data : null;
}

function firstSchemaError(form: FormState): string | null {
  const parsed = issueIdentityRequestSchema.safeParse(issuePayload(form));
  if (parsed.success) return null;
  return parsed.error.issues[0]?.message ?? "Check the form — a field is still invalid.";
}

function documentStepError(form: FormState): string | null {
  const issues = kycIssuanceIssues({
    nationality: form.nationality,
    kycType: form.kycType,
    kycNumber: form.kycNumber,
  });
  return issues[0]?.message ?? null;
}

export default function OnboardPage() {
  const router = useRouter();
  const { patchSession } = useTouristRuntime();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [result, setResult] = useState<IssueView | null>(null);

  const parsed = useMemo(() => toRequest(form), [form]);
  const residency = residencyOf(form.nationality);
  const docTypes = allowedKycTypes(form.nationality);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setResidency(next: Residency) {
    setError(null);
    setForm((prev) => {
      if (next === "indian") {
        const kycType = (INDIAN_KEEP.has(prev.kycType) ? prev.kycType : "aadhaar") as KycType;
        return { ...prev, nationality: "IN", kycType };
      }
      return {
        ...prev,
        nationality: prev.nationality === "IN" ? "" : prev.nationality,
        kycType: "passport",
      };
    });
  }

  function goNext() {
    setError(null);
    if (step === 0) {
      const docError = documentStepError(form);
      if (docError) {
        setError(docError);
        return;
      }
    }
    if (step === 1 && form.name.trim().length < 1) {
      setError("Enter the traveller's full name.");
      return;
    }
    if (step === 2 && form.emergencyName.trim().length < 1) {
      setError("Enter an emergency contact.");
      return;
    }
    setStep((s) => s + 1);
  }

  async function cacheCredential(opts: {
    touristId: string;
    tokenId: string | null;
    digitalId: string | null;
    vcPath: string | null;
    txHash: string | null;
    chainId: number;
    contract: string;
    status: "pending" | "active";
    kycLast4: string;
    kycType: KycType;
    kycStatus: "skipped" | "verified";
    name: string;
  }) {
    const route = routeById(form.itineraryId);
    const tourist: CachedTourist = {
      id: opts.touristId,
      profile_id: null,
      full_name: opts.name,
      nationality: form.nationality || "IN",
      kyc_type: opts.kycType,
      kyc_last4: opts.kycLast4,
      kyc_status: opts.kycStatus,
      photo_data_url: photo,
      safety_score: 100,
      trip_start: form.tripStart,
      trip_end: form.tripEnd,
      phone_e164: form.phone,
      email: null,
      emergency_contacts: [
        {
          name: form.emergencyName,
          relation: form.emergencyRelation,
          phone_e164: form.emergencyPhone,
          notify: true,
        },
      ],
      current_zone_ids: [],
      tracking_enabled: true,
    };
    const digitalId: CachedDigitalId = {
      id: opts.digitalId ?? opts.touristId,
      tourist_id: opts.touristId,
      chain_id: opts.chainId,
      contract_address: opts.contract,
      token_id: opts.tokenId,
      vc_path: opts.vcPath,
      status: opts.status,
      issue_tx_hash: opts.txHash,
      valid_from: form.tripStart,
      valid_until: form.tripEnd,
      kyc_last4: opts.kycLast4,
      kyc_type: opts.kycType,
      kyc_status: opts.kycStatus,
      full_name: opts.name,
      nationality: form.nationality || "IN",
      photo_data_url: photo,
    };
    const itinerary: CachedItinerary | null = route
      ? {
          id: route.id,
          title: route.title,
          corridor_m: route.corridor_m,
          waypoints: route.waypoints.map((w) => ({ ...w })),
          starts_at: form.tripStart,
          ends_at: form.tripEnd,
          geometry: itineraryLineString(route).geometry,
        }
      : null;
    await patchSession({ tourist, digitalId, itinerary });
  }

  async function skipOnboarding() {
    setError(null);
    setIssuing(true);
    try {
      const resultSkip = await skipToApp(form.itineraryId);
      if (!resultSkip.ok) {
        setError(resultSkip.message);
        return;
      }
      router.push(resultSkip.redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not skip onboarding");
    } finally {
      setIssuing(false);
    }
  }

  async function submit() {
    setError(null);
    const payload = toRequest(form);
    if (!payload) {
      setError(firstSchemaError(form) ?? "Check the form — a field is still invalid.");
      return;
    }
    setIssuing(true);
    try {
      const res = await fetch("/api/identity/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json: unknown = await res.json();
      const rec = json as Record<string, unknown>;
      if (!res.ok) {
        const message =
          typeof rec.error === "string"
            ? rec.error
            : typeof rec.message === "string"
              ? rec.message
              : `Issuance failed (${res.status})`;
        setError(message);
        return;
      }
      const touristId =
        typeof rec.touristId === "string" ? rec.touristId : crypto.randomUUID();
      const status = rec.status === "active" ? "active" : "pending";
      const txHash = typeof rec.txHash === "string" ? rec.txHash : null;
      const explorerUrl = typeof rec.explorerUrl === "string" ? rec.explorerUrl : null;
      const tokenId = rec.tokenId == null ? null : String(rec.tokenId);
      const digitalId = typeof rec.digitalId === "string" ? rec.digitalId : null;
      const vcPath = typeof rec.vcPath === "string" ? rec.vcPath : null;
      const chainId = Number(rec.chainId ?? publicEnv.chainId);
      const contract = typeof rec.contract === "string" ? rec.contract : publicEnv.touristIdRegistry;
      const itineraryId = typeof rec.itineraryId === "string" ? rec.itineraryId : null;

      const view: IssueView = {
        touristId,
        tokenId,
        digitalId,
        txHash,
        explorerUrl,
        vcPath,
        chainId,
        contract,
        status,
        steps: [
          { id: "validate", label: "Validate KYC payload", status: "done" },
          { id: "encrypt", label: "Encrypt KYC (pgcrypto, never on-chain)", status: "done" },
          {
            id: "insert",
            label: "Write tourist + itinerary",
            status: "done",
            detail: itineraryId ?? touristId,
          },
          {
            id: "chain",
            label: "TouristIdentityRegistry.issue()",
            status: txHash ? "done" : "pending",
            detail: txHash ?? "Queued on the relayer — ID is valid at checkpoints via the DB mirror",
          },
        ],
      };
      setResult(view);

      const last4 = form.kycNumber.replace(/[\s-]/g, "").slice(-4);
      await cacheCredential({
        touristId,
        tokenId,
        digitalId,
        vcPath,
        txHash,
        chainId,
        contract,
        status,
        kycLast4: last4,
        kycType: form.kycType,
        kycStatus: "verified",
        name: form.name,
      });
      if (itineraryId) {
        const route = routeById(form.itineraryId);
        if (route) {
          await patchSession({
            itinerary: {
              id: itineraryId,
              title: route.title,
              corridor_m: route.corridor_m,
              waypoints: route.waypoints.map((w) => ({ ...w })),
              starts_at: form.tripStart,
              ends_at: form.tripEnd,
              geometry: itineraryLineString(route).geometry,
            },
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Issuance failed");
    } finally {
      setIssuing(false);
    }
  }

  if (result) {
    return (
      <main className="sts-enter mx-auto flex max-w-lg flex-col gap-5 px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Issuing digital ID</h1>
        <ol className="space-y-3">
          {result.steps.map((s) => (
            <li key={s.id} className="rounded-2xl border border-border/80 bg-card/80 px-4 py-3">
              <p className="text-xs tracking-widest text-muted-foreground uppercase">
                {s.status}
              </p>
              <p className="font-medium">{s.label}</p>
              {s.detail ? (
                <p className="mt-1 font-mono text-xs break-all text-primary">{s.detail}</p>
              ) : null}
            </li>
          ))}
        </ol>
        {result.tokenId ? (
          <p className="font-mono text-sm" data-testid="issued-token">
            Token {result.tokenId}
          </p>
        ) : result.digitalId ? (
          <p className="font-mono text-sm" data-testid="issued-token">
            ID {result.digitalId}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Token pending — local credential is still valid for checkpoint staff via the DB mirror.
          </p>
        )}
        {result.explorerUrl ? (
          <a
            className="text-sm text-primary underline"
            href={result.explorerUrl}
            target="_blank"
            rel="noreferrer"
          >
            Watch the transaction on Polygonscan
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">
            Chain write is queued. Your ID card is scannable at the command centre now.
          </p>
        )}
        <Button type="button" onClick={() => router.push("/id")}>
          Show ID card
        </Button>
      </main>
    );
  }

  const kycLabel = KYC_TYPE_LABELS[form.kycType];

  return (
    <main className="sts-enter mx-auto flex max-w-lg flex-col gap-5 px-4 py-6">
      <div>
        <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
          KYC
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Onboarding</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </p>
      </div>
      <div className="flex gap-1.5" aria-hidden="true">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1">
            <div
              className={`h-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`}
            />
            <p className="mt-1.5 hidden text-[10px] tracking-wide text-muted-foreground sm:block">
              {label}
            </p>
          </div>
        ))}
      </div>

      {step === 0 ? (
        <Card className="border-border/80 bg-card/80">
          <CardHeader>
            <CardTitle>Travel document</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Who is travelling?</legend>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-testid="residency-indian"
                  aria-pressed={residency === "indian"}
                  onClick={() => setResidency("indian")}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-left transition-colors",
                    residency === "indian"
                      ? "border-primary bg-primary/10"
                      : "border-border/80 bg-background hover:border-primary/40",
                  )}
                >
                  <p className="text-sm font-semibold">Indian resident</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Aadhaar first. Voter ID or driving licence also accepted.
                  </p>
                </button>
                <button
                  type="button"
                  data-testid="residency-international"
                  aria-pressed={residency === "international"}
                  onClick={() => setResidency("international")}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-left transition-colors",
                    residency === "international"
                      ? "border-primary bg-primary/10"
                      : "border-border/80 bg-background hover:border-primary/40",
                  )}
                >
                  <p className="text-sm font-semibold">International visitor</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Passport verification — ICAO travel document number.
                  </p>
                </button>
              </div>
            </fieldset>

            {residency === "international" ? (
              <div className="space-y-2">
                <Label htmlFor="nationality">Nationality (ISO 2)</Label>
                <Input
                  id="nationality"
                  maxLength={2}
                  placeholder="GB"
                  value={form.nationality}
                  onChange={(e) => {
                    const next = e.target.value.toUpperCase();
                    if (next === "IN") {
                      setResidency("indian");
                      return;
                    }
                    update("nationality", next);
                  }}
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Nationality locked to India (IN) for Aadhaar / equivalent Indian KYC.
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="kyc_type">Document type</Label>
              <select
                id="kyc_type"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.kycType}
                onChange={(e) => update("kycType", e.target.value as KycType)}
              >
                {docTypes.map((type) => (
                  <option key={type} value={type}>
                    {KYC_TYPE_LABELS[type]}
                    {type === defaultKycType(form.nationality) ? " — recommended" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kyc_number">{kycLabel} number</Label>
              <Input
                id="kyc_number"
                value={form.kycNumber}
                autoComplete="off"
                inputMode={form.kycType === "aadhaar" ? "numeric" : "text"}
                placeholder={KYC_NUMBER_PLACEHOLDERS[form.kycType]}
                onChange={(e) => update("kycNumber", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{KYC_NUMBER_HINTS[form.kycType]}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card className="border-border/80 bg-card/80">
          <CardHeader>
            <CardTitle>Traveller</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" value={form.name} onChange={(e) => update("name", e.target.value)} />
            <Label htmlFor="dob">Date of birth</Label>
            <Input
              id="dob"
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => update("dateOfBirth", e.target.value)}
            />
            <Label htmlFor="phone">Phone (E.164)</Label>
            <Input id="phone" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            <Label htmlFor="photo">Photo (stays on device)</Label>
            <Input
              id="photo"
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  if (typeof reader.result === "string") setPhoto(reader.result);
                };
                reader.readAsDataURL(file);
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card className="border-border/80 bg-card/80">
          <CardHeader>
            <CardTitle>Emergency contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="ec_name">Name</Label>
            <Input
              id="ec_name"
              value={form.emergencyName}
              onChange={(e) => update("emergencyName", e.target.value)}
            />
            <Label htmlFor="ec_rel">Relation</Label>
            <Input
              id="ec_rel"
              value={form.emergencyRelation}
              onChange={(e) => update("emergencyRelation", e.target.value)}
            />
            <Label htmlFor="ec_phone">Phone (E.164)</Label>
            <Input
              id="ec_phone"
              value={form.emergencyPhone}
              onChange={(e) => update("emergencyPhone", e.target.value)}
            />
          </CardContent>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card className="border-border/80 bg-card/80">
          <CardHeader>
            <CardTitle>Trip & route</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="start">Start</Label>
            <Input
              id="start"
              type="datetime-local"
              value={form.tripStart.slice(0, 16)}
              onChange={(e) => update("tripStart", new Date(e.target.value).toISOString())}
            />
            <Label htmlFor="end">End</Label>
            <Input
              id="end"
              type="datetime-local"
              value={form.tripEnd.slice(0, 16)}
              onChange={(e) => update("tripEnd", new Date(e.target.value).toISOString())}
            />
            <Label htmlFor="route">Preset North-East itinerary</Label>
            <select
              id="route"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.itineraryId}
              onChange={(e) => update("itineraryId", e.target.value)}
            >
              {PRESET_NE_ROUTES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {step > 0 ? (
          <Button type="button" variant="secondary" onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <Button type="button" className="flex-1" onClick={goNext}>
            Next
          </Button>
        ) : (
          <Button
            type="button"
            className="flex-1"
            disabled={issuing || !parsed}
            onClick={() => void submit()}
          >
            {issuing ? "Issuing…" : "Issue digital ID"}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          disabled={issuing}
          data-testid="skip-kyc"
          onClick={() => void skipOnboarding()}
        >
          Skip KYC
        </Button>
      </div>
    </main>
  );
}
