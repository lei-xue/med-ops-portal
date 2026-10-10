import { describe, expect, it } from "vitest";

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
