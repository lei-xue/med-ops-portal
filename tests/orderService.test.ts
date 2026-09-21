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
  seedUser,
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
      patientName: "Riley Sample",
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
      patientName: "Casey Lorem",
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
      patientName: "Avery Example",
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
      patientName: "Jamie Template",
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
      patientName: "Jordan Placeholder",
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
      patientName: "Morgan Dummy",
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
      patientName: "Sam Fictional",
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
      patientName: "A",
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
      patientName: "B",
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
      patientName: "Stocky McStockface",
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
      patientName: "Greedy Grabber",
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
      patientName: "Threshold Tester",
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
  it("rejects blank patient names", async () => {
    const tech = await seedUser("technician");
    const med = await seedMedication();

    await expect(
      createOrder(db, tech, {
        patientName: "   ",
        medicationId: med.id,
        quantity: 1,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejects non-positive quantities", async () => {
    const tech = await seedUser("technician");
    const med = await seedMedication();

    await expect(
      createOrder(db, tech, {
        patientName: "A",
        medicationId: med.id,
        quantity: 0,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejects unknown medications with NOT_FOUND", async () => {
    const tech = await seedUser("technician");

    await expect(
      createOrder(db, tech, {
        patientName: "A",
        medicationId: 99999,
        quantity: 1,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
