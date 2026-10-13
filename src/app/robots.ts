import type { MetadataRoute } from "next";

const HOST = "https://medops.leixue.dev";

// Private or non-page paths stay out of the index; /login is the only public page.
const DISALLOW = ["/api/", "/admin/", "/studio/"];

// AI crawlers get an explicit Allow group so their operators can see the site
// is intentionally open to them.
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      { userAgent: AI_CRAWLERS, allow: "/", disallow: DISALLOW },
    ],
    sitemap: `${HOST}/sitemap.xml`,
  };
}
