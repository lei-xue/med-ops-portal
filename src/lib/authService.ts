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

/** Best-effort audit row for successful logins. Never blocks the login. */
export async function recordLogin(user: SessionUser): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorId: user.id,
      action: "user.login",
      entityType: "user",
      entityId: user.id,
      details: { email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("Failed to write user.login audit row", err);
  }
}

let cachedDummyHash: string | null = null;

function dummyHash(): string {
  // A valid bcrypt hash of a throwaway password, computed lazily once.
  return (cachedDummyHash ??= bcrypt.hashSync("timing-equalizer", 10));
}
