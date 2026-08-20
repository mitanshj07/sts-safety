// apps/web/src/components/tourist/DigilockerConnect.tsx
"use client";

import { Landmark, ShieldCheck } from "lucide-react";
import { KYC_TYPE_LABELS, type DigilockerSession } from "@sts/shared";

import { Button } from "@/components/ui/button";

type DigilockerConnectProps = {
  session: DigilockerSession | null;
  notice: string | null;
  onStart: () => void;
  onClear: () => void;
};

export function DigilockerConnect({
  session,
  notice,
  onStart,
  onClear,
}: DigilockerConnectProps) {
  if (session) {
    const docLabel =
      session.kycType === "aadhaar"
        ? "eAadhaar"
        : KYC_TYPE_LABELS[session.kycType];
    return (
      <div
        data-testid="digilocker-fetched"
        className="space-y-3 border border-primary/30 bg-primary/5 px-3 py-3"
      >
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="text-sm font-semibold">Fetched from DigiLocker</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {docLabel} ending {session.kycLast4}. Name and date of birth are
              filled from the issued XML.
            </p>
          </div>
        </div>
        <ul className="flex flex-wrap gap-1.5">
          {session.documents.map((doc) => (
            <li
              key={`${doc.kycType}-${doc.doctype}`}
              className="border border-border bg-background px-2.5 py-0.5 text-[11px]"
            >
              {doc.label}
            </li>
          ))}
        </ul>
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          Enter a different document instead
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 border border-border bg-background px-3 py-3">
      <div className="flex items-start gap-2">
        <Landmark className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div>
          <p className="text-sm font-semibold">DigiLocker</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Sign in, allow access, and we pull eAadhaar plus issued DL / voter ID
            into this form.
          </p>
        </div>
      </div>
      {notice ? <p className="text-xs text-destructive">{notice}</p> : null}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        data-testid="digilocker-continue"
        onClick={onStart}
      >
        Continue with DigiLocker
      </Button>
    </div>
  );
}
