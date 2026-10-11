import Link from "next/link";

import OrderRowActions from "@/app/orders/OrderRowActions";
import { Avatar } from "@/components/Avatar";
import { ProductBadges, StatusBadge } from "@/components/badges";
import { RelativeTime } from "@/components/RelativeTime";
import { recordLink, td, th } from "@/components/ui";
import type { UserRole } from "@/db/schema";
import { formatQuantity } from "@/lib/format";
import type { OrderRow } from "@/lib/queries";

export function orderCode(id: number): string {
  return `ORD-${String(id).padStart(5, "0")}`;
}

type Column = "patient" | "prescriber" | "medication";

/**
 * Orders with every party linked to its own record. Detail pages hide the
 * column for the record they belong to (a patient page needn't repeat the
 * patient on every row).
 */
export function OrdersTable({
  rows,
  role,
  hide = [],
  empty = "No orders match the current filters.",
}: {
  rows: OrderRow[];
  role: UserRole;
  hide?: Column[];
  empty?: string;
}) {
  const show = (c: Column) => !hide.includes(c);
  const columns =
    4 +
    Number(show("patient")) +
    Number(show("prescriber")) +
    Number(show("medication"));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-4xl text-left text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className={th}>Order</th>
            {show("patient") && <th className={th}>Patient</th>}
            {show("medication") && <th className={th}>Medication</th>}
            {show("prescriber") && <th className={th}>Prescriber</th>}
            <th className={`${th} text-right`}>Qty</th>
            <th className={th}>Status</th>
            <th className={`${th} text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns} className="px-4 py-14 text-center text-sm text-slate-500">
                {empty}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50/70">
              <td className={`${td} whitespace-nowrap`}>
                <Link
                  href={`/orders/${row.id}`}
                  className="font-mono text-xs text-brand-700 hover:underline"
                >
                  {orderCode(row.id)}
                </Link>
                <div title={`Entered by ${row.createdByName}`}>
                  <RelativeTime value={row.createdAt} className="text-slate-500" />
                </div>
              </td>
              {show("patient") && (
                <td className={td}>
                  <div className="flex items-center gap-3">
                    <Avatar name={row.patientName} />
                    <div className="min-w-0">
                      <Link
                        href={`/patients/${row.patientId}`}
                        className={`${recordLink} whitespace-nowrap`}
                      >
                        {row.patientName}
                      </Link>
                      <div className="font-mono text-[11px] text-slate-500">
                        {row.patientMrn}
                      </div>
                    </div>
                  </div>
                </td>
              )}
              {show("medication") && (
                <td className={td}>
                  <div className="flex items-center gap-2">
                    <Link href={`/medications/${row.medicationId}`} className={recordLink}>
                      {row.medicationName}
                    </Link>
                    <ProductBadges
                      rxStatus={row.medicationRxStatus}
                      schedule={row.medicationSchedule}
                    />
                  </div>
                  <div className="text-xs text-slate-500">
                    {row.medicationStrength} · {row.medicationForm}
                  </div>
                </td>
              )}
              {show("prescriber") && (
                <td className={td}>
                  {row.prescriberId ? (
                    <Link
                      href={`/prescribers/${row.prescriberId}`}
                      className={`${recordLink} whitespace-nowrap`}
                    >
                      {row.prescriberName}, {row.prescriberCredentials}
                    </Link>
                  ) : (
                    <span className="text-xs whitespace-nowrap text-slate-500">
                      OTC · no prescriber
                    </span>
                  )}
                </td>
              )}
              <td className={`${td} text-right whitespace-nowrap`}>
                <span className="tabular-nums">
                  {formatQuantity(row.quantity, row.stockUnit)}
                </span>
                {row.refills > 0 && (
                  <div className="text-xs text-slate-500">
                    {row.refills} refill{row.refills === 1 ? "" : "s"}
                  </div>
                )}
              </td>
              <td className={td}>
                <StatusBadge status={row.status} />
              </td>
              <td className={`${td} text-right`}>
                <OrderRowActions orderId={row.id} status={row.status} role={role} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
