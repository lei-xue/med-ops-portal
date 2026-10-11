import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { db } from "@/db";
import { auditLogs, medications, medicationOrders } from "@/db/schema";
import {
  adjustStock,
  cancelOrder,
  completeOrder,
  createOrder,
  fillOrder,
  OrderServiceError,
  verifyOrder,
} from "@/lib/orderService";
import { canTransition, isLowStock, roleCan } from "@/lib/permissions";
import {
  closeDb,
  resetDatabase,
  seedMedication,
  seedParties,
  seedPatient,
  seedUser,
  warmPool,
} from "./helpers";

beforeEach(async () => {
  await resetDatabase();
});

afterEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDb();
});

describe("order state machine (pure)", () => {
  it("allows the happy path", () => {
    expect(canTransition("pending", "verified")).toBe(true);
    expect(canTransition("verified", "filled")).toBe(true);
    expect(canTransition("filled", "completed")).toBe(true);
  });

  it("allows cancellation from pending and verified only", () => {
    expect(canTransition("pending", "cancelled")).toBe(true);
    expect(canTransition("verified", "cancelled")).toBe(true);
    expect(canTransition("filled", "cancelled")).toBe(false);
    expect(canTransition("completed", "cancelled")).toBe(false);
  });

  it("rejects skipping steps", () => {
    expect(canTransition("pending", "filled")).toBe(false);
    expect(canTransition("pending", "completed")).toBe(false);
    expect(canTransition("verified", "completed")).toBe(false);
  });

  it("treats completed and cancelled as terminal", () => {
    expect(canTransition("completed", "pending")).toBe(false);
    expect(canTransition("completed", "cancelled")).toBe(false);
    expect(canTransition("cancelled", "verified")).toBe(false);
    expect(canTransition("cancelled", "filled")).toBe(false);
  });
});

describe("role permission matrix (pure)", () => {
  it("technicians create and fill only", () => {
    expect(roleCan("technician", "create")).toBe(true);
    expect(roleCan("technician", "fill")).toBe(true);
    expect(roleCan("technician", "verify")).toBe(false);
    expect(roleCan("technician", "cancel")).toBe(false);
    expect(roleCan("technician", "complete")).toBe(false);
    expect(roleCan("technician", "inventory.adjust")).toBe(false);
  });

  it("pharmacists add verify, cancel and complete", () => {
    expect(roleCan("pharmacist", "verify")).toBe(true);
    expect(roleCan("pharmacist", "cancel")).toBe(true);
    expect(roleCan("pharmacist", "complete")).toBe(true);
    expect(roleCan("pharmacist", "inventory.adjust")).toBe(false);
  });

  it("admins can do everything including inventory.adjust", () => {
    for (const action of [
      "create",
      "fill",
      "verify",
      "cancel",
      "complete",
      "inventory.adjust",
    ] as const) {
      expect(roleCan("admin", action)).toBe(true);
    }
  });
});

describe("orderService lifecycle", () => {
  it("creates a pending order and audits it", async () => {
    const tech = await seedUser("technician");
    const med = await seedMedication(50, 10);

    const order = await createOrder(db, tech, {
      ...(await seedParties("Riley Sample")),
      medicationId: med.id,
      quantity: 3,
      notes: "unit test",
    });

    expect(order.status).toBe("pending");
    expect(order.createdById).toBe(tech.id);

    const [audit] = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, order.id));
    expect(audit.action).toBe("order.create");
    expect(audit.actorId).toBe(tech.id);
  });

  it("verifies pending orders as a pharmacist and stamps the verifier", async () => {
    const tech = await seedUser("technician");
    const pharm = await seedUser("pharmacist");
    const med = await seedMedication();

    const order = await createOrder(db, tech, {
      ...(await seedParties("Casey Lorem")),
      medicationId: med.id,
      quantity: 2,
    });
    const verified = await verifyOrder(db, pharm, order.id);

    expect(verified.status).toBe("verified");
    expect(verified.verifiedById).toBe(pharm.id);
  });

  it("rejects filling before verification with INVALID_TRANSITION", async () => {
    const tech = await seedUser("technician");
    const med = await seedMedication();

    const order = await createOrder(db, tech, {
      ...(await seedParties("Avery Example")),
      medicationId: med.id,
      quantity: 1,
    });

    await expect(fillOrder(db, tech, order.id)).rejects.toMatchObject({
      name: "OrderServiceError",
      code: "INVALID_TRANSITION",
    });
  });

  it("rejects double verification with INVALID_TRANSITION", async () => {
    const tech = await seedUser("technician");
    const pharm = await seedUser("pharmacist");
    const med = await seedMedication();

    const order = await createOrder(db, tech, {
      ...(await seedParties("Jamie Template")),
      medicationId: med.id,
      quantity: 1,
    });
    await verifyOrder(db, pharm, order.id);

    await expect(verifyOrder(db, pharm, order.id)).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
  });

  it("completes a filled order", async () => {
    const tech = await seedUser("technician");
    const pharm = await seedUser("pharmacist");
    const med = await seedMedication();

    const order = await createOrder(db, tech, {
      ...(await seedParties("Jordan Placeholder")),
      medicationId: med.id,
      quantity: 1,
    });
    await verifyOrder(db, pharm, order.id);
    await fillOrder(db, tech, order.id);
    const completed = await completeOrder(db, pharm, order.id);

    expect(completed.status).toBe("completed");
  });

  it("cancels a pending order as a pharmacist", async () => {
    const tech = await seedUser("technician");
    const pharm = await seedUser("pharmacist");
    const med = await seedMedication();

    const order = await createOrder(db, tech, {
      ...(await seedParties("Morgan Dummy")),
      medicationId: med.id,
      quantity: 1,
    });
    const cancelled = await cancelOrder(db, pharm, order.id);

    expect(cancelled.status).toBe("cancelled");
  });

  it("rejects cancelling a filled order", async () => {
    const tech = await seedUser("technician");
    const pharm = await seedUser("pharmacist");
    const med = await seedMedication();

    const order = await createOrder(db, tech, {
      ...(await seedParties("Sam Fictional")),
      medicationId: med.id,
      quantity: 1,
    });
    await verifyOrder(db, pharm, order.id);
    await fillOrder(db, tech, order.id);

    await expect(cancelOrder(db, pharm, order.id)).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });
  });
});

