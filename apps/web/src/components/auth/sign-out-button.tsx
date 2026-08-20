// apps/web/src/components/auth/sign-out-button.tsx
"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { getBrowserSupabase } from "@/lib/supabase/client";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          try {
            const supabase = getBrowserSupabase();
            if (supabase) {
              await supabase.auth.signOut();
            }
          } finally {
            window.location.assign("/login");
          }
        });
      }}
    >
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
