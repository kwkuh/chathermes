import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.PUBLIC_BASE_URL || "https://chathermes.com";
  return {
    rules: [
      // Allow crawlers on public surfaces
      { userAgent: "*", allow: ["/", "/auth/login", "/status", "/p/"], disallow: ["/app/", "/admin/", "/api/", "/dev/", "/auth/verify"] },
      // Block AI scrapers from training on the app surface (keep landing free)
      { userAgent: ["GPTBot", "ClaudeBot", "PerplexityBot", "anthropic-ai", "CCBot"], disallow: ["/app/", "/admin/", "/dev/", "/p/"] },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
