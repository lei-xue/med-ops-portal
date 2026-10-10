import type { NextConfig } from "next";

// Sent on every response, in dev and prod alike. HSTS is set by Caddy, since
// it only makes sense on the HTTPS origin.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Refuse framing (clickjacking); frame-ancestors is the modern equivalent.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // Demo site: keep it out of search results.
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
