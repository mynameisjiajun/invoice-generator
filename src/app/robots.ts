import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/invoices_login", "/api"] }],
    sitemap: "https://apexcinematics.tech/sitemap.xml",
  };
}
