import { describe, expect, it } from "vitest";

import { clientIp, MAX_JSON_BODY_BYTES, readJsonBody } from "@/lib/api";
import { RateLimiter } from "@/lib/rateLimit";
import { safeCallbackPath } from "@/lib/safeRedirect";

describe("safeCallbackPath", () => {
  it.each([
    ["/orders", "/orders"],
    ["/orders?status=pending", "/orders?status=pending"],
    ["/audit?page=2#top", "/audit?page=2#top"],
  ])("keeps same-origin path %s", (input, expected) => {
    expect(safeCallbackPath(input)).toBe(expected);
  });

  it.each([
    null,
    "",
    "orders",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/\t/evil.example",
    "\\\\evil.example",
    "/..//evil.example",
    "/.//evil.example",
    "/%2e%2e//evil.example",
    "/orders/..//evil.example",
    "javascript:alert(1)",
  ])("falls back to / for %j", (input) => {
    expect(safeCallbackPath(input)).toBe("/");
  });
});

describe("RateLimiter", () => {
  it("allows up to the limit, then reports seconds to wait", () => {
    const limiter = new RateLimiter(2, 60_000);
    const t0 = 1_000_000;
    expect(limiter.hit("k", t0)).toEqual({ ok: true });
    expect(limiter.hit("k", t0)).toEqual({ ok: true });
    expect(limiter.hit("k", t0 + 15_000)).toEqual({ ok: false, retryAfter: 45 });
  });

  it("starts a fresh window after it expires, per key", () => {
    const limiter = new RateLimiter(1, 1_000);
    expect(limiter.hit("a", 0)).toEqual({ ok: true });
    expect(limiter.hit("a", 10).ok).toBe(false);
    expect(limiter.hit("b", 10)).toEqual({ ok: true });
    expect(limiter.hit("a", 1_000)).toEqual({ ok: true });
  });
});

describe("RateLimiter key cap", () => {
  it("never tracks more keys than its cap, even with no expired entries", () => {
    const limiter = new RateLimiter(5, 60_000, 100);
    for (let i = 0; i < 1_000; i += 1) limiter.hit(`ip-${i}`, 0);
    expect(limiter.size).toBeLessThanOrEqual(100);
  });
});

describe("clientIp", () => {
  it("prefers Cloudflare's CF-Connecting-IP over client-controlled headers", () => {
    const req = new Request("http://localhost/", {
      headers: {
        "cf-connecting-ip": "203.0.113.10",
        "x-real-ip": "6.6.6.6",
        "x-forwarded-for": "7.7.7.7, 203.0.113.10",
      },
    });
    expect(clientIp(req)).toBe("203.0.113.10");
  });

  it("falls back to forwarded headers only when Cloudflare's is absent", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "198.51.100.1, 10.0.0.1" },
    });
    expect(clientIp(req)).toBe("198.51.100.1");
  });
});

describe("readJsonBody", () => {
  /** A streamed (chunked) body with no Content-Length, counting chunks pulled. */
  const streamed = (chunks: number, chunk: Uint8Array) => {
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pulled === chunks) return controller.close();
        pulled += 1;
        controller.enqueue(chunk);
      },
    });
    const req = new Request("http://localhost/api/orders", {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit);
    return { req, pulled: () => pulled };
  };

  it("stops reading a chunked body once it passes the cap", async () => {
    const { req, pulled } = streamed(1_000, new Uint8Array(1024).fill(0x20));
    expect(req.headers.get("content-length")).toBeNull();
    expect(await readJsonBody(req)).toEqual({ tooLarge: true });
    expect(pulled()).toBeLessThan(MAX_JSON_BODY_BYTES / 1024 + 5);
  });

  it("counts bytes, not characters", async () => {
    // 6,000 three-byte characters: under the cap in UTF-16 units, over it in bytes.
    const json = JSON.stringify({ notes: "€".repeat(6_000) });
    const req = new Request("http://localhost/api/orders", { method: "POST", body: json });
    expect(await readJsonBody(req)).toEqual({ tooLarge: true });
  });

  it("parses a small chunked body", async () => {
    const { req } = streamed(1, new TextEncoder().encode('{"ok":true}'));
    expect(await readJsonBody(req)).toEqual({ tooLarge: false, body: { ok: true } });
  });

  it("returns null for invalid JSON", async () => {
    const req = new Request("http://localhost/api/orders", { method: "POST", body: "{" });
    expect(await readJsonBody(req)).toEqual({ tooLarge: false, body: null });
  });
});
