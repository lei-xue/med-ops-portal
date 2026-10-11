import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";

import { db, pool } from "@/db";
import {
  medications,
  patients,
  prescribers,
  users,
  type DeaSchedule,
  type Medication,
  type Patient,
  type Prescriber,
  type RxStatus,
  type User,
  type UserRole,
} from "@/db/schema";

export const TEST_PASSWORD = "test-password";

export async function resetDatabase(): Promise<void> {
  await db.execute(
    sql`TRUNCATE audit_logs, medication_orders, medications, patients, prescribers, users RESTART IDENTITY CASCADE`,
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
  options: { rxStatus?: RxStatus; deaSchedule?: DeaSchedule | null } = {},
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
      stockUnit: "tablets",
      rxStatus: options.rxStatus ?? "rx",
      deaSchedule: options.deaSchedule ?? null,
      stockQuantity,
      reorderThreshold,
    })
    .returning();
  return med;
}

export async function seedPatient(name = "Test Patient"): Promise<Patient> {
  fixtureCounter += 1;
  const [patient] = await db
    .insert(patients)
    .values({
      name,
      mrn: `MRN-T${String(fixtureCounter).padStart(5, "0")}`,
      dateOfBirth: "1990-01-01",
    })
    .returning();
  return patient;
}

export async function seedPrescriber(): Promise<Prescriber> {
  fixtureCounter += 1;
  const [prescriber] = await db
    .insert(prescribers)
    .values({
      name: `Test Prescriber ${fixtureCounter}`,
      credentials: "MD",
      npi: `19990${String(fixtureCounter).padStart(5, "0")}`,
      specialty: "Family Medicine",
    })
    .returning();
  return prescriber;
}

/** A fresh patient plus prescriber, as the ids an order needs. */
export async function seedParties(
  patientName = "Test Patient",
): Promise<{ patientId: number; prescriberId: number }> {
  const [patient, prescriber] = await Promise.all([
    seedPatient(patientName),
    seedPrescriber(),
  ]);
  return { patientId: patient.id, prescriberId: prescriber.id };
}

/**
 * Open `n` pooled connections up front. Without this, the first transaction
 * in a race finishes on an idle connection while the rest are still
 * connecting, which accidentally serialises "concurrent" tests.
 */
export async function warmPool(n: number): Promise<void> {
  const clients = await Promise.all(
    Array.from({ length: n }, () => pool.connect()),
  );
  for (const client of clients) client.release();
}
