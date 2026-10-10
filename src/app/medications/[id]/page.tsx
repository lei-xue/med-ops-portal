import { Pill } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductBadges, StockBadge } from "@/components/badges";
import { OrdersTable } from "@/components/OrdersTable";
import { PageHeader } from "@/components/PageHeader";
import { StockGauge } from "@/components/StockGauge";
import { card, cardHeader, recordLink } from "@/components/ui";
import { requirePageSession } from "@/lib/pageSession";
import { isLowStock } from "@/lib/permissions";
import { getMedicationById, listOrders, listSiblingProducts } from "@/lib/queries";
import AdjustStockForm from "../AdjustStockForm";

export async function generateMetadata({
  params,
}: PageProps<"/medications/[id]">): Promise<Metadata> {
  const med = await getMedicationById(Number((await params).id) || 0);
  return { title: med ? `${med.name} ${med.strength}` : "Medication" };
}

const SCHEDULE_NOTES: Record<string, string> = {
  II: "High potential for abuse. No refills; each fill needs a new prescription.",
  III: "Moderate potential for abuse. Up to 5 refills within 6 months.",
  IV: "Lower potential for abuse. Up to 5 refills within 6 months.",
  V: "Lowest potential for abuse among controlled substances.",
};

export default async function MedicationPage({
  params,
}: PageProps<"/medications/[id]">) {
  const session = await requirePageSession();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const med = await getMedicationById(id);
  if (!med) notFound();
  const [siblings, orders] = await Promise.all([
    listSiblingProducts(med.name, med.id),
    listOrders({ medicationId: id, pageSize: 50 }),
  ]);
  const low = isLowStock(med);

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/medications" className="hover:text-brand-600">
            ← Inventory
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {med.name} {med.strength}
            <ProductBadges rxStatus={med.rxStatus} schedule={med.deaSchedule} />
          </span>
        }
        description={`${med.brandName ? `${med.brandName} · ` : ""}${med.drugClass} · ${med.dosageForm}, ${med.route}`}
      />

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className={card}>
          <div className={cardHeader}>
            <h2 className="text-sm font-semibold">Product</h2>
            <span className="font-mono text-xs text-slate-500">NDC {med.ndc}</span>
          </div>
          <dl className="space-y-2.5 p-5 text-sm">
            <Row label="Generic name" value={med.name} />
            <Row label="Brand" value={med.brandName ?? "Generic only"} />
            <Row label="Strength" value={med.strength} />
            <Row label="Dosage form" value={med.dosageForm} />
            <Row label="Route" value={med.route} />
            <Row
              label="Dispensing"
              value={med.rxStatus === "rx" ? "Prescription required" : "Over the counter"}
            />
            {med.deaSchedule && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">
                <span className="font-semibold">Schedule {med.deaSchedule}: </span>
                {SCHEDULE_NOTES[med.deaSchedule]}
              </div>
            )}
          </dl>
        </section>

        <section className={card}>
          <div className={cardHeader}>
            <h2 className="text-sm font-semibold">Stock</h2>
            <StockBadge low={low} />
          </div>
          <div className="space-y-3 p-5 text-sm">
            <div className="flex items-baseline justify-between">
              <span>
                <span className={`text-2xl font-semibold tabular-nums ${low ? "text-red-700" : ""}`}>
                  {med.stockQuantity.toLocaleString("en-US")}
                </span>{" "}
                <span className="text-slate-500">{med.stockUnit}</span>
              </span>
              <span className="text-xs text-slate-500">reorder at {med.reorderThreshold}</span>
            </div>
            <StockGauge
              stock={med.stockQuantity}
              threshold={med.reorderThreshold}
              scale={med.reorderThreshold * 3}
            />
            {session.user.role === "admin" && (
              <div className="border-t border-slate-100 pt-3">
                <AdjustStockForm
                  medicationId={med.id}
                  medicationName={`${med.name} ${med.strength}`}
                  currentStock={med.stockQuantity}
                />
              </div>
            )}
          </div>
        </section>

        <section className={card}>
          <div className={cardHeader}>
            <h2 className="text-sm font-semibold">Other strengths and forms</h2>
            <span className="text-xs text-slate-500">{siblings.length}</span>
          </div>
          {siblings.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">
              This is the only {med.name} product stocked.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {siblings.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <Pill aria-hidden className="size-4 shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/medications/${s.id}`} className={recordLink}>
                      {s.strength} {s.dosageForm}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {s.stockQuantity.toLocaleString("en-US")} {s.stockUnit}
                    </div>
                  </div>
                  <ProductBadges rxStatus={s.rxStatus} schedule={s.deaSchedule} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className={`${card} overflow-hidden`}>
        <div className={cardHeader}>
          <h2 className="text-sm font-semibold">Orders for this product</h2>
          <span className="text-xs text-slate-500">{orders.total}</span>
        </div>
        <OrdersTable
          rows={orders.rows}
          role={session.user.role}
          hide={["medication"]}
          empty="No orders for this product yet."
        />
      </section>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
