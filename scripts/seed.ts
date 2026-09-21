import "dotenv/config";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { db, pool } from "../src/db/index";
import {
  auditLogs,
  medications,
  medicationOrders,
  users,
  type UserRole,
} from "../src/db/schema";

/**
 * Idempotent seed for the MedOps Portal demo database.
 *
 * All users, medications, patients and orders are fictional demo data.
 * Safe to run multiple times: users/medications upsert by unique key and
 * orders/audit rows are only inserted when the tables are empty.
 */

const DEMO_PASSWORD = "demo1234!";

const DEMO_USERS: { name: string; email: string; role: UserRole }[] = [
  { name: "Ada Admin", email: "admin@demo.local", role: "admin" },
  { name: "Priya Pharmacist", email: "pharmacist@demo.local", role: "pharmacist" },
  { name: "Theo Technician", email: "tech@demo.local", role: "technician" },
];

const DEMO_MEDICATIONS = [
  // name, ndc (fictional), strength, dosage form, stock, reorder threshold
  { name: "Amoxicillin", ndc: "12345-6789-01", strength: "500 mg", dosageForm: "capsule", stockQuantity: 420, reorderThreshold: 100 },
  { name: "Lisdexamfetamine", ndc: "12345-6789-02", strength: "30 mg", dosageForm: "capsule", stockQuantity: 55, reorderThreshold: 60 },
  { name: "Metformin", ndc: "12345-6789-03", strength: "1000 mg", dosageForm: "tablet", stockQuantity: 860, reorderThreshold: 150 },
  { name: "Atorvastatin", ndc: "12345-6789-04", strength: "20 mg", dosageForm: "tablet", stockQuantity: 640, reorderThreshold: 120 },
  { name: "Lisinopril", ndc: "12345-6789-05", strength: "10 mg", dosageForm: "tablet", stockQuantity: 45, reorderThreshold: 80 },
  { name: "Albuterol HFA", ndc: "12345-6789-06", strength: "90 mcg/actuation", dosageForm: "inhaler", stockQuantity: 34, reorderThreshold: 20 },
  { name: "Omeprazole", ndc: "12345-6789-07", strength: "20 mg", dosageForm: "capsule", stockQuantity: 500, reorderThreshold: 90 },
  { name: "Sertraline", ndc: "12345-6789-08", strength: "50 mg", dosageForm: "tablet", stockQuantity: 310, reorderThreshold: 70 },
];

async function main() {
  console.log("Seeding MedOps demo data (idempotent)…");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // --- Users ---------------------------------------------------------------
  for (const user of DEMO_USERS) {
    await db
      .insert(users)
      .values({ ...user, passwordHash })
      .onConflictDoNothing({ target: users.email });
  }
  const userRows = await db.select().from(users);
  const userByEmail = new Map(userRows.map((u) => [u.email, u]));

  const admin = userByEmail.get("admin@demo.local");
  const pharmacist = userByEmail.get("pharmacist@demo.local");
  const technician = userByEmail.get("tech@demo.local");
  if (!admin || !pharmacist || !technician) {
    throw new Error("Demo users missing after upsert — check seed data");
  }

  // --- Medications ----------------------------------------------------------
  for (const med of DEMO_MEDICATIONS) {
    await db
      .insert(medications)
      .values(med)
      .onConflictDoNothing({ target: medications.ndc });
  }
  const medRows = await db.select().from(medications);
  const medByName = new Map(medRows.map((m) => [m.name, m]));

  const med = (name: string) => {
    const row = medByName.get(name);
    if (!row) throw new Error(`Medication "${name}" missing after upsert`);
    return row;
  };

  // --- Orders + audit -------------------------------------------------------
  const existingOrders = await db
    .select({ id: medicationOrders.id })
    .from(medicationOrders)
    .limit(1);

  if (existingOrders.length > 0) {
    console.log("Orders already present — skipping order/audit seed.");
  } else {
    await db.transaction(async (tx) => {
      interface OrderSpec {
        patientName: string;
        medicationId: number;
        quantity: number;
        status: "pending" | "verified" | "filled" | "completed" | "cancelled";
        notes: string | null;
        chain: ("create" | "verify" | "fill" | "complete" | "cancel")[];
      }

      const specs: OrderSpec[] = [
        {
          patientName: "Riley Sample",
          medicationId: med("Amoxicillin").id,
          quantity: 21,
          status: "completed",
          notes: null,
          chain: ["create", "verify", "fill", "complete"],
        },
        {
          patientName: "Jordan Placeholder",
          medicationId: med("Metformin").id,
          quantity: 60,
          status: "filled",
          notes: "90-day sync fill",
          chain: ["create", "verify", "fill"],
        },
        {
          patientName: "Casey Lorem",
          medicationId: med("Sertraline").id,
          quantity: 30,
          status: "verified",
          notes: null,
          chain: ["create", "verify"],
        },
        {
          patientName: "Avery Example",
          medicationId: med("Atorvastatin").id,
          quantity: 90,
          status: "pending",
          notes: null,
          chain: ["create"],
        },
        {
          patientName: "Morgan Dummy",
          medicationId: med("Omeprazole").id,
          quantity: 14,
          status: "pending",
          notes: "Will call before pickup",
          chain: ["create"],
        },
        {
          patientName: "Jamie Template",
          medicationId: med("Albuterol HFA").id,
          quantity: 1,
          status: "cancelled",
          notes: "Duplicate of in-store request",
          chain: ["create", "cancel"],
        },
      ];

      const actorFor = {
        create: technician,
        verify: pharmacist,
        fill: technician,
        complete: pharmacist,
        cancel: pharmacist,
      } as const;

      for (const spec of specs) {
        const [order] = await tx
          .insert(medicationOrders)
          .values({
            patientName: spec.patientName,
            medicationId: spec.medicationId,
            quantity: spec.quantity,
            status: "pending",
            notes: spec.notes,
            createdById: technician.id,
          })
          .returning();

        let verifiedBy: number | null = null;
        let filledBy: number | null = null;

        for (const step of spec.chain) {
          const actor = actorFor[step];
          if (step === "create") {
            await tx.insert(auditLogs).values({
              actorId: actor.id,
              action: "order.create",
              entityType: "medication_order",
              entityId: order.id,
              details: {
                patientName: spec.patientName,
                medicationId: spec.medicationId,
                quantity: spec.quantity,
                status: "pending",
              },
            });
            continue;
          }

          if (step === "verify") verifiedBy = actor.id;
          if (step === "fill") filledBy = actor.id;

          const to =
            step === "verify"
              ? "verified"
              : step === "fill"
                ? "filled"
                : step === "complete"
                  ? "completed"
                  : "cancelled";
          const from =
            step === "verify" || step === "cancel"
              ? "pending"
              : step === "fill"
                ? "verified"
                : "filled";

          await tx
            .update(medicationOrders)
            .set({
              status: to,
              verifiedById: verifiedBy,
              filledById: filledBy,
              updatedAt: new Date(),
            })
            .where(eq(medicationOrders.id, order.id));

          await tx.insert(auditLogs).values({
            actorId: actor.id,
            action: `order.${step}`,
            entityType: "medication_order",
            entityId: order.id,
            details: { from, to, quantity: spec.quantity },
          });
        }
      }
    });
    console.log(`Seeded ${6} demo orders with audit history.`);
  }

  console.log("Seed complete.");
  console.log("  admin@demo.local / pharmacist@demo.local / tech@demo.local");
  console.log(`  password for all: ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
