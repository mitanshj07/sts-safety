"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const supabase = createClient();
          await supabase.auth.signOut();
          router.push("/login");
          router.refresh();
        });
      }}
    >
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
