// apps/web/src/components/tourist/DigitalIdCard.tsx
"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { KYC_TYPE_LABELS, type KycType, type QrPayload } from "@sts/shared";
import { publicEnv } from "@/lib/config/public";
import type { CachedDigitalId } from "@/lib/offline/db";
import { Badge } from "@/components/ui/badge";

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

export function DigitalIdCard({ id }: { id: CachedDigitalId }) {
  const [qr, setQr] = useState<string | null>(null);
  const payload: QrPayload = {
    v: 1,
    kind: "sts-id",
    chainId: id.chain_id || publicEnv.chainId,
    contract: id.contract_address || publicEnv.touristIdRegistry,
    tokenId: id.token_id,
    digitalId: id.id,
    touristId: id.tourist_id,
    vcPath: id.vc_path,
    sig: null,
    kycStatus: id.kyc_status,
  };
  const payloadJson = JSON.stringify(payload);

  useEffect(() => {
    void QRCode.toDataURL(payloadJson, {
      margin: 1,
      width: 220,
      color: { dark: "#022c22", light: "#ecfdf5" },
    }).then(setQr);
  }, [payloadJson]);

  const explorer =
    id.issue_tx_hash && id.issue_tx_hash !== "0x0"
      ? `${publicEnv.blockExplorer}/tx/${id.issue_tx_hash}`
      : null;

  return (
    <article className="overflow-hidden rounded-2xl border border-emerald-800/50 bg-gradient-to-br from-emerald-950 via-emerald-950/80 to-zinc-950 shadow-[0_24px_60px_rgb(0_0_0_/_0.45)]">
      <header className="flex items-center justify-between px-5 py-3 text-xs tracking-widest text-emerald-200/80 uppercase">
        <span>MDoNER · Digital Tourist ID</span>
        <Badge variant="outline" className="border-emerald-700 text-emerald-200">
          {id.kyc_status === "skipped" ? "guest" : id.status}
        </Badge>
      </header>
      <div className="grid gap-4 px-5 pb-5 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-2">
          {id.photo_data_url ? (
            // Local data URL captured at onboard — not a remote asset.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={id.photo_data_url}
              alt=""
              className="size-24 rounded-xl object-cover ring-1 ring-emerald-800"
            />
          ) : (
            <div className="grid size-24 place-items-center rounded-xl bg-emerald-900/50 font-mono text-2xl text-emerald-100">
              {id.full_name.slice(0, 1)}
            </div>
          )}
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="Digital ID QR" className="size-28 rounded-md" />
          ) : (
            <div className="size-28 animate-pulse rounded-md bg-emerald-900/40" />
          )}
          <p className="sr-only" data-testid="id-qr-payload">
            {payloadJson}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Name</dt>
          <dd className="font-medium">{id.full_name}</dd>
          <dt className="text-muted-foreground">Nationality</dt>
          <dd className="font-mono">{id.nationality}</dd>
          <dt className="text-muted-foreground">{kycHeading(id.kyc_type)}</dt>
          <dd className="font-mono">{maskKyc(id.kyc_last4)}</dd>
          <dt className="text-muted-foreground">Token</dt>
          <dd className="font-mono text-xs">{id.token_id ?? "offline"}</dd>
          <dt className="text-muted-foreground">Valid</dt>
          <dd className="text-xs">
            {new Date(id.valid_from).toLocaleDateString()} –{" "}
            {new Date(id.valid_until).toLocaleDateString()}
          </dd>
          <dt className="text-muted-foreground">Chain</dt>
          <dd className="text-xs">
            {publicEnv.chainName} ({payload.chainId})
          </dd>
        </dl>
      </div>
      {explorer ? (
        <a
          href={explorer}
          target="_blank"
          rel="noreferrer"
          className="block border-t border-emerald-900/60 px-5 py-3 text-center text-xs text-emerald-300 underline-offset-4 hover:underline"
        >
          View issuance tx on Polygonscan
        </a>
      ) : (
        <p className="border-t border-emerald-900/60 px-5 py-3 text-center text-xs text-muted-foreground">
          Show this QR at the command centre — valid with or without an on-chain token.
        </p>
      )}
    </article>
  );
}
