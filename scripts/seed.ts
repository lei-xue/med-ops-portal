import "dotenv/config";

import bcrypt from "bcryptjs";

import { db, pool } from "../src/db/index";
import {
  auditLogs,
  medications,
  medicationOrders,
  patients,
  prescribers,
  users,
  type DeaSchedule,
  type OrderStatus,
  type RxStatus,
  type UserRole,
} from "../src/db/schema";

/**
 * Idempotent seed for the MedOps Portal demo database.
 *
 * All users, medications, patients, prescribers and orders are fictional
 * demo data (NDCs, NPIs and MRNs included). Safe to run repeatedly: users,
 * products, patients and prescribers upsert by their unique keys, and
 * orders/audit rows are only inserted when the orders table is empty.
 */

const DEMO_PASSWORD = "demo1234!";

const DEMO_USERS: { name: string; email: string; role: UserRole }[] = [
  { name: "Ada Admin", email: "admin@demo.local", role: "admin" },
  { name: "Priya Pharmacist", email: "pharmacist@demo.local", role: "pharmacist" },
  { name: "Theo Technician", email: "tech@demo.local", role: "technician" },
];

interface ProductSeed {
  ndc: string;
  name: string;
  brandName: string | null;
  drugClass: string;
  strength: string;
  dosageForm: string;
  route: string;
  rxStatus: RxStatus;
  deaSchedule: DeaSchedule | null;
  stockUnit: string;
  stockQuantity: number;
  reorderThreshold: number;
}

// Compact row format: [ndc, strength, form, route, rx, schedule, unit, stock, reorder]
type ProductRow = [string, string, string, string, RxStatus, DeaSchedule | null, string, number, number];

function drug(
  name: string,
  brandName: string | null,
  drugClass: string,
  rows: ProductRow[],
): ProductSeed[] {
  return rows.map(([ndc, strength, dosageForm, route, rxStatus, deaSchedule, stockUnit, stockQuantity, reorderThreshold]) => ({
    ndc, name, brandName, drugClass, strength, dosageForm, route, rxStatus,
    deaSchedule, stockUnit, stockQuantity, reorderThreshold,
  }));
}

