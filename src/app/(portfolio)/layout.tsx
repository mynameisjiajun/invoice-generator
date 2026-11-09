import localFont from "next/font/local";

// Self-hosted from src/fonts (Latin variable fonts, from Google Fonts, OFL).
// Not next/font/google: that downloads the fonts during every build, and
// Vercel builds failed whenever the download did. These variables feed the
// font-apex-* utilities (see the `@theme inline` block in globals.css —
// `inline` is load-bearing).
const oswald = localFont({
  src: [{ path: "../../fonts/Oswald-latin-var.woff2", weight: "400 700", style: "normal" }],
  variable: "--font-oswald",
  display: "swap",
});

const inter = localFont({
  src: [{ path: "../../fonts/Inter-latin-var.woff2", weight: "300 700", style: "normal" }],
  variable: "--font-inter",
  display: "swap",
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
