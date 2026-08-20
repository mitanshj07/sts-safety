// apps/web/src/components/tourist/DigitalIdCard.tsx
"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { KYC_TYPE_LABELS, type KycType } from "@sts/shared";
import { publicEnv } from "@/lib/config/public";
import type { CachedDigitalId } from "@/lib/offline/db";
import type { QrPayload } from "@/lib/tourist/schemas";
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
    chainId: id.chain_id || publicEnv.chainId,
    contract: id.contract_address || publicEnv.touristIdRegistry,
    tokenId: id.token_id,
    vcPath: id.vc_path,
  };

  useEffect(() => {
    void QRCode.toDataURL(JSON.stringify(payload), {
      margin: 1,
      width: 220,
      color: { dark: "#12241c", light: "#f4f7f2" },
    }).then(setQr);
  }, [payload.chainId, payload.contract, payload.tokenId, payload.vcPath]);

  const explorer =
    id.issue_tx_hash && id.issue_tx_hash !== "0x0"
      ? `${publicEnv.blockExplorer}/tx/${id.issue_tx_hash}`
      : null;

  return (
    <article className="overflow-hidden rounded-2xl bg-[oklch(0.22_0.04_158)] text-[oklch(0.96_0.02_95)] shadow-lg">
      <header className="flex items-center justify-between px-5 py-3 text-[11px] tracking-[0.14em] text-[oklch(0.86_0.05_155)] uppercase">
        <span>MDoNER · Digital Tourist ID</span>
        <Badge variant="outline" className="border-[oklch(0.55_0.08_155)] text-[oklch(0.9_0.04_155)]">
          {id.status}
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
              className="size-24 rounded-xl object-cover ring-1 ring-white/10"
            />
          ) : (
            <div className="grid size-24 place-items-center rounded-xl bg-white/8 font-mono text-2xl">
              {id.full_name.slice(0, 1)}
            </div>
          )}
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="Digital ID QR" className="size-28 rounded-md bg-white p-1" />
          ) : (
            <div className="size-28 animate-pulse rounded-md bg-white/10" />
          )}
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <dt className="text-white/55">Name</dt>
          <dd className="font-medium">{id.full_name}</dd>
          <dt className="text-white/55">Nationality</dt>
          <dd className="font-mono">{id.nationality}</dd>
          <dt className="text-white/55">{kycHeading(id.kyc_type)}</dt>
          <dd className="font-mono">{maskKyc(id.kyc_last4)}</dd>
          <dt className="text-white/55">Token</dt>
          <dd className="font-mono text-xs">{id.token_id ?? "pending"}</dd>
          <dt className="text-white/55">Valid</dt>
          <dd className="text-xs">
            {new Date(id.valid_from).toLocaleDateString()} –{" "}
            {new Date(id.valid_until).toLocaleDateString()}
          </dd>
          <dt className="text-white/55">Chain</dt>
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
          className="block border-t border-white/10 px-5 py-3 text-center text-xs text-[oklch(0.86_0.06_155)] underline-offset-4 hover:underline"
        >
          View issuance tx on Polygonscan
        </a>
      ) : (
        <p className="border-t border-white/10 px-5 py-3 text-center text-xs text-white/55">
          On-chain issuance queued — ID is valid offline as a commitment.
        </p>
      )}
    </article>
  );
}
