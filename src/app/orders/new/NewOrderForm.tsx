"use client";

import { Pill } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { StockBadge } from "@/components/badges";
import { StockGauge } from "@/components/StockGauge";
import {
  btnPrimary,
  btnSecondary,
  card,
  cardHeader,
  field,
} from "@/components/ui";
import { isLowStock } from "@/lib/permissions";

interface MedicationOption {
  id: number;
  name: string;
  strength: string;
  dosageForm: string;
  stockQuantity: number;
  reorderThreshold: number;
}

export default function NewOrderForm({
  medications,
}: {
  medications: MedicationOption[];
}) {
  const router = useRouter();
  const [patientName, setPatientName] = useState("");
  const [medicationId, setMedicationId] = useState<number>(
    medications[0]?.id ?? 0,
  );
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const selected = medications.find((m) => m.id === medicationId);
  // Number() rather than parseInt so "5.9" reaches the server and is rejected
  // instead of being silently truncated to 5.
  const quantityNum = quantity.trim() === "" ? Number.NaN : Number(quantity);
  const exceedsStock =
    selected !== undefined &&
    Number.isFinite(quantityNum) &&
    quantityNum > selected.stockQuantity;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          patientName,
          medicationId,
          quantity: quantityNum,
          notes: notes.trim() ? notes.trim() : null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
          fieldErrors?: Record<string, string[]>;
        } | null;
        setFieldErrors(data?.fieldErrors ?? {});
        setError(data?.error ?? "Unable to create the order.");
        return;
      }
      router.push("/orders");
    } catch {
      setError("Network error — please retry.");
    } finally {
      setPending(false);
    }
  }

  const label = "mb-1.5 block text-sm font-medium text-slate-700";
  const required = <span className="text-red-600">*</span>;

  return (
    <form
      onSubmit={onSubmit}
      className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3"
    >
      <section className={`${card} lg:col-span-2`}>
        <div className={cardHeader}>
          <h2 className="text-sm font-semibold">Order details</h2>
          <span className="text-xs text-slate-500">
            {required} Required field
          </span>
        </div>
        <div className="space-y-5 p-5">
          <div>
            <label htmlFor="patientName" className={label}>
              Patient name {required}
            </label>
            <input
              id="patientName"
              type="text"
              required
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="Fictional patient name"
              className={field}
            />
            <FieldError messages={fieldErrors.patientName} />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label htmlFor="medication" className={label}>
                Medication {required}
              </label>
              <select
                id="medication"
                value={medicationId}
                onChange={(e) => setMedicationId(Number(e.target.value))}
                className={field}
              >
                {medications.map((med) => (
                  <option key={med.id} value={med.id}>
                    {med.name} {med.strength}
                  </option>
                ))}
              </select>
              <FieldError messages={fieldErrors.medicationId} />
            </div>
            <div>
              <label htmlFor="quantity" className={label}>
                Quantity {required}
              </label>
              <input
                id="quantity"
                type="number"
                required
                min={1}
                max={1000}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={`${field} tabular-nums`}
              />
              <FieldError messages={fieldErrors.quantity} />
            </div>
          </div>

          {exceedsStock && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Quantity exceeds current stock — the fill will be rejected unless
              inventory is adjusted first.
            </p>
          )}

          <div>
            <label htmlFor="notes" className={label}>
              Notes
            </label>
            <textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional handling or context notes"
              className={`${field} h-auto py-2`}
            />
            <FieldError messages={fieldErrors.notes} />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 rounded-b-lg border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={() => router.push("/orders")}
            className={btnSecondary}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || medications.length === 0}
            className={btnPrimary}
          >
            {pending ? "Creating…" : "Create order"}
          </button>
        </div>
      </section>

      {selected && (
        <aside className={card}>
          <div className={cardHeader}>
            <h2 className="text-sm font-semibold">Selected medication</h2>
            <StockBadge low={isLowStock(selected)} />
          </div>
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-brand-50 text-brand-600">
                <Pill aria-hidden className="size-5" />
              </span>
              <div>
                <div className="font-medium">{selected.name}</div>
                <div className="text-xs text-slate-500">
                  {selected.strength} · {selected.dosageForm}
                </div>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">On hand</dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {selected.stockQuantity}
                </dd>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">Reorder at</dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {selected.reorderThreshold}
                </dd>
              </div>
            </dl>
            <StockGauge
              stock={selected.stockQuantity}
              threshold={selected.reorderThreshold}
              scale={Math.max(
                selected.stockQuantity,
                selected.reorderThreshold * 2,
              )}
            />
            <p className="text-xs leading-relaxed text-slate-500">
              New orders start as <strong>pending</strong>. Stock is only
              decremented when the order is filled.
            </p>
          </div>
        </aside>
      )}
    </form>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p className="mt-1.5 text-xs font-medium text-red-600">
      {messages.join(" ")}
    </p>
  );
}
