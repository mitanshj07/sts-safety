// apps/web/src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, IBM_Plex_Mono, Instrument_Serif } from "next/font/google";

import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SentryInit } from "@/components/shared/SentryInit";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: {
    default: "Smart Tourist Safety",
    template: "%s · STS Safety",
  },
  description:
    "Location-aware safety assistance for tourists, field officers, and emergency operators in India’s North-East.",
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F0E4" },
    { media: "(prefers-color-scheme: dark)", color: "#161C28" },
  ],
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
      suppressHydrationWarning
      className={`${geistSans.variable} ${ibmPlexMono.variable} ${instrumentSerif.variable}`}
    >
      <body className="min-h-screen font-sans antialiased">
        <ThemeProvider>
          <SentryInit />
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
