"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { btnSecondarySm, fieldSm } from "@/components/ui";

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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    const parsed = Number.parseInt(quantity, 10);
    if (!Number.isInteger(parsed) || parsed < 0) {
      setError("Enter a non-negative whole number.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch(`/api/medications/${medicationId}/adjust-stock`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quantity: parsed, reason: "manual adjustment" }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "Adjustment was rejected.");
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
    <form onSubmit={onSubmit} className="flex items-center justify-end gap-1.5">
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
        className={`${fieldSm} w-20 font-mono tabular-nums`}
      />
      <button
        type="submit"
        disabled={pending}
        className={btnSecondarySm}
      >
        {pending ? "…" : "Save"}
      </button>
      {saved && <span className="label-mono text-ink-2">Saved</span>}
      {error && (
        <span role="alert" className="max-w-36 text-xs text-danger">
          {error}
        </span>
      )}
    </form>
  );
}
