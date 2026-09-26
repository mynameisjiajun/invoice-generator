import { Cormorant, Hanken_Grotesk } from "next/font/google";

// Self-hosted via next/font. These variables feed the font-apex-* utilities
// (see the `@theme inline` block in globals.css — `inline` is load-bearing).
// Cormorant for headings (film-credit elegance, sentence case), Hanken
// Grotesk for everything a visitor reads or taps.
const cormorant = Cormorant({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export default function PortfolioLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div data-apex-root className={`${cormorant.variable} ${hanken.variable} flex-1 bg-brand-dark`}>
      {children}
    </div>
  );
}
