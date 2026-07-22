import type { MetadataRoute } from "next";
import { projectSlugs } from "@/components/portfolio/projects";

const BASE = "https://apexcinematics.tech";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE, changeFrequency: "monthly", priority: 1 },
    ...projectSlugs().map((slug) => ({
      url: `${BASE}/work/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
