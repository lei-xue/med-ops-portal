"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { OrderStatus, UserRole } from "@/db/schema";
import { ACTION_LABELS, legalActionsFor, type OrderAction } from "@/lib/permissions";

const ACTION_STYLES: Partial<Record<OrderAction, string>> = {
  verify: "bg-sky-600 hover:bg-sky-500 text-white",
  fill: "bg-violet-600 hover:bg-violet-500 text-white",
  complete: "bg-emerald-600 hover:bg-emerald-500 text-white",
  cancel: "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
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

  const actions = legalActionsFor(role, status);

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
      <div className="flex justify-end gap-1.5">
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            disabled={pendingAction !== null}
            onClick={() => run(action)}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold disabled:opacity-50 ${ACTION_STYLES[action] ?? "border border-slate-300 bg-white text-slate-600"}`}
          >
            {pendingAction === action
              ? "…"
              : ACTION_LABELS[action]}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="max-w-48 text-right text-xs text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
