import type { MetadataRoute } from "next";

const HOST = "https://medops.leixue.dev";

// Only /login is reachable without a session; every other route redirects
// anonymous visitors there, so it is the only URL worth listing.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${HOST}/login`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 1,
    },
  ];
}
