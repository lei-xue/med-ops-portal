/**
 * Fixed-window, in-memory rate limiter.
 *
 * Good enough for a single app instance (the demo deployment). Several
 * replicas would each keep their own counters; that setup would need a
 * shared store such as Redis instead.
 */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    /** Hard cap on tracked keys so a flood of distinct keys can't grow memory unbounded. */
    private readonly maxKeys = 10_000,
  ) {}

  /** Count one hit for `key`. Returns seconds to wait when over the limit. */
  hit(key: string, now = Date.now()): { ok: true } | { ok: false; retryAfter: number } {
    if (this.hits.size >= this.maxKeys) this.prune(now);

    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return { ok: true };
    }
    entry.count += 1;
    if (entry.count > this.limit) {
      return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
    }
    return { ok: true };
  }

  reset(key?: string): void {
    if (key === undefined) this.hits.clear();
    else this.hits.delete(key);
  }

  /** Drop expired keys; if still full, evict the oldest (Maps keep insertion order). */
  private prune(now: number): void {
    for (const [key, entry] of this.hits) {
      if (entry.resetAt <= now) this.hits.delete(key);
    }
    const excess = this.hits.size - Math.floor(this.maxKeys * 0.9);
    if (excess <= 0) return;
    let removed = 0;
    for (const key of this.hits.keys()) {
      if (removed++ >= excess) break;
      this.hits.delete(key);
    }
  }

  get size(): number {
    return this.hits.size;
  }
}
