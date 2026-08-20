import { DigilockerConsent } from "@/components/tourist/DigilockerConsent";

export default function OnboardDigilockerPage() {
  return (
    <DigilockerConsent cancelHref="/onboard" cancelLabel="Cancel and return" />
  );
}