// NDCs 12345-6789-01…08 are the original catalog; keep their meaning stable.
const PRODUCTS: ProductSeed[] = [
  ...drug("Amoxicillin", "Amoxil", "Penicillin antibiotic", [
    ["12345-6789-09", "250 mg", "capsule", "oral", "rx", null, "capsules", 380, 100],
    ["12345-6789-01", "500 mg", "capsule", "oral", "rx", null, "capsules", 420, 100],
    ["12345-6789-10", "875 mg", "tablet", "oral", "rx", null, "tablets", 160, 60],
    ["12345-6789-11", "400 mg/5 mL", "oral suspension", "oral", "rx", null, "mL", 1800, 600],
  ]),
  ...drug("Azithromycin", "Zithromax", "Macrolide antibiotic", [
    ["12345-6789-12", "250 mg", "tablet", "oral", "rx", null, "tablets", 96, 60],
    ["12345-6789-13", "200 mg/5 mL", "oral suspension", "oral", "rx", null, "mL", 450, 300],
  ]),
  ...drug("Cephalexin", "Keflex", "Cephalosporin antibiotic", [
    ["12345-6789-14", "500 mg", "capsule", "oral", "rx", null, "capsules", 300, 80],
  ]),
  ...drug("Lisdexamfetamine", "Vyvanse", "CNS stimulant", [
    ["12345-6789-02", "30 mg", "capsule", "oral", "rx", "II", "capsules", 55, 60],
    ["12345-6789-15", "50 mg", "capsule", "oral", "rx", "II", "capsules", 70, 40],
  ]),
  ...drug("Methylphenidate ER", "Concerta", "CNS stimulant", [
    ["12345-6789-16", "36 mg", "extended-release tablet", "oral", "rx", "II", "tablets", 90, 45],
  ]),
  ...drug("Alprazolam", "Xanax", "Benzodiazepine", [
    ["12345-6789-17", "0.5 mg", "tablet", "oral", "rx", "IV", "tablets", 240, 100],
  ]),
  ...drug("Tramadol", "Ultram", "Opioid analgesic", [
    ["12345-6789-18", "50 mg", "tablet", "oral", "rx", "IV", "tablets", 180, 100],
  ]),
  ...drug("Gabapentin", "Neurontin", "Anticonvulsant", [
    ["12345-6789-19", "300 mg", "capsule", "oral", "rx", null, "capsules", 720, 200],
  ]),
  ...drug("Metformin", "Glucophage", "Biguanide antidiabetic", [
    ["12345-6789-20", "500 mg", "tablet", "oral", "rx", null, "tablets", 1200, 300],
    ["12345-6789-03", "1000 mg", "tablet", "oral", "rx", null, "tablets", 860, 150],
  ]),
  ...drug("Insulin glargine", "Lantus SoloStar", "Long-acting insulin", [
    ["12345-6789-21", "100 units/mL (3 mL)", "injection pen", "subcutaneous", "rx", null, "pens", 18, 25],
  ]),
  ...drug("Atorvastatin", "Lipitor", "Statin", [
    ["12345-6789-22", "10 mg", "tablet", "oral", "rx", null, "tablets", 540, 120],
    ["12345-6789-04", "20 mg", "tablet", "oral", "rx", null, "tablets", 640, 120],
    ["12345-6789-23", "40 mg", "tablet", "oral", "rx", null, "tablets", 410, 120],
  ]),
  ...drug("Lisinopril", "Zestril", "ACE inhibitor", [
    ["12345-6789-05", "10 mg", "tablet", "oral", "rx", null, "tablets", 45, 80],
    ["12345-6789-24", "20 mg", "tablet", "oral", "rx", null, "tablets", 380, 80],
  ]),
  ...drug("Amlodipine", "Norvasc", "Calcium channel blocker", [
    ["12345-6789-25", "5 mg", "tablet", "oral", "rx", null, "tablets", 620, 150],
  ]),
  ...drug("Levothyroxine", "Synthroid", "Thyroid hormone", [
    ["12345-6789-26", "50 mcg", "tablet", "oral", "rx", null, "tablets", 900, 200],
    ["12345-6789-27", "100 mcg", "tablet", "oral", "rx", null, "tablets", 700, 200],
  ]),
  ...drug("Sertraline", "Zoloft", "SSRI antidepressant", [
    ["12345-6789-28", "25 mg", "tablet", "oral", "rx", null, "tablets", 260, 70],
    ["12345-6789-08", "50 mg", "tablet", "oral", "rx", null, "tablets", 310, 70],
    ["12345-6789-29", "100 mg", "tablet", "oral", "rx", null, "tablets", 190, 70],
  ]),
  ...drug("Prednisone", null, "Corticosteroid", [
    ["12345-6789-30", "10 mg", "tablet", "oral", "rx", null, "tablets", 350, 100],
  ]),
  ...drug("Ondansetron", "Zofran ODT", "Antiemetic", [
    ["12345-6789-31", "4 mg", "orally disintegrating tablet", "oral", "rx", null, "tablets", 150, 60],
  ]),
  ...drug("Albuterol HFA", "ProAir HFA", "Bronchodilator", [
    ["12345-6789-06", "90 mcg/actuation", "inhaler", "inhalation", "rx", null, "inhalers", 34, 20],
  ]),
  ...drug("Omeprazole", "Prilosec", "Proton pump inhibitor", [
    ["12345-6789-07", "20 mg", "delayed-release capsule", "oral", "rx", null, "capsules", 500, 90],
    ["12345-6789-32", "20 mg", "delayed-release tablet", "oral", "otc", null, "tablets", 420, 84],
  ]),
  ...drug("Ibuprofen", "Advil", "NSAID", [
    ["12345-6789-33", "200 mg", "tablet", "oral", "otc", null, "tablets", 1500, 300],
    ["12345-6789-34", "800 mg", "tablet", "oral", "rx", null, "tablets", 240, 90],
  ]),
  ...drug("Acetaminophen", "Tylenol", "Analgesic / antipyretic", [
    ["12345-6789-35", "500 mg", "tablet", "oral", "otc", null, "tablets", 1300, 300],
    ["12345-6789-36", "160 mg/5 mL", "oral suspension", "oral", "otc", null, "mL", 950, 480],
  ]),
  ...drug("Loratadine", "Claritin", "Antihistamine", [
    ["12345-6789-37", "10 mg", "tablet", "oral", "otc", null, "tablets", 600, 150],
  ]),
  ...drug("Cetirizine", "Zyrtec", "Antihistamine", [
    ["12345-6789-38", "10 mg", "tablet", "oral", "otc", null, "tablets", 75, 120],
  ]),
  ...drug("Fluticasone", "Flonase", "Nasal corticosteroid", [
    ["12345-6789-39", "50 mcg/spray", "nasal spray", "nasal", "otc", null, "bottles", 40, 15],
  ]),
  ...drug("Naloxone", "Narcan", "Opioid antagonist", [
    ["12345-6789-40", "4 mg", "nasal spray", "nasal", "otc", null, "packs", 12, 10],
  ]),
  ...drug("Hydrocortisone", "Cortizone-10", "Topical corticosteroid", [
    ["12345-6789-41", "1%", "cream", "topical", "otc", null, "tubes", 48, 20],
  ]),
  ...drug("Mupirocin", "Bactroban", "Topical antibiotic", [
    ["12345-6789-42", "2%", "ointment", "topical", "rx", null, "tubes", 22, 15],
  ]),
];

