import path from "path";
import type { NextConfig } from "next";

// Standard, low-risk security response headers applied to every route.
// Deliberately no strict Content-Security-Policy here: the app renders a lot
// of inline styles (and react-pdf/Supabase need permissive connect/img), so a
// tight CSP would need careful per-directive testing — tracked as a follow-up
// rather than risking breakage. HSTS is safe: Vercel serves HTTPS only.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
