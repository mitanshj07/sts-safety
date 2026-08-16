// apps/web/src/app/(tourist)/onboard/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  issueIdentityRequestSchema,
  type IssueIdentityRequest,
  type KycType,
} from "@sts/shared";
import { useTouristRuntime } from "@/components/tourist/TouristProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { publicEnv } from "@/lib/config/public";
import type { CachedDigitalId, CachedItinerary, CachedTourist } from "@/lib/offline/db";
import { PRESET_NE_ROUTES, itineraryLineString, routeById } from "@/lib/tourist/routes";

const STEPS = ["Document", "You", "Emergency", "Trip"] as const;

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
  txHash: string | null;
  explorerUrl: string | null;
  vcPath: string | null;
  chainId: number;
  contract: string;
  status: "pending" | "active";
  steps: IssueStep[];
};

const EMPTY: FormState = {
  kycType: "passport",
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

function toRequest(form: FormState): IssueIdentityRequest | null {
  const route = routeById(form.itineraryId);
  const parsed = issueIdentityRequestSchema.safeParse({
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
    corridorM: route?.corridor_m,
  });
  return parsed.success ? parsed.data : null;
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

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    setError(null);
    const payload = toRequest(form);
    if (!payload) {
      setError("Check the form — a field is still invalid.");
      return;
    }
    setIssuing(true);
    const route = routeById(form.itineraryId);
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
      const vcPath = typeof rec.vcPath === "string" ? rec.vcPath : null;
      const chainId = Number(rec.chainId ?? publicEnv.chainId);
      const contract = typeof rec.contract === "string" ? rec.contract : publicEnv.touristIdRegistry;

      const view: IssueView = {
        touristId,
        tokenId,
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
            detail: touristId,
          },
          {
            id: "chain",
            label: "TouristIdentityRegistry.issue()",
            status: txHash ? "done" : "pending",
            detail: txHash ?? "Queued on the relayer — ID is valid offline",
          },
        ],
      };
      setResult(view);

      const last4 = form.kycNumber.replace(/[\s-]/g, "").slice(-4);
      const tourist: CachedTourist = {
        id: touristId,
        profile_id: null,
        full_name: form.name,
        nationality: form.nationality,
        kyc_type: form.kycType,
        kyc_last4: last4,
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
        tourist_id: touristId,
        chain_id: chainId,
        contract_address: contract,
        token_id: tokenId,
        vc_path: vcPath,
        status,
        issue_tx_hash: txHash,
        valid_from: form.tripStart,
        valid_until: form.tripEnd,
        kyc_last4: last4,
        full_name: form.name,
        nationality: form.nationality,
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
            Chain write is queued. Your local ID card is ready offline.
          </p>
        )}
        <Button type="button" onClick={() => router.push("/home")}>
          Continue to home
        </Button>
      </main>
    );
  }

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
          <CardContent className="space-y-3">
            <Label htmlFor="kyc_type">Document type</Label>
            <select
              id="kyc_type"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.kycType}
              onChange={(e) => update("kycType", e.target.value as KycType)}
            >
              <option value="passport">Passport</option>
              <option value="aadhaar">Aadhaar</option>
              <option value="voter_id">Voter ID</option>
              <option value="driving_licence">Driving licence</option>
            </select>
            <Label htmlFor="kyc_number">Document number</Label>
            <Input
              id="kyc_number"
              value={form.kycNumber}
              autoComplete="off"
              onChange={(e) => update("kycNumber", e.target.value)}
            />
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
            <Label htmlFor="nationality">Nationality (ISO 2)</Label>
            <Input
              id="nationality"
              maxLength={2}
              value={form.nationality}
              onChange={(e) => update("nationality", e.target.value.toUpperCase())}
            />
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

      <div className="flex gap-2">
        {step > 0 ? (
          <Button type="button" variant="secondary" onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <Button type="button" className="flex-1" onClick={() => setStep((s) => s + 1)}>
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
      </div>
    </main>
  );
}
