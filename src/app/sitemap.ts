import type { MetadataRoute } from "next";
import { foodSlugs, SEO_CONDITIONS, SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/makanan`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    ...SEO_CONDITIONS.map((c) => ({ url: `${SITE_URL}/kondisi/${c.slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.8 })),
    ...foodSlugs().map((s) => ({ url: `${SITE_URL}/makanan/${s}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.6 })),
    { url: `${SITE_URL}/privasi`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}
