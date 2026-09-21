import { relations } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "pharmacist",
  "technician",
  "admin",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "verified",
  "filled",
  "completed",
  "cancelled",
]);

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("technician"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const medications = pgTable(
  "medications",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    // Fictional NDC format for the demo: 00000-0000-00
    ndc: text("ndc").notNull(),
    strength: text("strength").notNull(),
    dosageForm: text("dosage_form").notNull(),
    stockQuantity: integer("stock_quantity").notNull().default(0),
    reorderThreshold: integer("reorder_threshold").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("medications_ndc_unique").on(table.ndc)],
);

export const medicationOrders = pgTable(
  "medication_orders",
  {
    id: serial("id").primaryKey(),
    patientName: text("patient_name").notNull(),
    medicationId: integer("medication_id")
      .notNull()
      .references(() => medications.id),
    quantity: integer("quantity").notNull(),
    status: orderStatusEnum("status").notNull().default("pending"),
    notes: text("notes"),
    createdById: integer("created_by_id")
      .notNull()
      .references(() => users.id),
    verifiedById: integer("verified_by_id").references(() => users.id),
    filledById: integer("filled_by_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("medication_orders_status_idx").on(table.status),
    index("medication_orders_medication_idx").on(table.medicationId),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    actorId: integer("actor_id")
      .notNull()
      .references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id").notNull(),
    details: jsonb("details"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_logs_created_at_idx").on(table.createdAt),
    index("audit_logs_action_idx").on(table.action),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  createdOrders: many(medicationOrders),
  auditLogs: many(auditLogs),
}));

export const medicationsRelations = relations(medications, ({ many }) => ({
  orders: many(medicationOrders),
}));

export const medicationOrdersRelations = relations(
  medicationOrders,
  ({ one }) => ({
    medication: one(medications, {
      fields: [medicationOrders.medicationId],
      references: [medications.id],
    }),
    createdBy: one(users, {
      fields: [medicationOrders.createdById],
      references: [users.id],
    }),
    verifiedBy: one(users, {
      fields: [medicationOrders.verifiedById],
      references: [users.id],
    }),
    filledBy: one(users, {
      fields: [medicationOrders.filledById],
      references: [users.id],
    }),
  }),
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, { fields: [auditLogs.actorId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type Medication = typeof medications.$inferSelect;
export type MedicationOrder = typeof medicationOrders.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;

export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];

export const USER_ROLES = userRoleEnum.enumValues;
export const ORDER_STATUSES = orderStatusEnum.enumValues;
