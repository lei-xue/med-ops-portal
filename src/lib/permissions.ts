import type { OrderStatus, UserRole } from "@/db/schema";

export type OrderAction =
  | "create"
  | "verify"
  | "fill"
  | "complete"
  | "cancel"
  | "inventory.adjust";

export const ORDER_ACTIONS: OrderAction[] = [
  "create",
  "verify",
  "fill",
  "complete",
  "cancel",
  "inventory.adjust",
];

export const AUDIT_ACTIONS = [
  "order.create",
  "order.verify",
  "order.fill",
  "order.complete",
  "order.cancel",
  "inventory.adjust",
  "user.login",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * Legal order status transitions.
 *
 *   pending → verified → filled → completed
 *      ↘ cancelled ↗ (cancel only from pending or verified)
 */
export const LEGAL_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["verified", "cancelled"],
  verified: ["filled", "cancelled"],
  filled: ["completed"],
  completed: [],
  cancelled: [],
};

/**
 * Role → allowed actions. Roles are cumulative: technicians create and fill,
 * pharmacists additionally verify / cancel / complete, admins additionally
 * adjust inventory and have unrestricted visibility.
 */
export const ROLE_PERMISSIONS: Record<UserRole, readonly OrderAction[]> = {
  technician: ["create", "fill"],
  pharmacist: ["create", "fill", "verify", "cancel", "complete"],
  admin: ["create", "fill", "verify", "cancel", "complete", "inventory.adjust"],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}

export function roleCan(role: UserRole, action: OrderAction): boolean {
  return ROLE_PERMISSIONS[role].includes(action);
}

export function isLowStock(
  med: Pick<MedicationStock, "stockQuantity" | "reorderThreshold">,
): boolean {
  return med.stockQuantity <= med.reorderThreshold;
}

interface MedicationStock {
  stockQuantity: number;
  reorderThreshold: number;
}

/** Actions the given role may legally perform on an order right now. */
export function legalActionsFor(
  role: UserRole,
  status: OrderStatus,
): OrderAction[] {
  return ORDER_ACTIONS.filter(
    (action): action is "verify" | "fill" | "complete" | "cancel" =>
      action !== "create" &&
      action !== "inventory.adjust" &&
      ROLE_PERMISSIONS[role].includes(action) &&
      canTransition(status, targetStatusFor(action)),
  );
}

export function targetStatusFor(action: OrderAction): OrderStatus {
  switch (action) {
    case "verify":
      return "verified";
    case "fill":
      return "filled";
    case "complete":
      return "completed";
    case "cancel":
      return "cancelled";
    case "create":
      return "pending";
    case "inventory.adjust":
      throw new Error("inventory.adjust does not target an order status");
  }
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  verified: "Verified",
  filled: "Filled",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  pharmacist: "Pharmacist",
  technician: "Technician",
};

export const ACTION_LABELS: Record<OrderAction, string> = {
  create: "Create",
  verify: "Verify",
  fill: "Fill",
  complete: "Complete",
  cancel: "Cancel",
  "inventory.adjust": "Adjust stock",
};