const PATIENTS = [
  { mrn: "MRN-100001", name: "Riley Sample", dateOfBirth: "1984-03-12", allergies: "Sulfa drugs (rash)", phone: "555-0101" },
  { mrn: "MRN-100002", name: "Jordan Placeholder", dateOfBirth: "1961-11-02", allergies: null, phone: "555-0102" },
  { mrn: "MRN-100003", name: "Casey Lorem", dateOfBirth: "1992-07-28", allergies: "Penicillin (hives)", phone: "555-0103" },
  { mrn: "MRN-100004", name: "Avery Example", dateOfBirth: "1957-01-19", allergies: null, phone: "555-0104" },
  { mrn: "MRN-100005", name: "Morgan Dummy", dateOfBirth: "1978-09-05", allergies: "Codeine (nausea)", phone: "555-0105" },
  { mrn: "MRN-100006", name: "Jamie Template", dateOfBirth: "2009-04-16", allergies: null, phone: "555-0106" },
  { mrn: "MRN-100007", name: "Taylor Mockwell", dateOfBirth: "2001-12-30", allergies: null, phone: "555-0107" },
  { mrn: "MRN-100008", name: "Quinn Fixture", dateOfBirth: "2019-06-08", allergies: "Peanuts", phone: "555-0108" },
  { mrn: "MRN-100009", name: "Harper Stub", dateOfBirth: "1988-02-14", allergies: null, phone: "555-0109" },
  { mrn: "MRN-100010", name: "Rowan Testa", dateOfBirth: "1969-10-21", allergies: "Latex", phone: "555-0110" },
  { mrn: "MRN-100011", name: "Emerson Draft", dateOfBirth: "1995-05-03", allergies: null, phone: "555-0111" },
  { mrn: "MRN-100012", name: "Sasha Proto", dateOfBirth: "1949-08-27", allergies: "ACE inhibitors (cough)", phone: "555-0112" },
];

