import { and, asc, count, desc, eq, gte, ilike, lte, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  auditLogs,
  medications,
  medicationOrders,
  users,
  type OrderStatus,
  type UserRole,
} from "@/db/schema";

const createdBy = alias(users, "created_by");

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export interface OrderRow {
  id: number;
  patientName: string;
  quantity: number;
  status: OrderStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  medicationId: number;
  medicationName: string;
  medicationStrength: string;
  medicationForm: string;
  createdByName: string;
}

export interface OrderListFilters {
  q?: string;
  status?: OrderStatus;
  page?: number;
  pageSize?: number;
}

export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

function orderFiltersToWhere(filters: OrderListFilters): SQL | undefined {
  const conditions: SQL[] = [];
  if (filters.status) {
    conditions.push(eq(medicationOrders.status, filters.status));
  }
  const q = filters.q?.trim();
  if (q) {
    const pattern = `%${q}%`;
    const search = or(
      ilike(medicationOrders.patientName, pattern),
      ilike(medications.name, pattern),
    );
    if (search) conditions.push(search);
  }
  return conditions.length ? and(...conditions) : undefined;
}

export async function listOrders(
  filters: OrderListFilters = {},
): Promise<Paginated<OrderRow>> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 10));
  const where = orderFiltersToWhere(filters);

  const rows = await db
    .select({
      id: medicationOrders.id,
      patientName: medicationOrders.patientName,
      quantity: medicationOrders.quantity,
      status: medicationOrders.status,
      notes: medicationOrders.notes,
      createdAt: medicationOrders.createdAt,
      updatedAt: medicationOrders.updatedAt,
      medicationId: medications.id,
      medicationName: medications.name,
      medicationStrength: medications.strength,
      medicationForm: medications.dosageForm,
      createdByName: createdBy.name,
    })
    .from(medicationOrders)
    .innerJoin(medications, eq(medicationOrders.medicationId, medications.id))
    .innerJoin(createdBy, eq(medicationOrders.createdById, createdBy.id))
    .where(where)
    .orderBy(desc(medicationOrders.createdAt), desc(medicationOrders.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [totals] = await db
    .select({ value: count() })
    .from(medicationOrders)
    .innerJoin(medications, eq(medicationOrders.medicationId, medications.id))
    .where(where);

  return {
    rows,
    total: totals?.value ?? 0,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil((totals?.value ?? 0) / pageSize)),
  };
}

export async function getOrderDetail(id: number) {
  const [row] = await db
    .select({
      id: medicationOrders.id,
      patientName: medicationOrders.patientName,
      quantity: medicationOrders.quantity,
      status: medicationOrders.status,
      notes: medicationOrders.notes,
      createdAt: medicationOrders.createdAt,
      updatedAt: medicationOrders.updatedAt,
      createdById: medicationOrders.createdById,
      verifiedById: medicationOrders.verifiedById,
      filledById: medicationOrders.filledById,
      medicationId: medications.id,
      medicationName: medications.name,
      medicationStrength: medications.strength,
      medicationStockQuantity: medications.stockQuantity,
    })
    .from(medicationOrders)
    .innerJoin(medications, eq(medicationOrders.medicationId, medications.id))
    .where(eq(medicationOrders.id, id));

  return row ?? null;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardStats {
  pending: number;
  verifiedAwaitingFill: number;
  completedToday: number;
  lowStock: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    [pending],
    [verified],
    [completedToday],
    [lowStock],
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(medicationOrders)
      .where(eq(medicationOrders.status, "pending")),
    db
      .select({ value: count() })
      .from(medicationOrders)
      .where(eq(medicationOrders.status, "verified")),
    db
      .select({ value: count() })
      .from(medicationOrders)
      .where(
        and(
          eq(medicationOrders.status, "completed"),
          gte(medicationOrders.updatedAt, startOfToday),
        ),
      ),
    db
      .select({ value: count() })
      .from(medications)
      .where(
        lte(medications.stockQuantity, medications.reorderThreshold),
      ),
  ]);

  return {
    pending: pending?.value ?? 0,
    verifiedAwaitingFill: verified?.value ?? 0,
    completedToday: completedToday?.value ?? 0,
    lowStock: lowStock?.value ?? 0,
  };
}

export interface AuditFeedRow {
  id: number;
  action: string;
  entityType: string;
  entityId: number;
  details: unknown;
  createdAt: Date;
  actorName: string;
  actorRole: UserRole;
}

export async function getRecentAudit(limit = 10): Promise<AuditFeedRow[]> {
  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      details: auditLogs.details,
      createdAt: auditLogs.createdAt,
      actorName: users.name,
      actorRole: users.role,
    })
    .from(auditLogs)
    .innerJoin(users, eq(auditLogs.actorId, users.id))
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Audit log page
// ---------------------------------------------------------------------------

export interface AuditListFilters {
  action?: string;
  actorId?: number;
  page?: number;
  pageSize?: number;
}

export async function listAuditLogs(
  filters: AuditListFilters = {},
): Promise<Paginated<AuditFeedRow>> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));

  const conditions: SQL[] = [];
  if (filters.action) conditions.push(eq(auditLogs.action, filters.action));
  if (filters.actorId) conditions.push(eq(auditLogs.actorId, filters.actorId));
  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      details: auditLogs.details,
      createdAt: auditLogs.createdAt,
      actorName: users.name,
      actorRole: users.role,
    })
    .from(auditLogs)
    .innerJoin(users, eq(auditLogs.actorId, users.id))
    .where(where)
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [totals] = await db
    .select({ value: count() })
    .from(auditLogs)
    .where(where);

  return {
    rows,
    total: totals?.value ?? 0,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil((totals?.value ?? 0) / pageSize)),
  };
}

export async function listActors() {
  return db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .orderBy(asc(users.name));
}

// ---------------------------------------------------------------------------
// Medications
// ---------------------------------------------------------------------------

export async function listMedications() {
  return db
    .select()
    .from(medications)
    .orderBy(asc(medications.name));
}

export async function getMedicationById(id: number) {
  const [row] = await db
    .select()
    .from(medications)
    .where(eq(medications.id, id));
  return row ?? null;
}
