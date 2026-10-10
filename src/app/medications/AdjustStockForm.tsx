"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { btnSecondary, fieldSm } from "@/components/ui";

export default function AdjustStockForm({
  medicationId,
  medicationName,
  currentStock,
}: {
  medicationId: number;
  medicationName: string;
  currentStock: number;
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(String(currentStock));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  // When the server value changes (after a refresh), reset the input to it
  // but keep any message, e.g. the "stock changed" conflict explanation.
  const [syncedStock, setSyncedStock] = useState(currentStock);
  if (currentStock !== syncedStock) {
    setSyncedStock(currentStock);
    setQuantity(String(currentStock));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    const parsed = quantity.trim() === "" ? Number.NaN : Number(quantity);
    if (!Number.isInteger(parsed) || parsed < 0) {
      setError("Enter a non-negative whole number.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch(`/api/medications/${medicationId}/adjust-stock`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quantity: parsed,
          reason: "manual adjustment",
          // Lets the server refuse the edit if stock moved since page load.
          expectedQuantity: currentStock,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "Adjustment was rejected.");
        if (res.status === 409) router.refresh();
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Network error — please retry.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <label htmlFor={`stock-${medicationId}`} className="sr-only">
          New stock quantity for {medicationName}
        </label>
        <input
          id={`stock-${medicationId}`}
          type="number"
          min={0}
          value={quantity}
          onChange={(e) => {
            setQuantity(e.target.value);
            setSaved(false);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `stock-${medicationId}-error` : undefined}
          className={`${fieldSm} w-24 tabular-nums`}
        />
        <button type="submit" disabled={pending} className={btnSecondary}>
          {pending ? "…" : "Save"}
        </button>
      </div>
      {saved && (
        <span className="text-xs font-medium text-emerald-600">Saved</span>
      )}
      {error && (
        <span
          id={`stock-${medicationId}-error`}
          role="alert"
          className="max-w-56 text-right text-xs text-red-600"
        >
          {error}
        </span>
      )}
    </form>
  );
}
