import type { OrderStatus, UserRole } from "@/db/schema";
import { ROLE_LABELS, STATUS_LABELS } from "@/lib/permissions";

/** Position of each status along the happy path; cancelled sits off it. */
const STAGE_INDEX: Record<OrderStatus, number> = {
  pending: 1,
  verified: 2,
  filled: 3,
  completed: 4,
  cancelled: 0,
};

/**
 * Four-segment track showing how far an order has moved through
 * pending → verified → filled → completed. Status is carried by shape and
 * position, not by colour, so the palette stays free for "needs attention".
 */
export function StatusBadge({
  status,
  attention = false,
}: {
  status: OrderStatus;
  attention?: boolean;
}) {
  const stage = STAGE_INDEX[status];
  const cancelled = status === "cancelled";
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className="flex gap-0.5">
        {[1, 2, 3, 4].map((n) => (
          <span
            key={n}
            className={`h-2.5 w-2 ${
              cancelled
                ? "bg-rule-soft"
                : n < stage
                  ? "bg-ink"
                  : n === stage
                    ? attention
                      ? "bg-signal"
                      : "bg-ink"
                    : "bg-rule"
            }`}
          />
        ))}
      </span>
      <span
        className={`label-mono ${
          cancelled ? "text-ink-3 line-through" : "text-ink"
        }`}
      >
        {STATUS_LABELS[status]}
      </span>
    </span>
  );
}

export function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className="label-mono inline-flex items-center border border-rule px-1.5 py-px text-ink-2">
      {ROLE_LABELS[role]}
    </span>
  );
}

export function LowStockBadge() {
  return (
    <span className="label-mono inline-flex items-center bg-signal px-1.5 py-px font-semibold text-black">
      Reorder
    </span>
  );
}
