import { Boxes, Pill, ShieldAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ProductBadges, StockBadge } from "@/components/badges";
import { PageHeader } from "@/components/PageHeader";
import { StockGauge } from "@/components/StockGauge";
import { btnSecondary, card, fieldSm, recordLink, td, th } from "@/components/ui";
import type { RxStatus } from "@/db/schema";
import { requirePageSession } from "@/lib/pageSession";
import { isLowStock } from "@/lib/permissions";
import { listDosageForms, listMedications } from "@/lib/queries";
import AdjustStockForm from "./AdjustStockForm";

export const metadata: Metadata = { title: "Inventory" };

/** Bars show stock against three times the reorder level, so mixed units compare. */
const GAUGE_REORDER_MULTIPLE = 3;

const TYPE_FILTERS = {
  rx: "Prescription (Rx)",
  otc: "Over the counter",
  controlled: "Controlled (C-II–V)",
} as const;
type TypeFilter = keyof typeof TYPE_FILTERS;

export default async function MedicationsPage({
  searchParams,
}: PageProps<"/medications">) {
  const session = await requirePageSession();
  const isAdmin = session.user.role === "admin";
  const params = await searchParams;
  const q = String(params.q ?? "");
  const forms = await listDosageForms();
  const form = forms.find((f) => f === params.form);
  const type = (Object.keys(TYPE_FILTERS) as TypeFilter[]).find((t) => t === params.type);
  const lowOnly = params.low === "1";

  const [medications, all] = await Promise.all([
    listMedications({
      q,
      form,
      rxStatus: type === "rx" || type === "otc" ? (type as RxStatus) : undefined,
      controlled: type === "controlled",
      lowStock: lowOnly,
    }),
    listMedications(),
  ]);
  const filtered = Boolean(q || form || type || lowOnly);

  return (
    <>
      <PageHeader
        title="Inventory"
        description={
          isAdmin
            ? "Each product is one strength and form of a drug. Admins can adjust counts inline; every change is audited."
            : "Each product is one strength and form of a drug. Filling an order decrements its stock atomically."
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryStat
          icon={Pill}
          label="Products"
          value={`${all.length}`}
          hint={`${new Set(all.map((m) => m.name)).size} drugs`}
          tint="bg-brand-50 text-brand-600"
        />
        <SummaryStat
          icon={Boxes}
          label="Rx / OTC"
          value={`${all.filter((m) => m.rxStatus === "rx").length} / ${all.filter((m) => m.rxStatus === "otc").length}`}
          hint="prescription vs over the counter"
          tint="bg-slate-100 text-slate-600"
        />
        <SummaryStat
          icon={ShieldAlert}
          label="Controlled"
          value={`${all.filter((m) => m.deaSchedule).length}`}
          hint="DEA Schedule II–V"
          tint="bg-violet-50 text-violet-600"
        />
        <SummaryStat
          icon={TriangleAlert}
          label="Below reorder level"
          value={`${all.filter(isLowStock).length}`}
          hint="need restocking"
          tint="bg-red-50 text-red-600"
        />
      </div>

      <div className={`${card} overflow-hidden`}>
        <form
          action="/medications"
          className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center"
        >
          <input
            type="search"
            name="q"
            defaultValue={q}
            aria-label="Search drug, brand, class or NDC"
            placeholder="Search drug, brand, class or NDC"
            className={`${fieldSm} w-full lg:w-72`}
          />
          <select name="form" defaultValue={form ?? ""} aria-label="Dosage form" className={fieldSm}>
            <option value="">All dosage forms</option>
            {forms.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <select name="type" defaultValue={type ?? ""} aria-label="Product type" className={fieldSm}>
            <option value="">Rx and OTC</option>
            {(Object.keys(TYPE_FILTERS) as TypeFilter[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_FILTERS[t]}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 px-1 text-sm whitespace-nowrap text-slate-600">
            <input
              type="checkbox"
              name="low"
              value="1"
              defaultChecked={lowOnly}
              className="size-4 accent-brand-600"
            />
            Below reorder only
          </label>
          <button type="submit" className={btnSecondary}>
            Apply
          </button>
          {filtered && (
            <Link href="/medications" className="px-2 text-sm text-brand-600 hover:text-brand-700">
              Clear
            </Link>
          )}
          <span className="text-xs text-slate-500 lg:ml-auto">
            {medications.length} of {all.length} products
          </span>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full min-w-4xl text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Product</th>
                <th className={th}>Form</th>
                <th className={th}>NDC</th>
                <th className={`${th} w-1/4`}>Stock level</th>
                <th className={th}>Status</th>
                {isAdmin && <th className={`${th} text-right`}>Adjust stock</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {medications.map((med) => {
                const low = isLowStock(med);
                return (
                  <tr key={med.id} className="hover:bg-slate-50/70">
                    <td className={td}>
                      <div className="flex items-center gap-3">
                        <span
                          className={`grid size-8 shrink-0 place-items-center rounded-md ${
                            low ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-600"
                          }`}
                        >
                          <Pill aria-hidden className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/medications/${med.id}`} className={recordLink}>
                              {med.name} {med.strength}
                            </Link>
                            <ProductBadges rxStatus={med.rxStatus} schedule={med.deaSchedule} />
                          </div>
                          <div className="text-xs text-slate-500">
                            {med.brandName ? `${med.brandName} · ` : ""}
                            {med.drugClass}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={td}>
                      <div>{med.dosageForm}</div>
                      <div className="text-xs text-slate-500">{med.route}</div>
                    </td>
                    <td className={`${td} font-mono text-xs whitespace-nowrap text-slate-500`}>
                      {med.ndc}
                    </td>
                    <td className={td}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
                        <span>
                          <span
                            className={`text-sm font-semibold tabular-nums ${
                              low ? "text-red-700" : "text-slate-900"
                            }`}
                          >
                            {med.stockQuantity.toLocaleString("en-US")}
                          </span>{" "}
                          <span className="text-slate-500">{med.stockUnit}</span>
                        </span>
                        <span className="text-slate-500 tabular-nums">
                          reorder at {med.reorderThreshold}
                        </span>
                      </div>
                      <StockGauge
                        stock={med.stockQuantity}
                        threshold={med.reorderThreshold}
                        scale={med.reorderThreshold * GAUGE_REORDER_MULTIPLE}
                      />
                    </td>
                    <td className={td}>
                      <StockBadge low={low} />
                    </td>
                    {isAdmin && (
                      <td className={td}>
                        <AdjustStockForm
                          medicationId={med.id}
                          medicationName={`${med.name} ${med.strength}`}
                          currentStock={med.stockQuantity}
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
              {medications.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-4 py-14 text-center text-sm text-slate-500">
                    No products match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
          <Legend swatch="bg-brand-500" label="Healthy" />
          <Legend swatch="bg-amber-500" label="Within 25% of reorder level" />
          <Legend swatch="bg-red-500" label="At or below reorder level" />
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-0.5 rounded-full bg-slate-500" />
            Reorder level · full bar = {GAUGE_REORDER_MULTIPLE}× reorder level · NDCs are fictional
          </span>
        </div>
      </div>
    </>
  );
}

function SummaryStat({
  icon: Icon,
  label,
  value,
  hint,
  tint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  tint: string;
}) {
  return (
    <div className={`${card} flex items-center gap-4 p-4`}>
      <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${tint}`}>
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <div className="text-xl font-semibold tabular-nums">{value}</div>
        <div className="truncate text-xs text-slate-500">{hint}</div>
      </div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={`h-1.5 w-4 rounded-full ${swatch}`} />
      {label}
    </span>
  );
}
