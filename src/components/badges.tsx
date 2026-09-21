import type { OrderStatus, UserRole } from "@/db/schema";
import { ROLE_LABELS, STATUS_LABELS } from "@/lib/permissions";

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  verified: "bg-sky-50 text-sky-700 ring-sky-600/20",
  filled: "bg-violet-50 text-violet-700 ring-violet-600/20",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  cancelled: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

const ROLE_STYLES: Record<UserRole, string> = {
  admin: "bg-teal-50 text-teal-700 ring-teal-600/20",
  pharmacist: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  technician: "bg-slate-100 text-slate-700 ring-slate-500/20",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${ROLE_STYLES[role]}`}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

export function LowStockBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-600/20">
      Low stock
    </span>
  );
}
