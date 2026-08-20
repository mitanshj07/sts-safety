// apps/web/src/app/(auth)/layout.tsx
import Link from "next/link";

import { AppMark } from "@/components/shared/AppMark";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="dark sts-mesh sts-ridge relative flex min-h-screen flex-col">
      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-6">
        <Link
          href="/"
          className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <AppMark />
        </Link>
      </header>
      <div id="main" className="relative z-10 flex flex-1 items-center justify-center px-4 py-8">
        {children}
      </div>
    </div>
  );
}
