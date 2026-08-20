import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DigilockerConsent } from "@/components/tourist/DigilockerConsent";
import { digilockerMode } from "@/lib/identity/digilocker";

export const metadata: Metadata = {
  title: "DigiLocker · Smart Tourist Safety",
};

export default function LoginDigilockerPage() {
  if (digilockerMode() !== "demo") {
    redirect("/api/identity/digilocker/start?intent=signup");
  }
  return (
    <DigilockerConsent
      cancelHref="/login?tab=tourist"
      cancelLabel="Back to sign in"
    />
  );
}