// NPIs starting 1999… are deliberately outside any real allocation.
const PRESCRIBERS = [
  { npi: "1999000101", name: "Elena Vasquez", credentials: "MD", specialty: "Family Medicine", practice: "Riverbend Family Clinic" },
  { npi: "1999000102", name: "Marcus Chen", credentials: "DO", specialty: "Internal Medicine", practice: "Harborview Internal Medicine" },
  { npi: "1999000103", name: "Priyanka Rao", credentials: "NP", specialty: "Pediatrics", practice: "Little Oaks Pediatrics" },
  { npi: "1999000104", name: "Samuel Okafor", credentials: "MD", specialty: "Psychiatry", practice: "Northside Behavioral Health" },
  { npi: "1999000105", name: "Hannah Lindqvist", credentials: "MD", specialty: "Cardiology", practice: "Summit Heart Center" },
  { npi: "1999000106", name: "Jordan Ellis", credentials: "PA-C", specialty: "Urgent Care", practice: "QuickCare Urgent Care" },
];

type Step = "create" | "verify" | "fill" | "complete" | "cancel";

interface OrderSeed {
  mrn: string;
  ndc: string;
  npi: string | null;
  quantity: number;
  directions: string;
  refills: number;
  daysSupply: number | null;
  status: OrderStatus;
  notes?: string;
  /** When the order was entered, relative to now. */
  hoursAgo: number;
}

