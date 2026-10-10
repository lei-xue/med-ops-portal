import Link from "next/link";

import { auth } from "@/auth";
import { StatusBadge } from "@/components/badges";
import { RelativeTime } from "@/components/RelativeTime";
import { btnPrimary, btnSecondary, fieldSm, panel, td, th } from "@/components/ui";
import { ORDER_STATUSES, type UserRole } from "@/db/schema";
import { attentionStatusesFor, STATUS_LABELS } from "@/lib/permissions";
import {
  countOrdersByStatus,
  listOrders,
  type OrderRow as OrderRowData,
} from "@/lib/queries";
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

  const [{ rows, total, pageCount }, counts] = await Promise.all([
    listOrders({ q, status, page, pageSize: 10 }),
    countOrdersByStatus(),
  ]);
  const role = session!.user.role;
  const attention = attentionStatusesFor(role);
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0);

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-mono text-ink-3">
            {total} order{total === 1 ? "" : "s"}
            {status ? ` · ${STATUS_LABELS[status]}` : ""}
            {q ? ` · matching “${q}”` : ""}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Orders</h1>
        </div>
        <Link href="/orders/new" className={btnPrimary}>
          New order <span aria-hidden>+</span>
        </Link>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <nav
          aria-label="Filter by status"
          className="flex overflow-x-auto border border-rule bg-card"
        >
          <FilterTab
            href={buildHref({ status: undefined, page: undefined })}
            active={!status}
            label="All"
            count={allCount}
          />
          {ORDER_STATUSES.map((s) => (
            <FilterTab
              key={s}
              href={buildHref({ status: s, page: undefined })}
              active={status === s}
              label={STATUS_LABELS[s]}
              count={counts[s]}
              attention={attention.includes(s) && counts[s] > 0}
            />
          ))}
        </nav>

        <form action="/orders" className="flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            aria-label="Search patient or medication"
            placeholder="Search patient or medication…"
            className={`${fieldSm} w-full sm:w-72`}
          />
          <button type="submit" className={btnSecondary}>
            Search
          </button>
        </form>
      </div>

      <div className={`overflow-x-auto ${panel}`}>
        <table className="w-full min-w-3xl text-left text-sm">
          <thead className="border-b border-rule bg-sunken">
            <tr>
              <th className={th}>Order</th>
              <th className={th}>Patient</th>
              <th className={th}>Medication</th>
              <th className={`${th} text-right`}>Qty</th>
              <th className={th}>Stage</th>
              <th className={th}>Created</th>
              <th className={`${th} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule-soft">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-ink-2">
                  No orders match the current filters.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <OrderRow
                key={row.id}
                row={row}
                role={role}
                attention={attention.includes(row.status)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="label-mono text-ink-3">
            Page {page} / {pageCount}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildHref({ page: String(page - 1) })}
                className={btnSecondary}
              >
                ← Previous
              </Link>
            )}
            {page < pageCount && (
              <Link
                href={buildHref({ page: String(page + 1) })}
                className={btnSecondary}
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterTab({
  href,
  active,
  label,
  count,
  attention = false,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
  attention?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`focus-ink flex items-center gap-2 border-r border-rule px-3 py-2 text-sm whitespace-nowrap last:border-r-0 ${
        active ? "bg-ink text-on-ink" : "text-ink-2 hover:bg-sunken hover:text-ink"
      }`}
    >
      {label}
      <span
        className={`font-mono text-xs tabular-nums ${
          active ? "opacity-70" : attention ? "font-semibold text-signal-ink" : "text-ink-3"
        }`}
      >
        {count}
      </span>
    </Link>
  );
}

function OrderRow({
  row,
  role,
  attention,
}: {
  row: OrderRowData;
  role: UserRole;
  attention: boolean;
}) {
  return (
    <tr className="group hover:bg-sunken">
      <td
        className={`${td} border-l-4 font-mono text-xs text-ink-3 ${
          attention ? "border-l-signal" : "border-l-transparent"
        }`}
      >
        #{row.id}
      </td>
      <td className={td}>
        <span className="font-medium">{row.patientName}</span>
        {row.notes && (
          <span className="block text-xs text-ink-3">{row.notes}</span>
        )}
      </td>
      <td className={td}>
        {row.medicationName}
        <span className="block text-xs text-ink-3">
          {row.medicationStrength} · {row.medicationForm}
        </span>
      </td>
      <td className={`${td} text-right font-mono tabular-nums`}>
        {row.quantity}
      </td>
      <td className={td}>
        <StatusBadge status={row.status} attention={attention} />
      </td>
      <td className={`${td} text-xs text-ink-3`}>
        <RelativeTime value={row.createdAt} className="text-ink-2" />
        <span className="block">by {row.createdByName}</span>
      </td>
      <td className={`${td} text-right`}>
        <OrderRowActions orderId={row.id} status={row.status} role={role} />
      </td>
    </tr>
  );
}
