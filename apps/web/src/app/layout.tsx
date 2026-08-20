// apps/web/src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Instrument_Serif, Manrope } from "next/font/google";

import { SkipLink } from "@/components/shared/SkipLink";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SentryInit } from "@/components/shared/SentryInit";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "STS Safety",
    template: "%s · STS Safety",
  },
  description:
    "Smart Tourist Safety for India’s North-East — offline geofencing, hold-to-SOS, and a live command room. Alerts fire even when AI and the chain are down.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "STS Safety",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f1a24",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${instrument.variable} ${plexMono.variable}`}
    >
      <body className="min-h-screen font-sans antialiased">
        <SkipLink />
        <SentryInit />
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
