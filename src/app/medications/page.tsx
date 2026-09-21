import type { Metadata } from "next";

import { auth } from "@/auth";
import { LowStockBadge } from "@/components/badges";
import { formatDateTime } from "@/lib/format";
import { isLowStock } from "@/lib/permissions";
import { listMedications } from "@/lib/queries";
import AdjustStockForm from "./AdjustStockForm";

export const metadata: Metadata = { title: "Inventory" };

export default async function MedicationsPage() {
  const session = await auth();
  const isAdmin = session?.user.role === "admin";
  const medications = await listMedications();
  const lowStockCount = medications.filter(isLowStock).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Inventory</h1>
        <p className="text-sm text-slate-500">
          {medications.length} medications · {lowStockCount} at or below
          reorder threshold
          {isAdmin && " · admins can adjust stock inline"}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-2.5 font-medium">Medication</th>
              <th className="px-4 py-2.5 font-medium">NDC (fictional)</th>
              <th className="px-4 py-2.5 font-medium">On hand</th>
              <th className="px-4 py-2.5 font-medium">Reorder at</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Added</th>
              {isAdmin && (
                <th className="px-4 py-2.5 text-right font-medium">
                  Adjust stock
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {medications.map((med) => {
              const low = isLowStock(med);
              return (
                <tr
                  key={med.id}
                  className={low ? "bg-rose-50/60 hover:bg-rose-50" : "hover:bg-slate-50/60"}
                >
                  <td className="px-4 py-2.5 font-medium text-slate-900">
                    {med.name}
                    <span className="block text-xs font-normal text-slate-400">
                      {med.strength} · {med.dosageForm}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">
                    {med.ndc}
                  </td>
                  <td className="px-4 py-2.5 font-semibold tabular-nums">
                    <span className={low ? "text-rose-700" : "text-slate-800"}>
                      {med.stockQuantity}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-slate-500">
                    {med.reorderThreshold}
                  </td>
                  <td className="px-4 py-2.5">
                    {low ? (
                      <LowStockBadge />
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/20 ring-inset">
                        In stock
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">
                    {formatDateTime(med.createdAt)}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-2.5">
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
                <td colSpan={isAdmin ? 7 : 6} className="px-4 py-8 text-center text-slate-500">
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
