import type { Metadata } from "next";

import { auth } from "@/auth";
import { LowStockBadge } from "@/components/badges";
import { StockGauge } from "@/components/StockGauge";
import { panel, td, th } from "@/components/ui";
import { isLowStock } from "@/lib/permissions";
import { listMedications } from "@/lib/queries";
import AdjustStockForm from "./AdjustStockForm";

export const metadata: Metadata = { title: "Inventory" };

export default async function MedicationsPage() {
  const session = await auth();
  const isAdmin = session?.user.role === "admin";
  const medications = await listMedications();
  const lowStockCount = medications.filter(isLowStock).length;
  // Shared scale so bars are comparable across rows.
  const scale = Math.max(
    ...medications.map((m) => Math.max(m.stockQuantity, m.reorderThreshold)),
    1,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-mono text-ink-3">
            {medications.length} medications
            {isAdmin && " · admins can adjust stock inline"}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Inventory
          </h1>
        </div>
        <div className="flex items-center gap-5 text-sm text-ink-2">
          <span className="flex items-center gap-2">
            <span aria-hidden className="h-2 w-5 bg-ink" /> on hand
          </span>
          <span className="flex items-center gap-2">
            <span aria-hidden className="h-3 w-px bg-ink-2" /> reorder line
          </span>
          <span className="flex items-center gap-2">
            <span aria-hidden className="h-2 w-5 bg-signal" />
            <span>
              <span className="font-mono font-semibold text-ink">
                {lowStockCount}
              </span>{" "}
              at or below
            </span>
          </span>
        </div>
      </div>

      <div className={`overflow-x-auto ${panel}`}>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-rule bg-sunken">
            <tr>
              <th className={th}>Medication</th>
              <th className={th}>NDC (fictional)</th>
              <th className={`${th} w-2/5`}>Stock vs reorder line</th>
              <th className={`${th} text-right`}>On hand</th>
              <th className={`${th} text-right`}>Reorder at</th>
              {isAdmin && (
                <th className={`${th} text-right`}>Adjust stock</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-rule-soft">
            {medications.map((med) => {
              const low = isLowStock(med);
              return (
                <tr key={med.id} className="hover:bg-sunken">
                  <td className={td}>
                    <span className="flex items-center gap-2 font-medium">
                      {med.name}
                      {low && <LowStockBadge />}
                    </span>
                    <span className="block text-xs text-ink-3">
                      {med.strength} · {med.dosageForm}
                    </span>
                  </td>
                  <td className={`${td} font-mono text-xs whitespace-nowrap text-ink-2`}>
                    {med.ndc}
                  </td>
                  <td className={td}>
                    <StockGauge
                      stock={med.stockQuantity}
                      threshold={med.reorderThreshold}
                      scale={scale}
                    />
                  </td>
                  <td
                    className={`${td} text-right font-mono font-semibold tabular-nums ${
                      low ? "text-signal-ink" : ""
                    }`}
                  >
                    {med.stockQuantity}
                  </td>
                  <td className={`${td} text-right font-mono text-ink-3 tabular-nums`}>
                    {med.reorderThreshold}
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
                <td colSpan={isAdmin ? 6 : 5} className="px-4 py-12 text-center text-ink-2">
                  No medications in inventory. Run <code>npm run db:seed</code>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
