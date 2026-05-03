import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.PUBLIC_BASE_URL || "https://chathermes.com";
  const now = new Date();
  return [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/auth/login`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/status`, lastModified: now, changeFrequency: "always", priority: 0.7 },
  ];
}
