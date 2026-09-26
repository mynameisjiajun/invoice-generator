import type { MetadataRoute } from "next";
import { getPortfolio } from "@/lib/portfolio/data";

const BASE = "https://apexcinematics.tech";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { projects } = await getPortfolio();
  return [
    { url: BASE, changeFrequency: "monthly", priority: 1 },
    ...projects.map(({ slug }) => ({
      url: `${BASE}/work/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    // Listed so Google can find it on its own — its OAuth review checks that
    // the privacy policy URL is genuinely reachable and indexable.
    { url: `${BASE}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
