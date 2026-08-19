// apps/web/src/app/(tourist)/id/page.tsx
"use client";

import Link from "next/link";
import { IdCard } from "lucide-react";
import { DigitalIdCard } from "@/components/tourist/DigitalIdCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { useTouristRuntime } from "@/components/tourist/TouristProvider";
import { publicEnv } from "@/lib/config/public";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default function DigitalIdPage() {
  const { tourist, digitalId } = useTouristRuntime();

  if (!digitalId && !tourist) {
    return (
      <main className="sts-enter mx-auto flex max-w-lg flex-col gap-4 px-4 py-10">
        <EmptyState
          icon={IdCard}
          title="No credential on this device"
          description="Complete KYC or skip to issue a soulbound digital tourist ID. KYC never goes on-chain."
          action={
            <Button asChild>
              <Link href="/onboard">Start onboarding</Link>
            </Button>
          }
        />
      </main>
    );
  }

  const card = digitalId ?? {
    id: tourist?.id ?? "local",
    tourist_id: tourist?.id ?? "local",
    chain_id: publicEnv.chainId,
    contract_address: publicEnv.touristIdRegistry,
    token_id: null,
    vc_path: null,
    status: "pending" as const,
    issue_tx_hash: null,
    valid_from: tourist?.trip_start ?? new Date().toISOString(),
    valid_until: tourist?.trip_end ?? new Date().toISOString(),
    kyc_last4: tourist?.kyc_last4 ?? null,
    kyc_type: tourist?.kyc_type ?? "aadhaar",
    kyc_status: tourist?.kyc_status,
    full_name: tourist?.full_name ?? "Tourist",
    nationality: tourist?.nationality ?? "IN",
    photo_data_url: tourist?.photo_data_url ?? null,
  };

  return (
    <main className="sts-enter mx-auto flex max-w-lg flex-col gap-6 px-4 py-6">
      <PageHeader
        kicker="Credential"
        title="Digital ID"
        description="Show this at checkpoints. Valid offline as a local commitment."
        className="mb-0"
      />
      <DigitalIdCard id={card} />
      {tourist?.kyc_status === "skipped" ? (
        <p className="text-center text-sm text-muted-foreground">
          Guest credential.{" "}
          <Link href="/onboard" className="text-primary underline">
            Complete Aadhaar / passport KYC
          </Link>{" "}
          for a verified checkpoint card.
        </p>
      ) : null}
      <div className="flex justify-center">
        <SignOutButton />
      </div>
    </main>
  );
}
