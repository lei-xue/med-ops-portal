import Link from "next/link";

import { auth } from "@/auth";
import { StatusBadge } from "@/components/badges";
import { ORDER_STATUSES, type UserRole } from "@/db/schema";
import { formatDateTime } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/permissions";
import { listOrders, type OrderRow as OrderRowData } from "@/lib/queries";
import OrderRowActions from "./OrderRowActions";

interface OrdersPageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
  }>;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const session = await auth();
  const params = await searchParams;

  const status = ORDER_STATUSES.find((s) => s === params.status) ?? undefined;
  const page = Number.parseInt(params.page ?? "1", 10) || 1;
  const q = params.q ?? "";

  const { rows, total, pageCount } = await listOrders({
    q,
    status,
    page,
    pageSize: 10,
  });

  // Build query strings for filter pills / pagination while preserving state.
  const buildHref = (overrides: Record<string, string | undefined>) => {
    const usp = new URLSearchParams();
    const merged = { q, status, ...overrides };
    if (merged.q) usp.set("q", merged.q);
    if (merged.status) usp.set("status", merged.status);
    const p = overrides.page ?? (page > 1 ? String(page) : undefined);
    if (p && p !== "1") usp.set("page", p);
    const qs = usp.toString();
    return qs ? `/orders?${qs}` : "/orders";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Orders</h1>
          <p className="text-sm text-slate-500">
            {total} order{total === 1 ? "" : "s"}
            {status ? ` · ${STATUS_LABELS[status]}` : ""}
          </p>
        </div>
        <Link
          href="/orders/new"
          className="rounded-md bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-500"
        >
          New order
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form action="/orders" className="flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search patient or medication…"
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none sm:w-72"
          />
          <button
            type="submit"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-1">
          <Link
            href={buildHref({ status: undefined, page: undefined })}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              !status
                ? "bg-teal-600 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 ring-inset hover:bg-slate-50"
            }`}
          >
            All
          </Link>
          {ORDER_STATUSES.map((s) => (
            <Link
              key={s}
              href={buildHref({ status: s, page: undefined })}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                status === s
                  ? "bg-teal-600 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 ring-inset hover:bg-slate-50"
              }`}
            >
              {STATUS_LABELS[s]}
            </Link>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-2.5 font-medium">Order</th>
              <th className="px-4 py-2.5 font-medium">Patient</th>
              <th className="px-4 py-2.5 font-medium">Medication</th>
              <th className="px-4 py-2.5 font-medium">Qty</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Created</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  No orders match the current filters.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <OrderRow
                key={row.id}
                row={row}
                role={session!.user.role}
              />
            ))}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            Page {page} of {pageCount}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildHref({ page: String(page - 1) })}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
              >
                Previous
              </Link>
            )}
            {page < pageCount && (
              <Link
                href={buildHref({ page: String(page + 1) })}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OrderRow({
  row,
  role,
}: {
  row: OrderRowData;
  role: UserRole;
}) {
  return (
    <tr className="hover:bg-slate-50/60">
      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">
        #{row.id}
      </td>
      <td className="px-4 py-2.5 font-medium text-slate-900">
        {row.patientName}
        {row.notes && (
          <span className="block text-xs font-normal text-slate-400">
            {row.notes}
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-slate-700">
        {row.medicationName}
        <span className="block text-xs text-slate-400">
          {row.medicationStrength} · {row.medicationForm}
        </span>
      </td>
      <td className="px-4 py-2.5 tabular-nums text-slate-700">
        {row.quantity}
      </td>
      <td className="px-4 py-2.5">
        <StatusBadge status={row.status} />
      </td>
      <td className="px-4 py-2.5 text-xs text-slate-500">
        {formatDateTime(row.createdAt)}
        <span className="block">by {row.createdByName}</span>
      </td>
      <td className="px-4 py-2.5 text-right">
        <OrderRowActions orderId={row.id} status={row.status} role={role} />
      </td>
    </tr>
  );
}
