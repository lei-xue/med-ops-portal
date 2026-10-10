"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { btnPrimarySm, btnQuiet } from "@/components/ui";
import type { OrderStatus, UserRole } from "@/db/schema";
import { ACTION_LABELS, legalActionsFor, type OrderAction } from "@/lib/permissions";

export default function OrderRowActions({
  orderId,
  status,
  role,
}: {
  orderId: number;
  status: OrderStatus;
  role: UserRole;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<OrderAction | null>(null);

  // Cancel first so the forward action always sits at the right edge.
  const actions = legalActionsFor(role, status).sort(
    (a, b) => Number(b === "cancel") - Number(a === "cancel"),
  );

  if (actions.length === 0 && !error) {
    return <span className="text-xs text-ink-3">—</span>;
  }

  async function run(action: OrderAction) {
    setError(null);
    setPendingAction(action);
    try {
      const res = await fetch(`/api/orders/${orderId}/${action}`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "The action was rejected.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — please retry.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-2">
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            disabled={pendingAction !== null}
            onClick={() => run(action)}
            className={
              action === "cancel"
                ? btnQuiet
                : btnPrimarySm
            }
          >
            {pendingAction === action ? "…" : ACTION_LABELS[action]}
            {action !== "cancel" && pendingAction !== action && (
              <span aria-hidden>→</span>
            )}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="max-w-48 text-right text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
