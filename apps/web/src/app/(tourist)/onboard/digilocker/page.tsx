// apps/web/src/app/(tourist)/onboard/digilocker/page.tsx
"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DEMO_DIGILOCKER_CODE, DEMO_DIGILOCKER_PROFILE } from "@sts/shared";
import { Landmark } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function DigilockerConsentInner() {
  const params = useSearchParams();
  const state = params.get("state") ?? "";

  function go(query: string) {
    window.location.assign(`/api/identity/digilocker/callback?${query}`);
  }

  if (!state) {
    return (
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-8">
        <p className="text-sm text-destructive">DigiLocker session expired.</p>
        <Button asChild>
          <Link href="/onboard">Back to onboarding</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-5 px-4 py-8">
      <p className="sts-kicker">MeitY DigiLocker · demo sandbox</p>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Landmark className="size-5 text-primary" aria-hidden />
            Allow Smart Tourist Safety to fetch issued documents?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            This demo consent stands in for the live DigiLocker login. After you
            allow, the app fetches eAadhaar XML and the issued-documents list —
            the same steps as the partner API once credentials are set.
          </p>
          <ul className="space-y-2 rounded-xl border border-border bg-background px-3 py-3">
            {DEMO_DIGILOCKER_PROFILE.documents.map((doc) => (
              <li key={doc.doctype} className="flex justify-between gap-3">
                <span className="font-medium">{doc.label}</span>
                <span className="text-xs text-muted-foreground">{doc.issuer}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              className="flex-1"
              data-testid="digilocker-allow"
              onClick={() =>
                go(
                  `code=${encodeURIComponent(DEMO_DIGILOCKER_CODE)}&state=${encodeURIComponent(state)}`,
                )
              }
            >
              Allow and fetch
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              data-testid="digilocker-deny"
              onClick={() =>
                go(`error=access_denied&state=${encodeURIComponent(state)}`)
              }
            >
              Deny
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

export default function DigilockerConsentPage() {
  return (
    <Suspense fallback={<main className="px-4 py-8 text-sm text-muted-foreground">Loading DigiLocker…</main>}>
      <DigilockerConsentInner />
    </Suspense>
  );
}
