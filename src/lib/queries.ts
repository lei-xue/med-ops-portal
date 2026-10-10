import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { CLINIC_TIME_ZONE } from "@/lib/clinicTime";
import {
  auditLogs,
  medications,
  medicationOrders,
  patients,
  prescribers,
  users,
  ORDER_STATUSES,
  type DeaSchedule,
  type OrderStatus,
  type RxStatus,
  type UserRole,
} from "@/db/schema";

const createdBy = alias(users, "created_by");
const verifiedBy = alias(users, "verified_by");
const filledBy = alias(users, "filled_by");

/** `%`, `_` and `\` are wildcards in ILIKE; match them literally in search boxes. */
function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export interface OrderRow {
  id: number;
  quantity: number;
  status: OrderStatus;
  notes: string | null;
  refills: number;
  createdAt: Date;
  updatedAt: Date;
  patientId: number;
  patientName: string;
  patientMrn: string;
  prescriberId: number | null;
  prescriberName: string | null;
  prescriberCredentials: string | null;
  medicationId: number;
  medicationName: string;
  medicationStrength: string;
  medicationForm: string;
  medicationRxStatus: RxStatus;
  medicationSchedule: DeaSchedule | null;
  stockUnit: string;
  createdByName: string;
}

export interface OrderListFilters {
  q?: string;
  status?: OrderStatus;
  /** Match any of these statuses (ignored when `status` is set). */
  statuses?: OrderStatus[];
  patientId?: number;
  prescriberId?: number;
  medicationId?: number;
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
  } else if (filters.statuses?.length) {
    conditions.push(inArray(medicationOrders.status, filters.statuses));
  }
  if (filters.patientId !== undefined) {
    conditions.push(eq(medicationOrders.patientId, filters.patientId));
  }
  if (filters.prescriberId !== undefined) {
    conditions.push(eq(medicationOrders.prescriberId, filters.prescriberId));
  }
  if (filters.medicationId !== undefined) {
    conditions.push(eq(medicationOrders.medicationId, filters.medicationId));
  }
  const q = filters.q?.trim();
  if (q) {
    const pattern = likePattern(q);
    const search = or(
      ilike(patients.name, pattern),
      ilike(patients.mrn, pattern),
      ilike(medications.name, pattern),
      ilike(prescribers.name, pattern),
    );
    if (search) conditions.push(search);
  }
  return conditions.length ? and(...conditions) : undefined;
}

const orderRowColumns = {
  id: medicationOrders.id,
  quantity: medicationOrders.quantity,
  status: medicationOrders.status,
  notes: medicationOrders.notes,
  refills: medicationOrders.refills,
  createdAt: medicationOrders.createdAt,
  updatedAt: medicationOrders.updatedAt,
  patientId: patients.id,
  patientName: patients.name,
  patientMrn: patients.mrn,
  prescriberId: prescribers.id,
  prescriberName: prescribers.name,
  prescriberCredentials: prescribers.credentials,
  medicationId: medications.id,
  medicationName: medications.name,
  medicationStrength: medications.strength,
  medicationForm: medications.dosageForm,
  medicationRxStatus: medications.rxStatus,
  medicationSchedule: medications.deaSchedule,
  stockUnit: medications.stockUnit,
  createdByName: createdBy.name,
};

export async function listOrders(
  filters: OrderListFilters = {},
): Promise<Paginated<OrderRow>> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 10));
  const where = orderFiltersToWhere(filters);

  const rows = await db
    .select(orderRowColumns)
    .from(medicationOrders)
    .innerJoin(medications, eq(medicationOrders.medicationId, medications.id))
    .innerJoin(patients, eq(medicationOrders.patientId, patients.id))
    .leftJoin(prescribers, eq(medicationOrders.prescriberId, prescribers.id))
    .innerJoin(createdBy, eq(medicationOrders.createdById, createdBy.id))
    .where(where)
    .orderBy(desc(medicationOrders.createdAt), desc(medicationOrders.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [totals] = await db
    .select({ value: count() })
    .from(medicationOrders)
    .innerJoin(medications, eq(medicationOrders.medicationId, medications.id))
    .innerJoin(patients, eq(medicationOrders.patientId, patients.id))
    .leftJoin(prescribers, eq(medicationOrders.prescriberId, prescribers.id))
    .where(where);

  return {
    rows,
    total: totals?.value ?? 0,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil((totals?.value ?? 0) / pageSize)),
  };
}