const ORDERS: OrderSeed[] = [
  { mrn: "MRN-100001", ndc: "12345-6789-01", npi: "1999000101", quantity: 21, directions: "Take 1 capsule by mouth three times daily for 7 days", refills: 0, daysSupply: 7, status: "completed", hoursAgo: 52 },
  { mrn: "MRN-100002", ndc: "12345-6789-03", npi: "1999000102", quantity: 60, directions: "Take 1 tablet by mouth twice daily with meals", refills: 5, daysSupply: 30, status: "filled", notes: "Synced with other maintenance meds", hoursAgo: 6 },
  { mrn: "MRN-100003", ndc: "12345-6789-08", npi: "1999000104", quantity: 30, directions: "Take 1 tablet by mouth once daily", refills: 5, daysSupply: 30, status: "verified", hoursAgo: 4 },
  { mrn: "MRN-100004", ndc: "12345-6789-04", npi: "1999000105", quantity: 90, directions: "Take 1 tablet by mouth at bedtime", refills: 3, daysSupply: 90, status: "pending", hoursAgo: 2 },
  { mrn: "MRN-100005", ndc: "12345-6789-07", npi: "1999000101", quantity: 14, directions: "Take 1 capsule by mouth daily 30 minutes before breakfast", refills: 0, daysSupply: 14, status: "pending", notes: "Will call before pickup", hoursAgo: 1.5 },
  { mrn: "MRN-100006", ndc: "12345-6789-06", npi: "1999000103", quantity: 1, directions: "Inhale 2 puffs by mouth every 4 to 6 hours as needed for wheezing", refills: 1, daysSupply: 25, status: "cancelled", notes: "Duplicate of in-store request", hoursAgo: 28 },
  { mrn: "MRN-100007", ndc: "12345-6789-02", npi: "1999000104", quantity: 30, directions: "Take 1 capsule by mouth every morning", refills: 0, daysSupply: 30, status: "pending", notes: "Check PDMP before verifying", hoursAgo: 1 },
  { mrn: "MRN-100008", ndc: "12345-6789-11", npi: "1999000103", quantity: 100, directions: "Give 5 mL by mouth twice daily for 10 days; shake well", refills: 0, daysSupply: 10, status: "verified", hoursAgo: 3 },
  { mrn: "MRN-100009", ndc: "12345-6789-37", npi: null, quantity: 30, directions: "Take 1 tablet by mouth once daily as needed for allergies", refills: 0, daysSupply: 30, status: "completed", hoursAgo: 5 },
  { mrn: "MRN-100010", ndc: "12345-6789-21", npi: "1999000102", quantity: 5, directions: "Inject 20 units under the skin once daily at bedtime", refills: 2, daysSupply: 30, status: "filled", notes: "Keep refrigerated until pickup", hoursAgo: 7 },
  { mrn: "MRN-100011", ndc: "12345-6789-17", npi: "1999000104", quantity: 30, directions: "Take 1 tablet by mouth twice daily as needed for anxiety", refills: 2, daysSupply: 15, status: "pending", hoursAgo: 0.5 },
  { mrn: "MRN-100012", ndc: "12345-6789-24", npi: "1999000105", quantity: 30, directions: "Take 1 tablet by mouth once daily", refills: 11, daysSupply: 30, status: "completed", hoursAgo: 75 },
  { mrn: "MRN-100001", ndc: "12345-6789-33", npi: null, quantity: 24, directions: "Take 1 to 2 tablets by mouth every 4 to 6 hours as needed for pain", refills: 0, daysSupply: null, status: "completed", hoursAgo: 3.5 },
  { mrn: "MRN-100004", ndc: "12345-6789-25", npi: "1999000105", quantity: 30, directions: "Take 1 tablet by mouth once daily", refills: 5, daysSupply: 30, status: "verified", hoursAgo: 2.5 },
  { mrn: "MRN-100003", ndc: "12345-6789-40", npi: null, quantity: 1, directions: "Spray into one nostril for suspected opioid overdose; call 911; may repeat in 2 to 3 minutes", refills: 0, daysSupply: null, status: "pending", hoursAgo: 0.75 },
  { mrn: "MRN-100007", ndc: "12345-6789-18", npi: "1999000106", quantity: 20, directions: "Take 1 tablet by mouth every 6 hours as needed for pain", refills: 0, daysSupply: 5, status: "filled", hoursAgo: 8 },
  { mrn: "MRN-100008", ndc: "12345-6789-36", npi: "1999000103", quantity: 120, directions: "Give 7.5 mL by mouth every 6 hours as needed for fever", refills: 0, daysSupply: 5, status: "completed", hoursAgo: 30 },
  { mrn: "MRN-100002", ndc: "12345-6789-26", npi: "1999000102", quantity: 90, directions: "Take 1 tablet by mouth every morning on an empty stomach", refills: 3, daysSupply: 90, status: "completed", hoursAgo: 4.5 },
  { mrn: "MRN-100005", ndc: "12345-6789-31", npi: "1999000106", quantity: 12, directions: "Dissolve 1 tablet on the tongue every 8 hours as needed for nausea", refills: 0, daysSupply: 4, status: "verified", hoursAgo: 1.25 },
  { mrn: "MRN-100009", ndc: "12345-6789-41", npi: null, quantity: 1, directions: "Apply a thin layer to affected area up to 3 times daily", refills: 0, daysSupply: null, status: "pending", hoursAgo: 0.25 },
];

const STEPS_FOR: Record<OrderStatus, Step[]> = {
  pending: ["create"],
  verified: ["create", "verify"],
  filled: ["create", "verify", "fill"],
  completed: ["create", "verify", "fill", "complete"],
  cancelled: ["create", "cancel"],
};

