import path from "path";
import type { NextConfig } from "next";

// A conservative CSP: 'unsafe-inline' for script/style is a pragmatic v1 —
// Next's inline runtime scripts make nonce-based CSP a bigger project (would
// force dynamic rendering everywhere, see the framework's CSP guide). data:/
// blob: img-src covers the PayNow QR data-URL and PDF blob previews;
// worker-src blob: covers @react-pdf/renderer's worker; connect-src allows
// only Supabase (the only network the client talks to — wa.me/Gmail/Telegram
// links are top-level navigations via window.open, not subject to connect-src).
// React's dev-mode debugging (HMR, reconstructing stack traces) needs the
// 'unsafe-eval' CSP keyword; it is never needed in a production build.
// 'wasm-unsafe-eval' is separate and always required: @react-pdf/renderer's
// layout engine (yoga-layout) instantiates a WebAssembly module to generate
// invoice PDFs, which the Download/Share actions depend on.
const isDev = process.env.NODE_ENV === "development";
// Vercel's own docs require these vercel.live/vercel.com allowances so the
// Vercel Toolbar (live comments/preview panel) keeps working under a CSP —
// https://vercel.com/docs/vercel-toolbar/managing-toolbar#using-a-content-security-policy
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://vercel.live${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://vercel.live",
  "img-src 'self' data: blob: https://vercel.live https://vercel.com https://i.ytimg.com",
  "media-src 'self'",
  "font-src 'self' https://vercel.live https://assets.vercel.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vercel.live wss://ws-us3.pusher.com",
  "frame-src https://vercel.live https://www.youtube-nocookie.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
].join("; ");

// Standard, low-risk security response headers applied to every route.
// HSTS is safe: Vercel serves HTTPS only.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      { source: "/login", destination: "/invoices_login", permanent: true },
    ];
  },
};

export default nextConfig;
