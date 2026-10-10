import { Boxes, Pill, TriangleAlert, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";

import { StockBadge } from "@/components/badges";
import { PageHeader } from "@/components/PageHeader";
import { StockGauge } from "@/components/StockGauge";
import { card, td, th } from "@/components/ui";
import { requirePageSession } from "@/lib/pageSession";
import { isLowStock } from "@/lib/permissions";
import { listMedications } from "@/lib/queries";
import AdjustStockForm from "./AdjustStockForm";

export const metadata: Metadata = { title: "Inventory" };

export default async function MedicationsPage() {
  const session = await requirePageSession();
  const isAdmin = session.user.role === "admin";
  const medications = await listMedications();
  const lowStockCount = medications.filter(isLowStock).length;
  const totalUnits = medications.reduce((sum, m) => sum + m.stockQuantity, 0);
  // Shared scale so bars are comparable across rows.
  const scale = Math.max(
    ...medications.map((m) => Math.max(m.stockQuantity, m.reorderThreshold)),
    1,
  );

  return (
    <>
      <PageHeader
        title="Inventory"
        description={
          isAdmin
            ? "Stock on hand against reorder thresholds. As an admin you can adjust counts inline; every change is audited."
            : "Stock on hand against reorder thresholds. Filling an order decrements stock atomically."
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryStat
          icon={Pill}
          label="Medications stocked"
          value={medications.length}
          tint="bg-brand-50 text-brand-600"
        />
        <SummaryStat
          icon={Boxes}
          label="Units on hand"
          value={totalUnits.toLocaleString("en-US")}
          tint="bg-slate-100 text-slate-600"
        />
        <SummaryStat
          icon={TriangleAlert}
          label="Below reorder level"
          value={lowStockCount}
          tint="bg-red-50 text-red-600"
        />
      </div>

      <div className={`${card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-3xl text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Medication</th>
                <th className={th}>NDC</th>
                <th className={`${th} w-1/3`}>Stock level</th>
                <th className={th}>Status</th>
                {isAdmin && (
                  <th className={`${th} text-right`}>Adjust stock</th>
                )}
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
                            low
                              ? "bg-red-50 text-red-600"
                              : "bg-brand-50 text-brand-600"
                          }`}
                        >
                          <Pill aria-hidden className="size-4" />
                        </span>
                        <div>
                          <div className="font-medium">{med.name}</div>
                          <div className="text-xs text-slate-500">
                            {med.strength} · {med.dosageForm}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={`${td} font-mono text-xs whitespace-nowrap text-slate-500`}>
                      {med.ndc}
                    </td>
                    <td className={td}>
                      <div className="mb-1.5 flex items-baseline justify-between text-xs">
                        <span>
                          <span
                            className={`text-sm font-semibold tabular-nums ${
                              low ? "text-red-700" : "text-slate-900"
                            }`}
                          >
                            {med.stockQuantity.toLocaleString("en-US")}
                          </span>{" "}
                          <span className="text-slate-500">units</span>
                        </span>
                        <span className="text-slate-500 tabular-nums">
                          reorder at {med.reorderThreshold}
                        </span>
                      </div>
                      <StockGauge
                        stock={med.stockQuantity}
                        threshold={med.reorderThreshold}
                        scale={scale}
                      />
                    </td>
                    <td className={td}>
                      <StockBadge low={low} />
                    </td>
                    {isAdmin && (
                      <td className={td}>
                        <AdjustStockForm
                          medicationId={med.id}
                          medicationName={med.name}
                          currentStock={med.stockQuantity}
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
              {medications.length === 0 && (
                <tr>
                  <td
                    colSpan={isAdmin ? 5 : 4}
                    className="px-4 py-14 text-center text-sm text-slate-500"
                  >
                    No medications in inventory. Run <code>npm run db:seed</code>.
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
            Reorder threshold · NDCs are fictional
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
  tint,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  tint: string;
}) {
  return (
    <div className={`${card} flex items-center gap-4 p-4`}>
      <span className={`grid size-10 place-items-center rounded-lg ${tint}`}>
        <Icon aria-hidden className="size-5" />
      </span>
      <div>
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <div className="text-xl font-semibold tabular-nums">{value}</div>
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