export async function countOrdersByStatus(): Promise<
  Record<OrderStatus, number>
> {
  const rows = await db
    .select({ status: medicationOrders.status, value: count() })
    .from(medicationOrders)
    .groupBy(medicationOrders.status);
  const counts = Object.fromEntries(
    ORDER_STATUSES.map((s) => [s, 0]),
  ) as Record<OrderStatus, number>;
  for (const row of rows) counts[row.status] = row.value;
  return counts;
}

export async function getOrderDetail(id: number) {
  const [row] = await db
    .select({
      id: medicationOrders.id,
      quantity: medicationOrders.quantity,
      status: medicationOrders.status,
      notes: medicationOrders.notes,
      directions: medicationOrders.directions,
      refills: medicationOrders.refills,
      daysSupply: medicationOrders.daysSupply,
      createdAt: medicationOrders.createdAt,
      updatedAt: medicationOrders.updatedAt,
      createdById: medicationOrders.createdById,
      createdByName: createdBy.name,
      verifiedById: medicationOrders.verifiedById,
      verifiedByName: verifiedBy.name,
      filledById: medicationOrders.filledById,
      filledByName: filledBy.name,
      patient: {
        id: patients.id,
        name: patients.name,
        mrn: patients.mrn,
        dateOfBirth: patients.dateOfBirth,
        allergies: patients.allergies,
      },
      prescriberId: prescribers.id,
      prescriberName: prescribers.name,
      prescriberCredentials: prescribers.credentials,
      prescriberNpi: prescribers.npi,
      prescriberSpecialty: prescribers.specialty,
      medicationId: medications.id,
      medicationName: medications.name,
      medicationBrandName: medications.brandName,
      medicationStrength: medications.strength,
      medicationForm: medications.dosageForm,
      medicationRoute: medications.route,
      medicationRxStatus: medications.rxStatus,
      medicationSchedule: medications.deaSchedule,
      medicationStockQuantity: medications.stockQuantity,
      medicationReorderThreshold: medications.reorderThreshold,
      stockUnit: medications.stockUnit,
    })
    .from(medicationOrders)
    .innerJoin(medications, eq(medicationOrders.medicationId, medications.id))
    .innerJoin(patients, eq(medicationOrders.patientId, patients.id))
    .leftJoin(prescribers, eq(medicationOrders.prescriberId, prescribers.id))
    .innerJoin(createdBy, eq(medicationOrders.createdById, createdBy.id))
    .leftJoin(verifiedBy, eq(medicationOrders.verifiedById, verifiedBy.id))
    .leftJoin(filledBy, eq(medicationOrders.filledById, filledBy.id))
    .where(eq(medicationOrders.id, id));

  return row ?? null;
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrderDetail>>>;

/** Audit rows for one order, oldest first: its lifecycle timeline. */
export async function getOrderHistory(orderId: number): Promise<AuditFeedRow[]> {
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
    .where(
      and(
        eq(auditLogs.entityType, "medication_order"),
        eq(auditLogs.entityId, orderId),
      ),
    )
    .orderBy(asc(auditLogs.createdAt), asc(auditLogs.id));
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

/** Counts the dashboard needs beyond the per-status totals. */
export interface DashboardStats {
  completedToday: number;
  lowStock: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  // Midnight in the clinic's zone, computed by Postgres so the server's own
  // zone (UTC in the container) never leaks into "today".
  const startOfToday = sql`(date_trunc('day', now() AT TIME ZONE ${CLINIC_TIME_ZONE}) AT TIME ZONE ${CLINIC_TIME_ZONE})`;

  const [[completedToday], [lowStock]] = await Promise.all([
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
      .where(lte(medications.stockQuantity, medications.reorderThreshold)),
  ]);

  return {
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

export async function getRecentAudit(
  limit = 10,
  {
    excludeLogins = false,
    actorId,
  }: { excludeLogins?: boolean; actorId?: number } = {},
): Promise<AuditFeedRow[]> {
  const conditions: SQL[] = [];
  if (excludeLogins) {
    conditions.push(ne(auditLogs.action, "user.login"));
    conditions.push(ne(auditLogs.action, "user.login_failed"));
  }
  if (actorId !== undefined) conditions.push(eq(auditLogs.actorId, actorId));

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
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Audit log page
// ---------------------------------------------------------------------------

export interface AuditListFilters {
  action?: string;
  actorId?: number;
  /**
   * Drop successful `user.login` rows (ignored when filtering by a specific
   * action). Failed sign-ins are security events and stay visible.
   */
  excludeLogins?: boolean;
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
  else if (filters.excludeLogins) {
    conditions.push(ne(auditLogs.action, "user.login"));
  }
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

export interface MedicationFilters {
  q?: string;
  form?: string;
  rxStatus?: RxStatus;
  /** Only DEA-scheduled (controlled) products. */
  controlled?: boolean;
  lowStock?: boolean;
}

export async function listMedications(filters: MedicationFilters = {}) {
  const conditions: SQL[] = [];
  const q = filters.q?.trim();
  if (q) {
    const pattern = likePattern(q);
    const search = or(
      ilike(medications.name, pattern),
      ilike(medications.brandName, pattern),
      ilike(medications.drugClass, pattern),
      ilike(medications.ndc, pattern),
    );
    if (search) conditions.push(search);
  }
  if (filters.form) conditions.push(eq(medications.dosageForm, filters.form));
  if (filters.rxStatus) conditions.push(eq(medications.rxStatus, filters.rxStatus));
  if (filters.controlled) conditions.push(sql`${medications.deaSchedule} is not null`);
  if (filters.lowStock) {
    conditions.push(lte(medications.stockQuantity, medications.reorderThreshold));
  }

  return db
    .select()
    .from(medications)
    .where(conditions.length ? and(...conditions) : undefined)
    // Group a drug's products together, smallest strength first.
    .orderBy(asc(medications.name), asc(medications.dosageForm), asc(medications.id));
}

/** Distinct dosage forms in the catalog, for filter controls. */
export async function listDosageForms(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ form: medications.dosageForm })
    .from(medications)
    .orderBy(asc(medications.dosageForm));
  return rows.map((r) => r.form);
}

export async function getMedicationById(id: number) {
  const [row] = await db
    .select()
    .from(medications)
    .where(eq(medications.id, id));
  return row ?? null;
}

/** Other strengths and forms of the same drug. */
export async function listSiblingProducts(name: string, excludeId: number) {
  return db
    .select()
    .from(medications)
    .where(and(eq(medications.name, name), ne(medications.id, excludeId)))
    .orderBy(asc(medications.dosageForm), asc(medications.id));
}

// ---------------------------------------------------------------------------
// Patients
// ---------------------------------------------------------------------------

export async function listPatients(q?: string) {
  const term = q?.trim();
  const search = term
    ? or(ilike(patients.name, likePattern(term)), ilike(patients.mrn, likePattern(term)))
    : undefined;
  return db
    .select({
      id: patients.id,
      mrn: patients.mrn,
      name: patients.name,
      dateOfBirth: patients.dateOfBirth,
      allergies: patients.allergies,
      orderCount: count(medicationOrders.id),
      activeCount: sql<number>`count(${medicationOrders.id}) filter (where ${medicationOrders.status} in ('pending', 'verified', 'filled'))`.mapWith(Number),
      lastOrderAt: sql<Date | null>`max(${medicationOrders.createdAt})`.mapWith((v) => (v ? new Date(v) : null)),
    })
    .from(patients)
    .leftJoin(medicationOrders, eq(medicationOrders.patientId, patients.id))
    .where(search)
    .groupBy(patients.id)
    .orderBy(asc(patients.name));
}

export async function getPatientById(id: number) {
  const [row] = await db.select().from(patients).where(eq(patients.id, id));
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Prescribers
// ---------------------------------------------------------------------------

export async function listPrescribers(q?: string) {
  const term = q?.trim();
  const search = term
    ? or(
        ilike(prescribers.name, likePattern(term)),
        ilike(prescribers.npi, likePattern(term)),
        ilike(prescribers.specialty, likePattern(term)),
      )
    : undefined;
  return db
    .select({
      id: prescribers.id,
      name: prescribers.name,
      credentials: prescribers.credentials,
      npi: prescribers.npi,
      specialty: prescribers.specialty,
      practice: prescribers.practice,
      orderCount: count(medicationOrders.id),
      patientCount: sql<number>`count(distinct ${medicationOrders.patientId})`.mapWith(Number),
    })
    .from(prescribers)
    .leftJoin(medicationOrders, eq(medicationOrders.prescriberId, prescribers.id))
    .where(search)
    .groupBy(prescribers.id)
    .orderBy(asc(prescribers.name));
}

export async function getPrescriberById(id: number) {
  const [row] = await db.select().from(prescribers).where(eq(prescribers.id, id));
  return row ?? null;
}
