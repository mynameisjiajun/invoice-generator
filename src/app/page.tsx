import { Inter, Oswald } from "next/font/google";
import Portfolio from "@/components/portfolio/Portfolio";

// Self-hosted via next/font: no Google Fonts CDN request, so the strict
// CSP needs no font-src/style-src additions for this page.
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

export default function HomePage() {
  return (
    <div data-apex-root className={`${oswald.variable} ${inter.variable} flex-1`}>
      <Portfolio />
    </div>
  );
}
