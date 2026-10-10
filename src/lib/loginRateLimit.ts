import { RateLimiter } from "@/lib/rateLimit";

const FIVE_MINUTES = 5 * 60_000;

// Slow guessing against one account from one address.
export const loginPerAccount = new RateLimiter(5, FIVE_MINUTES);
// Credential stuffing: many addresses against one account. Looser, so people
// behind a shared NAT don't lock each other out of the demo accounts.
export const loginPerEmail = new RateLimiter(20, 15 * 60_000);
// Password spraying from one address across many accounts. Coarse on purpose:
// a team trying the demo from one office IP must not hit it.
export const loginPerAddress = new RateLimiter(100, FIVE_MINUTES);

/** Clears login rate-limit counters (tests only). */
export function resetLoginRateLimits(): void {
  loginPerAccount.reset();
  loginPerEmail.reset();
  loginPerAddress.reset();
}
