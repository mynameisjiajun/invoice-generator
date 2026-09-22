import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://apexcinematics.tech"),
  title: "Apex Cinematics | Videography & Photography, Singapore",
  description:
    "Apex Cinematics is a Singapore-based studio covering events, documentaries, and social content — cinematic photo and video for everyone and anyone.",
  // Google Search Console ownership proof, which Google's OAuth consent
  // screen requires before it will accept apexcinematics.tech as an
  // authorized domain. Read from the environment rather than hardcoded so
  // the token can be rotated (or a second one added) without a code change;
  // NEXT_PUBLIC_ because metadata is evaluated at build time. Omitted
  // entirely when unset, so no empty meta tag is emitted.
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
