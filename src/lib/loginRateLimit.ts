import { RateLimiter } from "@/lib/rateLimit";

// Two windows: slow guessing against one account, and spraying from one address.
export const loginPerAccount = new RateLimiter(5, 5 * 60_000);
export const loginPerAddress = new RateLimiter(30, 5 * 60_000);

/** Clears login rate-limit counters (tests only). */
export function resetLoginRateLimits(): void {
  loginPerAccount.reset();
  loginPerAddress.reset();
}
