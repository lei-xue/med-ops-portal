import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";

import { db, pool } from "@/db";
import {
  medications,
  users,
  type Medication,
  type User,
  type UserRole,
} from "@/db/schema";

export const TEST_PASSWORD = "test-password";

export async function resetDatabase(): Promise<void> {
  await db.execute(
    sql`TRUNCATE audit_logs, medication_orders, medications, users RESTART IDENTITY CASCADE`,
  );
}

export async function closeDb(): Promise<void> {
  await pool.end();
}

let fixtureCounter = 0;

export async function seedUser(role: UserRole = "technician"): Promise<User> {
  fixtureCounter += 1;
  const [user] = await db
    .insert(users)
    .values({
      name: `Test ${role} ${fixtureCounter}`,
      email: `${role}.${fixtureCounter}@test.local`,
      passwordHash: bcrypt.hashSync(TEST_PASSWORD, 4),
      role,
    })
    .returning();
  return user;
}

export async function seedMedication(
  stockQuantity = 100,
  reorderThreshold = 10,
): Promise<Medication> {
  fixtureCounter += 1;
  const n = String(fixtureCounter).padStart(3, "0");
  const [med] = await db
    .insert(medications)
    .values({
      name: `Test Medication ${n}`,
      ndc: `99999-0000-${n.slice(-2)}`,
      strength: "10 mg",
      dosageForm: "tablet",
      stockQuantity,
      reorderThreshold,
    })
    .returning();
  return med;
}
