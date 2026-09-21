"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

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
  const quantityNum = Number.parseInt(quantity, 10);
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

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div>
        <label
          htmlFor="patientName"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Patient name <span className="text-rose-500">*</span>
        </label>
        <input
          id="patientName"
          type="text"
          required
          value={patientName}
          onChange={(e) => setPatientName(e.target.value)}
          placeholder="Fictional patient name"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
        />
        <FieldError messages={fieldErrors.patientName} />
      </div>

      <div>
        <label
          htmlFor="medication"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Medication <span className="text-rose-500">*</span>
        </label>
        <select
          id="medication"
          value={medicationId}
          onChange={(e) => setMedicationId(Number(e.target.value))}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
        >
          {medications.map((med) => (
            <option key={med.id} value={med.id}>
              {med.name} — stock {med.stockQuantity}
            </option>
          ))}
        </select>
        {selected && (
          <p className="mt-1 text-xs text-slate-500">
            {selected.strength} · {selected.dosageForm} ·{" "}
            <span
              className={
                isLowStock(selected) ? "font-semibold text-rose-600" : ""
              }
            >
              {selected.stockQuantity} on hand
              {isLowStock(selected) && " (low stock)"}
            </span>
          </p>
        )}
        <FieldError messages={fieldErrors.medicationId} />
      </div>

      <div>
        <label
          htmlFor="quantity"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Quantity <span className="text-rose-500">*</span>
        </label>
        <input
          id="quantity"
          type="number"
          required
          min={1}
          max={1000}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-32 rounded-md border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
        />
        {exceedsStock && (
          <p className="mt-1 text-xs font-medium text-amber-600">
            Quantity exceeds current stock — the fill will be rejected unless
            inventory is adjusted first.
          </p>
        )}
        <FieldError messages={fieldErrors.quantity} />
      </div>

      <div>
        <label
          htmlFor="notes"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Notes
        </label>
        <textarea
          id="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional handling / context notes"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none"
        />
        <FieldError messages={fieldErrors.notes} />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={() => router.push("/orders")}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || medications.length === 0}
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create order"}
        </button>
      </div>
    </form>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p className="mt-1 text-xs font-medium text-rose-600">
      {messages.join(" ")}
    </p>
  );
}
