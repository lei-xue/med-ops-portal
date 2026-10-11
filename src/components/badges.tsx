import { TriangleAlert } from "lucide-react";

import type { DeaSchedule, OrderStatus, RxStatus, UserRole } from "@/db/schema";
import { ROLE_LABELS, STATUS_LABELS } from "@/lib/permissions";

export const STATUS_STYLES: Record<
  OrderStatus,
  { pill: string; dot: string }
> = {
  pending: { pill: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-500" },
  verified: { pill: "bg-brand-50 text-brand-700 ring-brand-100", dot: "bg-brand-500" },
  filled: { pill: "bg-violet-50 text-violet-700 ring-violet-200", dot: "bg-violet-500" },
  completed: { pill: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  cancelled: { pill: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400" },
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${style.pill}`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${style.dot}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function RoleBadge({
  role,
  tone = "light",
}: {
  role: UserRole;
  tone?: "light" | "dark";
}) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-px text-[11px] font-medium ${
        tone === "dark"
          ? "bg-white/10 text-slate-300"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

export function StockBadge({ low }: { low: boolean }) {
  return low ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200 ring-inset">
      <TriangleAlert aria-hidden className="size-3" />
      Below reorder
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 ring-inset">
      <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" />
      In stock
    </span>
  );
}

/** Rx-only vs OTC, plus the DEA schedule for controlled substances. */
export function ProductBadges({
  rxStatus,
  schedule,
}: {
  rxStatus: RxStatus;
  schedule: DeaSchedule | null;
}) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
      {rxStatus === "rx" ? (
        <span
          title="Prescription required"
          className="rounded bg-brand-50 px-1.5 py-px text-[11px] font-semibold text-brand-700 ring-1 ring-brand-100 ring-inset"
        >
          Rx
        </span>
      ) : (
        <span
          title="Over the counter"
          className="rounded bg-slate-100 px-1.5 py-px text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 ring-inset"
        >
          OTC
        </span>
      )}
      {schedule && (
        <span
          title={`DEA Schedule ${schedule} controlled substance`}
          className="rounded bg-red-50 px-1.5 py-px text-[11px] font-semibold text-red-700 ring-1 ring-red-200 ring-inset"
        >
          C-{schedule}
        </span>
      )}
    </span>
  );
}
