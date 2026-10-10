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
  ) {}

  /** Count one hit for `key`. Returns seconds to wait when over the limit. */
  hit(key: string, now = Date.now()): { ok: true } | { ok: false; retryAfter: number } {
    if (this.hits.size > 10_000) this.prune(now);

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

  private prune(now: number): void {
    for (const [key, entry] of this.hits) {
      if (entry.resetAt <= now) this.hits.delete(key);
    }
  }
}
