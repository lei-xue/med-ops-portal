import { eq, sql } from "drizzle-orm";

import type { AppDatabase } from "@/db";
import {
  auditLogs,
  medications,
  medicationOrders,
  type Medication,
  type MedicationOrder,
  type OrderStatus,
  type UserRole,
} from "@/db/schema";
import {
  canTransition,
  isLowStock,
  roleCan,
  targetStatusFor,
  type OrderAction,
} from "@/lib/permissions";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type ServiceErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_TRANSITION"
  | "INSUFFICIENT_STOCK";

export class OrderServiceError extends Error {
  readonly code: ServiceErrorCode;

  constructor(code: ServiceErrorCode, message: string) {
    super(message);
    this.name = "OrderServiceError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Actor & inputs
// ---------------------------------------------------------------------------

export interface Actor {
  id: number;
  role: UserRole;
  name?: string;
}

export interface CreateOrderInput {
  patientName: string;
  medicationId: number;
  quantity: number;
  notes?: string | null;
}

export interface AdjustStockInput {
  medicationId: number;
  quantity: number;
  reason?: string | null;
}

function requirePermission(actor: Actor, action: OrderAction): void {
  if (!roleCan(actor.role, action)) {
    throw new OrderServiceError(
      "FORBIDDEN",
      `Role "${actor.role}" is not permitted to perform "${action}".`,
    );
  }
}

type OrderTx = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

// ---------------------------------------------------------------------------
// Audit helper (always called inside the caller's transaction)
// ---------------------------------------------------------------------------

async function writeAudit(
  tx: OrderTx,
  actor: Actor,
  action: string,
  entityType: "medication_order" | "medication" | "user",
  entityId: number,
  details?: Record<string, unknown>,
): Promise<void> {
  await tx.insert(auditLogs).values({
    actorId: actor.id,
    action,
    entityType,
    entityId,
    details: details ?? null,
  });
}

async function getOrderForUpdate(
  tx: OrderTx,
  orderId: number,
): Promise<MedicationOrder> {
  const [order] = await tx
    .select()
    .from(medicationOrders)
    .where(eq(medicationOrders.id, orderId))
    .for("update");

  if (!order) {
    throw new OrderServiceError(
      "NOT_FOUND",
      `Order ${orderId} was not found.`,
    );
  }
  return order;
}

function assertTransition(order: MedicationOrder, to: OrderStatus): void {
  if (!canTransition(order.status, to)) {
    throw new OrderServiceError(
      "INVALID_TRANSITION",
      `Illegal transition: order ${order.id} cannot go from "${order.status}" to "${to}".`,
    );
  }
}

// ---------------------------------------------------------------------------
// Order lifecycle
// ---------------------------------------------------------------------------

/** Create a pending order. Technicians and above. */
export async function createOrder(
  db: AppDatabase,
  actor: Actor,
  input: CreateOrderInput,
): Promise<MedicationOrder> {
  requirePermission(actor, "create");

  const patientName = input.patientName?.trim() ?? "";
  if (!patientName) {
    throw new OrderServiceError("INVALID_INPUT", "Patient name is required.");
  }
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new OrderServiceError(
      "INVALID_INPUT",
      "Quantity must be a positive integer.",
    );
  }

  return db.transaction(async (tx) => {
    const [medication] = await tx
      .select()
      .from(medications)
      .where(eq(medications.id, input.medicationId));

    if (!medication) {
      throw new OrderServiceError(
        "NOT_FOUND",
        `Medication ${input.medicationId} was not found.`,
      );
    }

    const [order] = await tx
      .insert(medicationOrders)
      .values({
        patientName,
        medicationId: medication.id,
        quantity: input.quantity,
        notes: input.notes?.trim() || null,
        status: "pending",
        createdById: actor.id,
      })
      .returning();

    await writeAudit(tx, actor, "order.create", "medication_order", order.id, {
      patientName: order.patientName,
      medicationId: medication.id,
      medicationName: medication.name,
      quantity: order.quantity,
      status: "pending",
    });

    return order;
  });
}

/**
 * Generic pending → verified (verify), verified → filled (fill),
 * filled → completed (complete), pending/verified → cancelled (cancel).
 * Filling additionally decrements stock inside the same transaction.
 */
async function transitionOrder(
  db: AppDatabase,
  actor: Actor,
  orderId: number,
  action: "verify" | "fill" | "complete" | "cancel",
): Promise<MedicationOrder> {
  requirePermission(actor, action);
  const to = targetStatusFor(action);

  return db.transaction(async (tx) => {
    const order = await getOrderForUpdate(tx, orderId);
    assertTransition(order, to);

    const patch: Partial<MedicationOrder> = {
      status: to,
      updatedAt: new Date(),
    };
    if (action === "verify") patch.verifiedById = actor.id;
    if (action === "fill") patch.filledById = actor.id;

    let updatedMedication: Medication | undefined;

    if (action === "fill") {
      const [medication] = await tx
        .select()
        .from(medications)
        .where(eq(medications.id, order.medicationId))
        .for("update");

      if (!medication) {
        throw new OrderServiceError(
          "NOT_FOUND",
          `Medication ${order.medicationId} was not found.`,
        );
      }
      if (medication.stockQuantity < order.quantity) {
        throw new OrderServiceError(
          "INSUFFICIENT_STOCK",
          `Insufficient stock for ${medication.name}: have ${medication.stockQuantity}, need ${order.quantity}.`,
        );
      }

      const [decremented] = await tx
        .update(medications)
        .set({
          stockQuantity: sql`${medications.stockQuantity} - ${order.quantity}`,
        })
        .where(eq(medications.id, medication.id))
        .returning();
      updatedMedication = decremented;
    }

    const [updated] = await tx
      .update(medicationOrders)
      .set(patch)
      .where(eq(medicationOrders.id, order.id))
      .returning();

    const details: Record<string, unknown> = {
      from: order.status,
      to,
    };
    if (action === "fill" && updatedMedication) {
      details.quantity = order.quantity;
      details.medicationId = updatedMedication.id;
      details.stockBefore = updatedMedication.stockQuantity + order.quantity;
      details.stockAfter = updatedMedication.stockQuantity;
      details.lowStockAfter = isLowStock(updatedMedication);
    }

    await writeAudit(
      tx,
      actor,
      `order.${action}`,
      "medication_order",
      order.id,
      details,
    );

    return updated;
  });
}

/** pending → verified. Pharmacists and admins. */
export function verifyOrder(
  db: AppDatabase,
  actor: Actor,
  orderId: number,
): Promise<MedicationOrder> {
  return transitionOrder(db, actor, orderId, "verify");
}

/** verified → filled. Technicians and above. Decrements stock atomically. */
export function fillOrder(
  db: AppDatabase,
  actor: Actor,
  orderId: number,
): Promise<MedicationOrder> {
  return transitionOrder(db, actor, orderId, "fill");
}

/** filled → completed. Pharmacists and admins. */
export function completeOrder(
  db: AppDatabase,
  actor: Actor,
  orderId: number,
): Promise<MedicationOrder> {
  return transitionOrder(db, actor, orderId, "complete");
}

/** pending|verified → cancelled. Pharmacists and admins. */
export function cancelOrder(
  db: AppDatabase,
  actor: Actor,
  orderId: number,
): Promise<MedicationOrder> {
  return transitionOrder(db, actor, orderId, "cancel");
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

/** Set an absolute stock quantity. Admins only. */
export async function adjustStock(
  db: AppDatabase,
  actor: Actor,
  input: AdjustStockInput,
): Promise<Medication> {
  requirePermission(actor, "inventory.adjust");

  if (!Number.isInteger(input.quantity) || input.quantity < 0) {
    throw new OrderServiceError(
      "INVALID_INPUT",
      "Quantity must be a non-negative integer.",
    );
  }

  return db.transaction(async (tx) => {
    const [medication] = await tx
      .select()
      .from(medications)
      .where(eq(medications.id, input.medicationId))
      .for("update");

    if (!medication) {
      throw new OrderServiceError(
        "NOT_FOUND",
        `Medication ${input.medicationId} was not found.`,
      );
    }

    const [updated] = await tx
      .update(medications)
      .set({ stockQuantity: input.quantity })
      .where(eq(medications.id, medication.id))
      .returning();

    await writeAudit(
      tx,
      actor,
      "inventory.adjust",
      "medication",
      medication.id,
      {
        medicationName: medication.name,
        from: medication.stockQuantity,
        to: input.quantity,
        lowStockAfter: isLowStock(updated),
        reason: input.reason?.trim() || null,
      },
    );

    return updated;
  });
}
