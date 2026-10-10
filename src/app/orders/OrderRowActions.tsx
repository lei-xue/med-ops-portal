"use client";

import {
  CircleCheck,
  PackageCheck,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { btnGhostDanger, btnPrimarySm } from "@/components/ui";
import type { OrderStatus, UserRole } from "@/db/schema";
import { ACTION_LABELS, legalActionsFor, type OrderAction } from "@/lib/permissions";

const ACTION_ICONS: Partial<Record<OrderAction, LucideIcon>> = {
  verify: ShieldCheck,
  fill: PackageCheck,
  complete: CircleCheck,
};

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
    return <span className="text-xs text-slate-300">—</span>;
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
      <div className="flex items-center justify-end gap-1">
        {actions.map((action) => {
          const Icon = ACTION_ICONS[action];
          return (
            <button
              key={action}
              type="button"
              disabled={pendingAction !== null}
              onClick={() => run(action)}
              className={
                action === "cancel" ? btnGhostDanger : `${btnPrimarySm} min-w-22`
              }
            >
              {Icon && <Icon aria-hidden className="size-3.5" />}
              {pendingAction === action ? "Working…" : ACTION_LABELS[action]}
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="max-w-48 text-right text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
