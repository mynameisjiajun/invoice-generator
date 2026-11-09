import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import { BusinessProvider } from "@/lib/businessContext";
import ServiceWorker from "@/components/ServiceWorker";

// Editorial pairing: a warm, high-contrast serif for headlines (the
// "magazine" voice) against a humanist grotesque for UI text, with a
// typewriter mono for EXIF-style captions — a photographer's contact sheet,
// not a SaaS dashboard.
//
// Self-hosted from src/fonts (Latin subsets from Google Fonts, OFL) rather
// than next/font/google, whose build-time download made Vercel builds fail
// intermittently. Fraunces is the full variable font (opsz, SOFT, WONK axes).
const fraunces = localFont({
  src: [
    { path: "../../fonts/Fraunces-latin-var.woff2", weight: "100 900", style: "normal" },
    { path: "../../fonts/Fraunces-Italic-latin-var.woff2", weight: "100 900", style: "italic" },
  ],
  variable: "--font-display",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

const workSans = localFont({
  src: [{ path: "../../fonts/WorkSans-latin-var.woff2", weight: "400 700", style: "normal" }],
  variable: "--font-body",
  display: "swap",
});

const spaceMono = localFont({
  src: [
    { path: "../../fonts/SpaceMono-Regular-latin.woff2", weight: "400", style: "normal" },
    { path: "../../fonts/SpaceMono-Bold-latin.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["ui-monospace", "Menlo", "monospace"],
});

export const metadata: Metadata = {
  title: "Apex Cinematics Admin",
  description: "Apex Cinematics admin",
  // Kept out of search results (robots.txt no longer names this path).
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Invoices" },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F0E4" },
    { media: "(prefers-color-scheme: dark)", color: "#14110C" },
  ],
};

export default function InvoiceAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className={`${fraunces.variable} ${workSans.variable} ${spaceMono.variable} invoice-app-root flex-1 flex flex-col`}
    >
      <BusinessProvider>
        <TopBar />
        {children}
        <BottomNav />
        <ServiceWorker />
      </BusinessProvider>
    </div>
  );
}