describe("orderService role enforcement (server-side)", () => {
  it("technician cannot verify → FORBIDDEN", async () => {
    const tech = await seedUser("technician");
    const med = await seedMedication();

    const order = await createOrder(db, tech, {
      ...(await seedParties("A")),
      medicationId: med.id,
      quantity: 1,
    });

    await expect(verifyOrder(db, tech, order.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("technician cannot cancel → FORBIDDEN", async () => {
    const tech = await seedUser("technician");
    const med = await seedMedication();

    const order = await createOrder(db, tech, {
      ...(await seedParties("B")),
      medicationId: med.id,
      quantity: 1,
    });

    await expect(cancelOrder(db, tech, order.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("pharmacist cannot adjust stock → FORBIDDEN", async () => {
    const pharm = await seedUser("pharmacist");
    const med = await seedMedication();

    await expect(
      adjustStock(db, pharm, { medicationId: med.id, quantity: 500 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("fill transaction behavior", () => {
  it("decrements stock atomically and writes the audit row", async () => {
    const tech = await seedUser("technician");
    const pharm = await seedUser("pharmacist");
    const med = await seedMedication(10, 2);

    const order = await createOrder(db, tech, {
      ...(await seedParties("Stocky McStockface")),
      medicationId: med.id,
      quantity: 4,
    });
    await verifyOrder(db, pharm, order.id);
    const filled = await fillOrder(db, tech, order.id);

    expect(filled.status).toBe("filled");
    expect(filled.filledById).toBe(tech.id);

    const [medAfter] = await db
      .select()
      .from(medications)
      .where(eq(medications.id, med.id));
    expect(medAfter.stockQuantity).toBe(6);

    const audits = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, order.id));
    const fillAudit = audits.find((a) => a.action === "order.fill");
    expect(fillAudit).toBeDefined();
    expect(fillAudit!.details).toMatchObject({
      from: "verified",
      to: "filled",
      quantity: 4,
      stockBefore: 10,
      stockAfter: 6,
    });
  });

  it("rolls back completely on insufficient stock (no partial write)", async () => {
    const tech = await seedUser("technician");
    const pharm = await seedUser("pharmacist");
    const med = await seedMedication(3, 1);

    const order = await createOrder(db, tech, {
      ...(await seedParties("Greedy Grabber")),
      medicationId: med.id,
      quantity: 5,
    });
    await verifyOrder(db, pharm, order.id);

    const err = await fillOrder(db, tech, order.id).catch((e) => e);
    expect(err).toBeInstanceOf(OrderServiceError);
    expect(err.code).toBe("INSUFFICIENT_STOCK");

    // Nothing changed: stock intact, order still verified, no fill audit row.
    const [medAfter] = await db
      .select()
      .from(medications)
      .where(eq(medications.id, med.id));
    expect(medAfter.stockQuantity).toBe(3);

    const [orderAfter] = await db
      .select()
      .from(medicationOrders)
      .where(eq(medicationOrders.id, order.id));
    expect(orderAfter.status).toBe("verified");
    expect(orderAfter.filledById).toBeNull();

    const fillAudits = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "order.fill"));
    expect(fillAudits).toHaveLength(0);
  });

  it("flags low stock when a fill drops stock to the threshold", async () => {
    const tech = await seedUser("technician");
    const pharm = await seedUser("pharmacist");
    const med = await seedMedication(10, 6);

    expect(isLowStock(med)).toBe(false);

    const order = await createOrder(db, tech, {
      ...(await seedParties("Threshold Tester")),
      medicationId: med.id,
      quantity: 4,
    });
    await verifyOrder(db, pharm, order.id);
    await fillOrder(db, tech, order.id);

    const [medAfter] = await db
      .select()
      .from(medications)
      .where(eq(medications.id, med.id));
    expect(medAfter.stockQuantity).toBe(6);
    expect(isLowStock(medAfter)).toBe(true);
  });
});

describe("inventory adjust", () => {
  it("admin sets stock and writes the audit row with from/to", async () => {
    const admin = await seedUser("admin");
    const med = await seedMedication(10, 5);

    const updated = await adjustStock(db, admin, {
      medicationId: med.id,
      quantity: 42,
      reason: "cycle count",
    });

    expect(updated.stockQuantity).toBe(42);

    const audits = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, med.id));
    const adjustAudit = audits.find((a) => a.action === "inventory.adjust");
    expect(adjustAudit).toBeDefined();
    expect(adjustAudit!.details).toMatchObject({
      from: 10,
      to: 42,
      reason: "cycle count",
    });
  });

  it("rejects negative quantities with INVALID_INPUT", async () => {
    const admin = await seedUser("admin");
    const med = await seedMedication();

    await expect(
      adjustStock(db, admin, { medicationId: med.id, quantity: -1 }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejects unknown medications with NOT_FOUND", async () => {
    const admin = await seedUser("admin");

    await expect(
      adjustStock(db, admin, { medicationId: 99999, quantity: 5 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("createOrder validation", () => {
  it("rejects unknown patients with NOT_FOUND", async () => {
    const tech = await seedUser("technician");
    const med = await seedMedication();
    const { prescriberId } = await seedParties();

    await expect(
      createOrder(db, tech, {
        patientId: 99999,
        prescriberId,
        medicationId: med.id,
        quantity: 1,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects non-positive quantities", async () => {
    const tech = await seedUser("technician");
    const med = await seedMedication();

    await expect(
      createOrder(db, tech, {
        ...(await seedParties("A")),
        medicationId: med.id,
        quantity: 0,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejects unknown medications with NOT_FOUND", async () => {
    const tech = await seedUser("technician");

    await expect(
      createOrder(db, tech, {
        ...(await seedParties("A")),
        medicationId: 99999,
        quantity: 1,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("concurrency (row locks)", () => {
  it("simultaneous fills competing for the same stock cannot oversell it", async () => {
    const tech = await seedUser("technician");
    const pharm = await seedUser("pharmacist");
    const med = await seedMedication(5, 1);

    // Eight contenders for stock that covers one: enough overlap that a
    // missing lock reliably shows up as negative stock.
    const orders = [];
    for (let i = 0; i < 8; i += 1) {
      const parties = await seedParties(`Race ${i}`);
      const order = await createOrder(db, tech, {
        ...parties,
        medicationId: med.id,
        quantity: 5,
      });
      await verifyOrder(db, pharm, order.id);
      orders.push(order);
    }

    await warmPool(orders.length);
    const results = await Promise.allSettled(
      orders.map((order) => fillOrder(db, tech, order.id)),
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(7);
    for (const r of rejected) {
      expect(r.reason).toMatchObject({ code: "INSUFFICIENT_STOCK" });
    }

    const [medAfter] = await db
      .select()
      .from(medications)
      .where(eq(medications.id, med.id));
    expect(medAfter.stockQuantity).toBe(0);

    const fillAudits = (await db.select().from(auditLogs)).filter(
      (a) => a.action === "order.fill",
    );
    expect(fillAudits).toHaveLength(1);
  });

  it("the same order filled twice at once is filled exactly once", async () => {
    const tech = await seedUser("technician");
    const pharm = await seedUser("pharmacist");
    const med = await seedMedication(50, 1);
    const order = await createOrder(db, tech, {
      ...(await seedParties("Double Click")),
      medicationId: med.id,
      quantity: 10,
    });
    await verifyOrder(db, pharm, order.id);

    await warmPool(2);
    const results = await Promise.allSettled([
      fillOrder(db, tech, order.id),
      fillOrder(db, tech, order.id),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      (results.find((r) => r.status === "rejected") as PromiseRejectedResult)
        .reason,
    ).toMatchObject({ code: "INVALID_TRANSITION" });

    const [medAfter] = await db
      .select()
      .from(medications)
      .where(eq(medications.id, med.id));
    expect(medAfter.stockQuantity).toBe(40);
  });

  it("verify racing cancel on one order: exactly one wins", async () => {
    const tech = await seedUser("technician");
    const pharm = await seedUser("pharmacist");
    const admin = await seedUser("admin");
    const med = await seedMedication();
    const order = await createOrder(db, tech, {
      ...(await seedParties("Contested")),
      medicationId: med.id,
      quantity: 1,
    });

    await warmPool(2);
    const [verify, cancel] = await Promise.allSettled([
      verifyOrder(db, pharm, order.id),
      cancelOrder(db, admin, order.id),
    ]);

    // Cancel is legal from both pending and verified, so it always succeeds;
    // verify succeeds only if it took the lock first.
    expect(cancel.status).toBe("fulfilled");
    const [final] = await db
      .select()
      .from(medicationOrders)
      .where(eq(medicationOrders.id, order.id));
    expect(final.status).toBe("cancelled");
    if (verify.status === "rejected") {
      expect(verify.reason).toMatchObject({ code: "INVALID_TRANSITION" });
    }
  });
});

describe("inventory adjust (optimistic concurrency)", () => {
  it("refuses an edit based on a stale stock level with STALE_STOCK", async () => {
    const admin = await seedUser("admin");
    const med = await seedMedication(100, 10);

    await adjustStock(db, admin, { medicationId: med.id, quantity: 94 });

    await expect(
      adjustStock(db, admin, {
        medicationId: med.id,
        quantity: 100,
        expectedQuantity: 100,
      }),
    ).rejects.toMatchObject({ code: "STALE_STOCK" });

    const [medAfter] = await db
      .select()
      .from(medications)
      .where(eq(medications.id, med.id));
    expect(medAfter.stockQuantity).toBe(94);
  });

  it("applies the edit when the expected level still matches", async () => {
    const admin = await seedUser("admin");
    const med = await seedMedication(100, 10);

    const updated = await adjustStock(db, admin, {
      medicationId: med.id,
      quantity: 120,
      expectedQuantity: 100,
    });
    expect(updated.stockQuantity).toBe(120);
  });
});

describe("prescription rules", () => {
  it("requires a prescriber for prescription-only products", async () => {
    const tech = await seedUser("technician");
    const patient = await seedPatient();
    const med = await seedMedication(100, 10, { rxStatus: "rx" });

    await expect(
      createOrder(db, tech, { patientId: patient.id, medicationId: med.id, quantity: 1 }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT", field: "prescriberId" });
  });

  it("allows OTC products without a prescriber", async () => {
    const tech = await seedUser("technician");
    const patient = await seedPatient("Counter Customer");
    const med = await seedMedication(100, 10, { rxStatus: "otc" });

    const order = await createOrder(db, tech, {
      patientId: patient.id,
      medicationId: med.id,
      quantity: 2,
      directions: "Take 1 tablet as needed",
    });
    expect(order.prescriberId).toBeNull();
    expect(order.directions).toBe("Take 1 tablet as needed");

    const [audit] = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, order.id));
    expect(audit.details).toMatchObject({
      patientId: patient.id,
      patientName: "Counter Customer",
      prescriberId: null,
    });
  });

  it("refuses refills on Schedule II controlled substances", async () => {
    const tech = await seedUser("technician");
    const med = await seedMedication(100, 10, { deaSchedule: "II" });

    await expect(
      createOrder(db, tech, {
        ...(await seedParties()),
        medicationId: med.id,
        quantity: 30,
        refills: 1,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT", field: "refills" });
  });

  it("caps Schedule III–V refills at 5", async () => {
    const tech = await seedUser("technician");
    const med = await seedMedication(100, 10, { deaSchedule: "IV" });

    await expect(
      createOrder(db, tech, {
        ...(await seedParties()),
        medicationId: med.id,
        quantity: 30,
        refills: 6,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT", field: "refills" });

    const ok = await createOrder(db, tech, {
      ...(await seedParties()),
      medicationId: med.id,
      quantity: 30,
      refills: 5,
    });
    expect(ok.refills).toBe(5);
  });

  it("caps non-controlled refills at 11 and validates days supply", async () => {
    const tech = await seedUser("technician");
    const med = await seedMedication();

    await expect(
      createOrder(db, tech, {
        ...(await seedParties()),
        medicationId: med.id,
        quantity: 30,
        refills: 12,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT", field: "refills" });

    await expect(
      createOrder(db, tech, {
        ...(await seedParties()),
        medicationId: med.id,
        quantity: 30,
        daysSupply: 0,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT", field: "daysSupply" });
  });
});
