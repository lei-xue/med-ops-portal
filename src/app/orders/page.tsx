import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { OrdersTable } from "@/components/OrdersTable";
import { PageHeader } from "@/components/PageHeader";
import {
  btnPrimary,
  btnSecondary,
  btnSecondarySm,
  card,
  fieldSm,
} from "@/components/ui";
import { ORDER_STATUSES } from "@/db/schema";
import { requirePageSession } from "@/lib/pageSession";
import { STATUS_LABELS } from "@/lib/permissions";
import { countOrdersByStatus, listOrders } from "@/lib/queries";

interface OrdersPageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
  }>;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const session = await requirePageSession();
  const params = await searchParams;

  const status = ORDER_STATUSES.find((s) => s === params.status) ?? undefined;
  const page = Number.parseInt(params.page ?? "1", 10) || 1;
  const q = params.q ?? "";

  const [{ rows, total, pageCount }, counts] = await Promise.all([
    listOrders({ q, status, page, pageSize: 10 }),
    countOrdersByStatus(),
  ]);
  const role = session.user.role;
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0);

  // Build query strings for filter tabs / pagination while preserving state.
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

  if (page > pageCount) redirect(buildHref({ page: String(pageCount) }));

  return (
    <>
      <PageHeader
        title="Medication orders"
        description="Every order links to its patient, prescriber and product. Track it from intake through verification, fill and hand-off."
        actions={
          <Link href="/orders/new" className={btnPrimary}>
            <Plus aria-hidden className="size-4" />
            New order
          </Link>
        }
      />

      <div className={`${card} overflow-hidden`}>
        <nav
          aria-label="Filter by status"
          className="flex gap-1 overflow-x-auto border-b border-slate-200 px-3"
        >
          <FilterTab
            href={buildHref({ status: undefined, page: undefined })}
            active={!status}
            label="All orders"
            count={allCount}
          />
          {ORDER_STATUSES.map((s) => (
            <FilterTab
              key={s}
              href={buildHref({ status: s, page: undefined })}
              active={status === s}
              label={STATUS_LABELS[s]}
              count={counts[s]}
            />
          ))}
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <form action="/orders" className="relative flex w-full gap-2 sm:w-auto">
            {status && <input type="hidden" name="status" value={status} />}
            <Search
              aria-hidden
              className="pointer-events-none absolute top-2.5 left-3 size-4 text-slate-400"
            />
            <input
              type="search"
              name="q"
              defaultValue={q}
              aria-label="Search patient, MRN, drug or prescriber"
              placeholder="Search patient, MRN, drug or prescriber"
              className={`${fieldSm} w-full pl-9 sm:w-80`}
            />
            <button type="submit" className={btnSecondary}>
              Search
            </button>
          </form>
          <span className="text-xs text-slate-500">
            Showing {rows.length} of {total} order{total === 1 ? "" : "s"}
            {q ? ` matching “${q}”` : ""}
          </span>
        </div>

        <div className="border-t border-slate-200">
          <OrdersTable rows={rows} role={role} />
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
            <span className="text-xs text-slate-500">
              Page {page} of {pageCount}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={buildHref({ page: String(page - 1) })}
                  className={btnSecondarySm}
                >
                  Previous
                </Link>
              )}
              {page < pageCount && (
                <Link
                  href={buildHref({ page: String(page + 1) })}
                  className={btnSecondarySm}
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function FilterTab({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-3 text-sm whitespace-nowrap ${
        active
          ? "border-brand-600 font-medium text-brand-700"
          : "border-transparent text-slate-500 hover:text-slate-800"
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 py-px text-xs tabular-nums ${
          active ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500"
        }`}
      >
        {count}
      </span>
    </Link>
  );
}
