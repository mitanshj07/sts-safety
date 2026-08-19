// apps/web/src/app/(auth)/login/page.tsx
import type { Metadata } from "next";

import { loginTabSchema } from "@/lib/auth/schemas";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in · Smart Tourist Safety",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; error?: string; skip?: string }>;
}) {
  const params = await searchParams;
  const autoSkip = params.skip === "1" || params.skip === "true";
  const tab = loginTabSchema.catch("magic").parse(
    params.tab ?? (autoSkip ? "tourist" : "magic"),
  );
  const initialError =
    typeof params.error === "string" && params.error.length > 0
      ? params.error
      : null;

  return <LoginForm defaultTab={tab} initialError={initialError} autoSkip={autoSkip} />;
}
