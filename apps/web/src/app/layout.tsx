// apps/web/src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { TooltipProvider } from "@/components/ui/tooltip";
import { SentryInit } from "@/components/shared/SentryInit";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Smart Tourist Safety",
    template: "%s · STS Safety",
  },
  description:
    "Smart Tourist Safety Monitoring & Incident Response System for the Ministry of Development of North Eastern Region.",
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
  themeColor: "#0c1220",
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
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <SentryInit />
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
