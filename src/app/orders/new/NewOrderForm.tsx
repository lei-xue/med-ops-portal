"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { btnPrimary, btnSecondary, field, panel } from "@/components/ui";
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
      className={`space-y-5 p-6 ${panel}`}
    >
      <div>
        <label
          htmlFor="patientName"
          className="label-mono mb-1.5 block text-ink-2"
        >
          Patient name <span className="text-signal-ink">*</span>
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

      <div>
        <label
          htmlFor="medication"
          className="label-mono mb-1.5 block text-ink-2"
        >
          Medication <span className="text-signal-ink">*</span>
        </label>
        <select
          id="medication"
          value={medicationId}
          onChange={(e) => setMedicationId(Number(e.target.value))}
          className={field}
        >
          {medications.map((med) => (
            <option key={med.id} value={med.id}>
              {med.name} — stock {med.stockQuantity}
            </option>
          ))}
        </select>
        {selected && (
          <p className="mt-1.5 text-xs text-ink-3">
            {selected.strength} · {selected.dosageForm} ·{" "}
            <span
              className={
                isLowStock(selected) ? "font-semibold text-signal-ink" : ""
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
          className="label-mono mb-1.5 block text-ink-2"
        >
          Quantity <span className="text-signal-ink">*</span>
        </label>
        <input
          id="quantity"
          type="number"
          required
          min={1}
          max={1000}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className={`${field} max-w-32 font-mono tabular-nums`}
        />
        {exceedsStock && (
          <p className="mt-1.5 text-xs font-medium text-signal-ink">
            Quantity exceeds current stock — the fill will be rejected unless
            inventory is adjusted first.
          </p>
        )}
        <FieldError messages={fieldErrors.quantity} />
      </div>

      <div>
        <label
          htmlFor="notes"
          className="label-mono mb-1.5 block text-ink-2"
        >
          Notes
        </label>
        <textarea
          id="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional handling / context notes"
          className={field}
        />
        <FieldError messages={fieldErrors.notes} />
      </div>

      {error && (
        <p
          role="alert"
          className="border-l-4 border-danger bg-sunken px-3 py-2 text-sm text-ink"
        >
          {error}
        </p>
      )}

      <div className="perforation -mx-6 mb-0 h-px" />
      <div className="flex justify-end gap-2">
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
    </form>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p className="mt-1.5 text-xs font-medium text-danger">
      {messages.join(" ")}
    </p>
  );
}
