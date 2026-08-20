import type { Metadata } from "next";

import { DigilockerConsent } from "@/components/tourist/DigilockerConsent";

export const metadata: Metadata = {
  title: "DigiLocker · Smart Tourist Safety",
};

export default function LoginDigilockerPage() {
  return (
    <DigilockerConsent
      cancelHref="/login?tab=tourist"
      cancelLabel="Back to sign in"
    />
  );
}
