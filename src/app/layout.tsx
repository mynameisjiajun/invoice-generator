import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://apexcinematics.tech"),
  title: "Apex Cinematics | Videography & Photography, Singapore",
  description:
    "Apex Cinematics is a Singapore-based studio covering events, documentaries, and social content — cinematic photo and video for everyone and anyone.",
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
