import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import type { SessionUser } from "@/lib/session";

/**
 * Verifies an email + password pair against the users table.
 * Returns the session user on success, null on any mismatch.
 */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const normalized = email.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalized));

  if (!user) {
    // Burn comparable time so missing users are not distinguishable by timing.
    await bcrypt.compare(password, dummyHash());
    return null;
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) return null;

  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export interface LoginContext {
  ip: string;
  userAgent: string | null;
}

/** Best-effort audit row for successful logins. A failed insert is logged and never fails the login. */
export async function recordLogin(
  user: SessionUser,
  context: LoginContext,
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorId: user.id,
      action: "user.login",
      entityType: "user",
      entityId: user.id,
      details: { email: user.email, role: user.role, ...context },
    });
  } catch (err) {
    console.error("Failed to write user.login audit row", err);
  }
}

/**
 * Audit a failed sign-in. Attempts against an existing account are written to
 * audit_logs with that account as the subject; unknown emails can't reference
 * a user row, so they go to the server log. The password is never recorded.
 */
export async function recordFailedLogin(
  email: string,
  context: LoginContext,
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  try {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalized));
    if (!user) {
      console.warn("Failed login for unknown email", { email: normalized, ...context });
      return;
    }
    await db.insert(auditLogs).values({
      actorId: user.id,
      action: "user.login_failed",
      entityType: "user",
      entityId: user.id,
      details: { email: normalized, ...context },
    });
  } catch (err) {
    console.error("Failed to write user.login_failed audit row", err);
  }
}

const inFlight = new Set<Promise<void>>();

/**
 * Let a login audit write finish without making the response wait. For
 * failures this also keeps an existing account from being slower to reject
 * than an unknown email. The writes catch their own errors.
 */
export function auditInBackground(write: Promise<void>): void {
  const tracked = write.finally(() => {
    inFlight.delete(tracked);
  });
  inFlight.add(tracked);
}

/** Resolves once background audit writes have finished (tests, shutdown). */
export async function settleAuditWrites(): Promise<void> {
  await Promise.all(inFlight);
}

let cachedDummyHash: string | null = null;

function dummyHash(): string {
  // A valid bcrypt hash of a throwaway password, computed lazily once.
  return (cachedDummyHash ??= bcrypt.hashSync("timing-equalizer", 10));
}
