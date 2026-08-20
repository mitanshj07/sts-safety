// apps/web/src/app/(auth)/login/page.tsx
import type { Metadata } from "next";
import { DIGILOCKER_REASON_COPY } from "@sts/shared";

import { loginTabSchema } from "@/lib/auth/schemas";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in · Smart Tourist Safety",
};

function initialError(params: {
  error?: string;
  digilocker?: string;
  reason?: string;
}): string | null {
  if (typeof params.error === "string" && params.error.length > 0) {
    return params.error;
  }
  if (params.digilocker === "denied") {
    return "DigiLocker access was cancelled. Allow the request to fetch eAadhaar, or use a demo tourist login.";
  }
  if (params.digilocker === "error") {
    const reason = params.reason ?? "";
    if (reason in DIGILOCKER_REASON_COPY) {
      return DIGILOCKER_REASON_COPY[reason as keyof typeof DIGILOCKER_REASON_COPY];
    }
    return DIGILOCKER_REASON_COPY.fetch;
  }
  return null;
}

function initialInfo(params: { digilocker?: string }): string | null {
  if (params.digilocker === "ready") {
    return "eAadhaar is ready. Continue as an anonymous tourist to open onboarding with the fields filled in.";
  }
  return null;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    error?: string;
    digilocker?: string;
    reason?: string;
  }>;
}) {
  const params = await searchParams;
  const parsedTab = loginTabSchema.safeParse(params.tab ?? "magic");
  const tab = parsedTab.success ? parsedTab.data : "magic";

  return (
    <LoginForm
      defaultTab={tab}
      initialError={initialError(params)}
      initialInfo={initialInfo(params)}
    />
  );
}