const STEP_TARGET: Record<Exclude<Step, "create">, OrderStatus> = {
  verify: "verified",
  fill: "filled",
  complete: "completed",
  cancel: "cancelled",
};

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
  const userByEmail = new Map(
    (await db.select().from(users)).map((u) => [u.email, u]),
  );
  const pharmacist = userByEmail.get("pharmacist@demo.local");
  const technician = userByEmail.get("tech@demo.local");
  if (!pharmacist || !technician) {
    throw new Error("Demo users missing after upsert — check seed data");
  }

  // --- Catalog: refresh descriptive fields, never overwrite live stock --------
  for (const product of PRODUCTS) {
    const { stockQuantity, ...descriptive } = product;
    await db
      .insert(medications)
      .values(product)
      .onConflictDoUpdate({ target: medications.ndc, set: descriptive });
    void stockQuantity;
  }

  for (const patient of PATIENTS) {
    await db
      .insert(patients)
      .values(patient)
      .onConflictDoUpdate({ target: patients.mrn, set: patient });
  }
  for (const prescriber of PRESCRIBERS) {
    await db
      .insert(prescribers)
      .values(prescriber)
      .onConflictDoUpdate({ target: prescribers.npi, set: prescriber });
  }

  const medByNdc = new Map((await db.select().from(medications)).map((m) => [m.ndc, m]));
  const patientByMrn = new Map((await db.select().from(patients)).map((p) => [p.mrn, p]));
  const prescriberByNpi = new Map((await db.select().from(prescribers)).map((p) => [p.npi, p]));
  console.log(
    `Catalog: ${medByNdc.size} products, ${patientByMrn.size} patients, ${prescriberByNpi.size} prescribers.`,
  );

  // --- Orders + audit trail (only into an empty orders table) ----------------
  const [existing] = await db.select({ id: medicationOrders.id }).from(medicationOrders).limit(1);
  if (existing) {
    console.log("Orders already present — skipping order/audit seed.");
  } else {
    const actorFor: Record<Step, typeof technician> = {
      create: technician,
      verify: pharmacist,
      fill: technician,
      complete: pharmacist,
      cancel: pharmacist,
    };

    await db.transaction(async (tx) => {
      for (const spec of ORDERS) {
        const medication = medByNdc.get(spec.ndc);
        const patient = patientByMrn.get(spec.mrn);
        const prescriber = spec.npi ? prescriberByNpi.get(spec.npi) : undefined;
        if (!medication || !patient || (spec.npi && !prescriber)) {
          throw new Error(`Seed order references unknown data: ${JSON.stringify(spec)}`);
        }

        const start = Date.now() - spec.hoursAgo * 3_600_000;
        // Each later step happens a little after the previous one.
        const at = (stepIndex: number) =>
          new Date(start + stepIndex * Math.min(20, (spec.hoursAgo * 60) / 5) * 60_000);
        const steps = STEPS_FOR[spec.status];

        const [order] = await tx
          .insert(medicationOrders)
          .values({
            patientId: patient.id,
            prescriberId: prescriber?.id ?? null,
            medicationId: medication.id,
            quantity: spec.quantity,
            directions: spec.directions,
            refills: spec.refills,
            daysSupply: spec.daysSupply,
            notes: spec.notes ?? null,
            status: spec.status,
            createdById: technician.id,
            verifiedById: steps.includes("verify") ? pharmacist.id : null,
            filledById: steps.includes("fill") ? technician.id : null,
            createdAt: at(0),
            updatedAt: at(steps.length - 1),
          })
          .returning();

        let from: OrderStatus = "pending";
        for (const [index, step] of steps.entries()) {
          const createdAt = at(index);
          if (step === "create") {
            await tx.insert(auditLogs).values({
              actorId: actorFor.create.id,
              action: "order.create",
              entityType: "medication_order",
              entityId: order.id,
              createdAt,
              details: {
                patientId: patient.id,
                patientName: patient.name,
                prescriberId: prescriber?.id ?? null,
                prescriberName: prescriber?.name ?? null,
                medicationId: medication.id,
                medicationName: medication.name,
                quantity: spec.quantity,
                refills: spec.refills,
                status: "pending",
              },
            });
            continue;
          }
          const to = STEP_TARGET[step];
          await tx.insert(auditLogs).values({
            actorId: actorFor[step].id,
            action: `order.${step}`,
            entityType: "medication_order",
            entityId: order.id,
            createdAt,
            details: { from, to, quantity: spec.quantity },
          });
          from = to;
        }
      }
    });
    console.log(`Seeded ${ORDERS.length} demo orders with audit history.`);
  }

  console.log("Seed complete.");
  console.log("  admin@demo.local / pharmacist@demo.local / tech@demo.local");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
