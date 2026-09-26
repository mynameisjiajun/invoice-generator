import { Inter, Oswald } from "next/font/google";

// Self-hosted via next/font. These variables feed the font-apex-* utilities
// (see the `@theme inline` block in globals.css — `inline` is load-bearing).
const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
});

export default function PortfolioLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div data-apex-root className={`${oswald.variable} ${inter.variable} flex-1`}>
      {children}
    </div>
  );
}
