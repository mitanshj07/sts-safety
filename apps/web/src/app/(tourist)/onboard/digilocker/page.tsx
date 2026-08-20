import { redirect } from "next/navigation";

import { DigilockerConsent } from "@/components/tourist/DigilockerConsent";
import { digilockerMode } from "@/lib/identity/digilocker";

export default function OnboardDigilockerPage() {
  if (digilockerMode() !== "demo") {
    redirect("/api/identity/digilocker/start?intent=onboard");
  }
  return (
    <DigilockerConsent cancelHref="/onboard" cancelLabel="Back to onboarding" />
  );
}
