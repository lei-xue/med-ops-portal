"use client";

import { Pill } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { AllergyNote } from "@/components/AllergyNote";
import { ProductBadges, StockBadge } from "@/components/badges";
import { StockGauge } from "@/components/StockGauge";
import {
  btnPrimary,
  btnSecondary,
  card,
  cardHeader,
  field,
} from "@/components/ui";
import type { DeaSchedule, RxStatus } from "@/db/schema";
import { isLowStock } from "@/lib/permissions";

interface PatientOption {
  id: number;
  name: string;
  mrn: string;
  dateOfBirth: string | null;
  allergies: string | null;
}

interface PrescriberOption {
  id: number;
  name: string;
  credentials: string;
  specialty: string;
}

interface MedicationOption {
  id: number;
  name: string;
  brandName: string | null;
  strength: string;
  dosageForm: string;
  rxStatus: RxStatus;
  deaSchedule: DeaSchedule | null;
  stockUnit: string;
  stockQuantity: number;
  reorderThreshold: number;
}

// Mirrors the service rules so the form can guide before the server refuses.
function maxRefills(med: MedicationOption | undefined): number {
  if (med?.deaSchedule === "II") return 0;
  if (med?.deaSchedule) return 5;
  return 11;
}

/** Empty input → null; anything else → Number (so "5.9" reaches the server and is rejected). */
function numberOrNull(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

export default function NewOrderForm({
  patients,
  prescribers,
  medications,
  initialPatientId,
  initialMedicationId,
}: {
  patients: PatientOption[];
  prescribers: PrescriberOption[];
  medications: MedicationOption[];
  initialPatientId: number | null;
  initialMedicationId: number | null;
}) {
  const router = useRouter();
  const [patientId, setPatientId] = useState(
    patients.some((p) => p.id === initialPatientId) ? String(initialPatientId) : "",
  );
  const [medicationId, setMedicationId] = useState(
    medications.some((m) => m.id === initialMedicationId)
      ? String(initialMedicationId)
      : "",
  );
  const [prescriberId, setPrescriberId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [daysSupply, setDaysSupply] = useState("");
  const [refills, setRefills] = useState("0");
  const [directions, setDirections] = useState("");
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const patient = patients.find((p) => String(p.id) === patientId);
  const medication = medications.find((m) => String(m.id) === medicationId);
  const prescriberRequired = medication?.rxStatus === "rx";
  const refillLimit = maxRefills(medication);
  const quantityNum = numberOrNull(quantity);
  const exceedsStock =
    medication !== undefined &&
    quantityNum !== null &&
    Number.isFinite(quantityNum) &&
    quantityNum > medication.stockQuantity;

  // Group products under their drug for the select.
  const byDrug = new Map<string, MedicationOption[]>();
  for (const m of medications) {
    byDrug.set(m.name, [...(byDrug.get(m.name) ?? []), m]);
  }

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
          patientId: numberOrNull(patientId),
          prescriberId: numberOrNull(prescriberId),
          medicationId: numberOrNull(medicationId),
          quantity: quantityNum,
          daysSupply: numberOrNull(daysSupply),
          refills: numberOrNull(refills) ?? 0,
          directions: directions.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
          fieldErrors?: Record<string, string[]>;
        } | null;
        const errors = data?.fieldErrors ?? {};
        setFieldErrors(errors);
        setError(
          Object.keys(errors).length
            ? "Please fix the highlighted fields."
            : (data?.error ?? "Unable to create the order."),
        );
        return;
      }
      const { order } = (await res.json()) as { order: { id: number } };
      router.push(`/orders/${order.id}`);
    } catch {
      setError("Network error — please retry.");
    } finally {
      setPending(false);
    }
  }

  const label = "mb-1.5 block text-sm font-medium text-slate-700";
  const required = <span className="text-red-600">*</span>;
  const describedBy = (name: string) =>
    fieldErrors[name]?.length ? `${name}-error` : undefined;

  return (
    <form
      onSubmit={onSubmit}
      className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3"
    >
      <section className={`${card} lg:col-span-2`}>
        <div className={cardHeader}>
          <h2 className="text-sm font-semibold">Order details</h2>
          <span className="text-xs text-slate-500">{required} Required field</span>
        </div>
        <div className="space-y-5 p-5">
          <div>
            <label htmlFor="patientId" className={label}>
              Patient {required}
            </label>
            <select
              id="patientId"
              required
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              aria-invalid={fieldErrors.patientId ? true : undefined}
              aria-describedby={describedBy("patientId")}
              className={field}
            >
              <option value="">Choose a patient…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.mrn}
                </option>
              ))}
            </select>
            <FieldError name="patientId" messages={fieldErrors.patientId} />
          </div>

          <div>
            <label htmlFor="medicationId" className={label}>
              Medication {required}
            </label>
            <select
              id="medicationId"
              required
              value={medicationId}
              onChange={(e) => {
                setMedicationId(e.target.value);
                const next = medications.find((m) => String(m.id) === e.target.value);
                if (Number(refills) > maxRefills(next)) setRefills(String(maxRefills(next)));
              }}
              aria-invalid={fieldErrors.medicationId ? true : undefined}
              aria-describedby={describedBy("medicationId")}
              className={field}
            >
              <option value="">Choose a product…</option>
              {[...byDrug.entries()].map(([drug, products]) => (
                <optgroup key={drug} label={drug}>
                  {products.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.strength} {m.dosageForm}
                      {m.rxStatus === "otc" ? " · OTC" : ""}
                      {m.deaSchedule ? ` · C-${m.deaSchedule}` : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <FieldError name="medicationId" messages={fieldErrors.medicationId} />
          </div>

          <div>
            <label htmlFor="prescriberId" className={label}>
              Prescriber {prescriberRequired ? required : <span className="font-normal text-slate-500">(optional for OTC)</span>}
            </label>
            <select
              id="prescriberId"
              required={prescriberRequired}
              value={prescriberId}
              onChange={(e) => setPrescriberId(e.target.value)}
              aria-invalid={fieldErrors.prescriberId ? true : undefined}
              aria-describedby={describedBy("prescriberId")}
              className={field}
            >
              <option value="">
                {prescriberRequired ? "Choose a prescriber…" : "None (over the counter)"}
              </option>
              {prescribers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}, {p.credentials} · {p.specialty}
                </option>
              ))}
            </select>
            <FieldError name="prescriberId" messages={fieldErrors.prescriberId} />
          </div>

          <div>
            <label htmlFor="directions" className={label}>
              Directions (sig)
            </label>
            <textarea
              id="directions"
              rows={2}
              value={directions}
              onChange={(e) => setDirections(e.target.value)}
              placeholder="e.g. Take 1 capsule by mouth three times daily for 7 days"
              aria-describedby={describedBy("directions")}
              className={`${field} h-auto py-2`}
            />
            <FieldError name="directions" messages={fieldErrors.directions} />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div>
              <label htmlFor="quantity" className={label}>
                Quantity {required}
              </label>
              <div className="relative">
                <input
                  id="quantity"
                  type="number"
                  required
                  min={1}
                  max={1000}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  aria-invalid={fieldErrors.quantity ? true : undefined}
                  aria-describedby={describedBy("quantity")}
                  className={`${field} pr-20 tabular-nums`}
                />
                <span className="pointer-events-none absolute top-2.5 right-3 text-xs text-slate-500">
                  {medication?.stockUnit ?? "units"}
                </span>
              </div>
              <FieldError name="quantity" messages={fieldErrors.quantity} />
            </div>
            <div>
              <label htmlFor="daysSupply" className={label}>
                Days supply
              </label>
              <input
                id="daysSupply"
                type="number"
                min={1}
                max={365}
                value={daysSupply}
                onChange={(e) => setDaysSupply(e.target.value)}
                aria-describedby={describedBy("daysSupply")}
                className={`${field} tabular-nums`}
              />
              <FieldError name="daysSupply" messages={fieldErrors.daysSupply} />
            </div>
            <div>
              <label htmlFor="refills" className={label}>
                Refills
              </label>
              <input
                id="refills"
                type="number"
                min={0}
                max={refillLimit}
                value={refills}
                disabled={refillLimit === 0}
                onChange={(e) => setRefills(e.target.value)}
                aria-describedby={describedBy("refills") ?? "refills-hint"}
                className={`${field} tabular-nums disabled:bg-slate-50`}
              />
              <p id="refills-hint" className="mt-1.5 text-xs text-slate-500">
                {medication?.deaSchedule === "II"
                  ? "Schedule II: no refills allowed"
                  : medication?.deaSchedule
                    ? `Schedule ${medication.deaSchedule}: at most 5`
                    : `0–${refillLimit}`}
              </p>
              <FieldError name="refills" messages={fieldErrors.refills} />
            </div>
          </div>

          {exceedsStock && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Quantity exceeds current stock ({medication.stockQuantity}{" "}
              {medication.stockUnit}). The fill will be rejected unless inventory is
              adjusted first.
            </p>
          )}

          <div>
            <label htmlFor="notes" className={label}>
              Pharmacy notes
            </label>
            <input
              id="notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional handling or pickup notes"
              className={field}
            />
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
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? "Creating…" : "Create order"}
          </button>
        </div>
      </section>

      <div className="space-y-6">
        <aside className={card}>
          <div className={cardHeader}>
            <h2 className="text-sm font-semibold">Patient</h2>
            {patient && <span className="font-mono text-xs text-slate-500">{patient.mrn}</span>}
          </div>
          <div className="space-y-2 p-5 text-sm">
            {patient ? (
              <>
                <div className="font-medium">{patient.name}</div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Allergies</span>
                  <AllergyNote allergies={patient.allergies} />
                </div>
              </>
            ) : (
              <p className="text-slate-500">Choose a patient to see their allergies.</p>
            )}
          </div>
        </aside>

        <aside className={card}>
          <div className={cardHeader}>
            <h2 className="text-sm font-semibold">Product</h2>
            {medication && <StockBadge low={isLowStock(medication)} />}
          </div>
          {medication ? (
            <div className="space-y-4 p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-brand-50 text-brand-600">
                  <Pill aria-hidden className="size-5" />
                </span>
                <div>
                  <div className="font-medium">
                    {medication.name} {medication.strength}
                  </div>
                  <div className="text-xs text-slate-500">
                    {medication.brandName ? `${medication.brandName} · ` : ""}
                    {medication.dosageForm}
                  </div>
                </div>
              </div>
              <ProductBadges rxStatus={medication.rxStatus} schedule={medication.deaSchedule} />
              <div className="flex items-baseline justify-between text-sm">
                <span>
                  <span className="font-semibold tabular-nums">{medication.stockQuantity}</span>{" "}
                  <span className="text-slate-500">{medication.stockUnit} on hand</span>
                </span>
                <span className="text-xs text-slate-500">
                  reorder at {medication.reorderThreshold}
                </span>
              </div>
              <StockGauge
                stock={medication.stockQuantity}
                threshold={medication.reorderThreshold}
                scale={medication.reorderThreshold * 3}
              />
              <p className="text-xs leading-relaxed text-slate-500">
                Stock is only decremented when the order is filled.
              </p>
            </div>
          ) : (
            <p className="p-5 text-sm text-slate-500">Choose a product to see stock.</p>
          )}
        </aside>
      </div>
    </form>
  );
}

function FieldError({ name, messages }: { name: string; messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p id={`${name}-error`} className="mt-1.5 text-xs font-medium text-red-600">
      {messages.join(" ")}
    </p>
  );
}
