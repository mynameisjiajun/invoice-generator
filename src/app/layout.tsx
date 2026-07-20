import type { Metadata, Viewport } from "next";
import { Fraunces, Space_Mono, Work_Sans } from "next/font/google";
import NavBar from "@/components/NavBar";
import "./globals.css";

// Editorial pairing: a warm, high-contrast serif for headlines (the
// "magazine" voice) against a humanist grotesque for UI text, with a
// typewriter mono for EXIF-style captions — a photographer's contact sheet,
// not a SaaS dashboard.
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz", "SOFT", "WONK"],
});

const workSans = Work_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const spaceMono = Space_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "JJ Visuals Invoices",
  description: "Invoice generator for JJ Visuals",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${workSans.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
