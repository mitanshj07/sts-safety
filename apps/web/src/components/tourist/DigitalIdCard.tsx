// apps/web/src/components/tourist/DigitalIdCard.tsx
"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { KYC_TYPE_LABELS, type KycType } from "@sts/shared";
import { publicEnv } from "@/lib/config/public";
import type { CachedDigitalId } from "@/lib/offline/db";
import type { QrPayload } from "@/lib/tourist/schemas";
import { formatIstDate } from "@/lib/ui/format";

function kycHeading(kycType: string | null | undefined): string {
  if (kycType && kycType in KYC_TYPE_LABELS) {
    return KYC_TYPE_LABELS[kycType as KycType];
  }
  return "KYC";
}

function maskKyc(last4: string | null): string {
  if (!last4) return "•••• ••••";
  return `•••• ${last4}`;
}

function identityLabel(status: CachedDigitalId["status"]): { kicker: string; detail: string } {
  if (status === "active") {
    return { kicker: "Verified", detail: "Valid at checkpoints. Offline commitment on this device." };
  }
  if (status === "revoked" || status === "suspended") {
    return { kicker: "Revoked", detail: "This credential is no longer valid." };
  }
  if (status === "expired") {
    return { kicker: "Expired", detail: "Issue a new ID for this trip." };
  }
  return { kicker: "Verification required", detail: "Issuance is pending. Show this only if asked." };
}

export function DigitalIdCard({ id }: { id: CachedDigitalId }) {
  const [qr, setQr] = useState<string | null>(null);
  const payload: QrPayload = {
    chainId: id.chain_id || publicEnv.chainId,
    contract: id.contract_address || publicEnv.touristIdRegistry,
    tokenId: id.token_id,
    vcPath: id.vc_path,
  };

  useEffect(() => {
    void QRCode.toDataURL(JSON.stringify(payload), {
      margin: 1,
      width: 220,
      color: { dark: "#1A3A2A", light: "#F7F3EA" },
    }).then(setQr);
  }, [payload.chainId, payload.contract, payload.tokenId, payload.vcPath]);

  const explorer =
    id.issue_tx_hash && id.issue_tx_hash !== "0x0"
      ? `${publicEnv.blockExplorer}/tx/${id.issue_tx_hash}`
      : null;
  const identity = identityLabel(id.status);

  return (
    <article className="border border-border bg-surface-elevated shadow-sm">
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
        <div>
          <p className="sts-kicker">MDoNER · Digital Tourist ID</p>
          <p className="mt-1 text-sm font-semibold tracking-tight">{identity.kicker}</p>
        </div>
        <p className="sts-meta">{id.nationality}</p>
      </header>
      <div className="grid gap-5 px-5 py-5 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-2">
          {id.photo_data_url ? (
            // Local data URL captured at onboard — not a remote asset.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={id.photo_data_url}
              alt=""
              className="size-24 object-cover ring-1 ring-border"
            />
          ) : (
            <div className="grid size-24 place-items-center bg-muted font-mono text-2xl">
              {id.full_name.slice(0, 1)}
            </div>
          )}
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="Digital ID QR" className="size-28" />
          ) : (
            <div className="size-28 animate-pulse bg-muted" />
          )}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Name</dt>
          <dd className="font-medium">{id.full_name}</dd>
          <dt className="text-muted-foreground">{kycHeading(id.kyc_type)}</dt>
          <dd className="font-mono">{maskKyc(id.kyc_last4)}</dd>
          <dt className="text-muted-foreground">Token</dt>
          <dd className="font-mono text-xs">{id.token_id ?? "pending"}</dd>
          <dt className="text-muted-foreground">Valid</dt>
          <dd className="sts-meta text-foreground">
            {formatIstDate(id.valid_from)} – {formatIstDate(id.valid_until)}
          </dd>
        </dl>
      </div>
      <p className="border-t border-border px-5 py-3 text-xs leading-relaxed text-muted-foreground">
        {identity.detail}
        {explorer ? (
          <>
            {" "}
            <a
              href={explorer}
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline underline-offset-4"
            >
              View issuance
            </a>
          </>
        ) : (
          " On-chain issuance may still be queued."
        )}
      </p>
    </article>
  );
}
