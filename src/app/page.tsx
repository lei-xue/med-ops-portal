import {
  ArrowRight,
  CircleCheck,
  Clock,
  Pill,
  Plus,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/Avatar";
import { STATUS_STYLES, StatusBadge } from "@/components/badges";
import { AUDIT_FALLBACK, AUDIT_ICONS, STATUS_ICONS } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { RelativeTime } from "@/components/RelativeTime";
import { StockGauge } from "@/components/StockGauge";
import { btnPrimary, card, cardHeader, td, th } from "@/components/ui";
import type { OrderStatus, UserRole } from "@/db/schema";
import { describeAudit } from "@/lib/audit";
import { formatLongDate } from "@/lib/format";
import {
  attentionStatusesFor,
  isLowStock,
  STATUS_LABELS,
} from "@/lib/permissions";
import {
  countOrdersByStatus,
  getDashboardStats,
  getRecentAudit,
  listMedications,
  listOrders,
} from "@/lib/queries";
import { requirePageSession } from "@/lib/pageSession";
import OrderRowActions from "./orders/OrderRowActions";

const PIPELINE: { status: OrderStatus; hint: string }[] = [
  { status: "pending", hint: "Awaiting pharmacist verification" },
  { status: "verified", hint: "Ready for the fill bench" },
  { status: "filled", hint: "Awaiting hand-off" },
  { status: "completed", hint: "Dispensed to patient" },
];

export default async function DashboardPage() {
  const session = await requirePageSession();
  const role: UserRole = session.user.role;
  const attention = attentionStatusesFor(role);

  const [stats, counts, queue, medications, feed] = await Promise.all([
    getDashboardStats(),
    countOrdersByStatus(),
    listOrders({ statuses: attention, pageSize: 6 }),
    listMedications(),
    // The audit log itself is pharmacist/admin only; technicians see just
    // their own actions here so the feed doesn't bypass that boundary.
    getRecentAudit(6, {
      excludeLogins: true,
      actorId: role === "technician" ? Number(session.user.id) : undefined,
    }),
  ]);

  const lowStock = medications.filter(isLowStock);
  const open = counts.pending + counts.verified + counts.filled;

  return (
    <>
      <PageHeader
        eyebrow={formatLongDate(new Date())}
        title={`Welcome back, ${session.user.name?.split(" ")[0] ?? "there"}`}
        description="Here's what needs attention on the pharmacy floor today."
        actions={
          <Link href="/orders/new" className={btnPrimary}>
            <Plus aria-hidden className="size-4" />
            New order
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          label="Awaiting verification"
          value={counts.pending}
          footnote="Needs pharmacist review"
          icon={Clock}
          tint="bg-amber-50 text-amber-600"
          href="/orders?status=pending"
          yours={attention.includes("pending")}
        />
        <KpiCard
          label="Ready to fill"
          value={counts.verified}
          footnote="Verified, awaiting fill"
          icon={ShieldCheck}
          tint="bg-brand-50 text-brand-600"
          href="/orders?status=verified"
          yours={attention.includes("verified")}
        />
        <KpiCard
          label="Completed today"
          value={stats.completedToday}
          footnote={`${counts.completed} completed all-time`}
          icon={CircleCheck}
          tint="bg-emerald-50 text-emerald-600"
          href="/orders?status=completed"
        />
        <KpiCard
          label="Below reorder level"
          value={stats.lowStock}
          footnote={`of ${medications.length} stocked medications`}
          icon={TriangleAlert}
          tint="bg-red-50 text-red-600"
          href="/medications"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className={`${card} lg:col-span-2`}>
          <div className={cardHeader}>
            <div>
              <h2 className="text-sm font-semibold">Order pipeline</h2>
              <p className="text-xs text-slate-500">
                Every order moves through four checked stages
              </p>
            </div>
            <span className="text-xs text-slate-500">
              <span className="font-semibold text-slate-900 tabular-nums">
                {open}
              </span>{" "}
              open · {counts.cancelled} cancelled
            </span>
          </div>
          <div className="px-5 pt-6 pb-5">
            <ol className="grid grid-cols-2 gap-y-6 sm:grid-cols-4">
              {PIPELINE.map((stage, index) => {
                const Icon = STATUS_ICONS[stage.status];
                const count = counts[stage.status];
                const active = count > 0;
                return (
                  <li key={stage.status} className="relative">
                    {index < PIPELINE.length - 1 && (
                      <span
                        aria-hidden
                        className="absolute top-5 left-12 hidden h-px w-[calc(100%-3.5rem)] bg-slate-200 sm:block"
                      />
                    )}
                    <Link
                      href={`/orders?status=${stage.status}`}
                      className="group block pr-4"
                    >
                      <span
                        className={`relative grid size-10 place-items-center rounded-full ring-4 ring-white ${
                          active
                            ? `${STATUS_STYLES[stage.status].dot} text-white`
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        <Icon aria-hidden className="size-5" />
                      </span>
                      <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-2xl font-semibold tabular-nums">
                          {count}
                        </span>
                        <span className="text-sm font-medium text-slate-700 group-hover:text-brand-600">
                          {STATUS_LABELS[stage.status]}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {stage.hint}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ol>

            {open > 0 && (
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                  <span>Open orders by stage</span>
                  <span className="tabular-nums">{open} total</span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                  {(["pending", "verified", "filled"] as const).map((s) =>
                    counts[s] > 0 ? (
                      <div
                        key={s}
                        title={`${STATUS_LABELS[s]}: ${counts[s]}`}
                        className={`${STATUS_STYLES[s].dot} border-r-2 border-white last:border-r-0`}
                        style={{ width: `${(counts[s] / open) * 100}%` }}
                      />
                    ) : null,
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className={card}>
          <div className={cardHeader}>
            <div>
              <h2 className="text-sm font-semibold">Inventory alerts</h2>
              <p className="text-xs text-slate-500">
                At or below reorder threshold
              </p>
            </div>
            <Link
              href="/medications"
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              View all
            </Link>
          </div>
          {lowStock.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-10 text-center text-sm text-slate-500">
              <CircleCheck aria-hidden className="size-6 text-emerald-500" />
              All medications are above their reorder level.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {lowStock.map((med) => (
                <li key={med.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-red-50 text-red-600">
                      <Pill aria-hidden className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {med.name}
                        </span>
                        <span className="text-xs whitespace-nowrap text-slate-500 tabular-nums">
                          <span className="font-semibold text-red-700">
                            {med.stockQuantity}
                          </span>{" "}
                          / {med.reorderThreshold}
                        </span>
                      </div>
                      <div className="mb-2 text-xs text-slate-500">
                        {med.strength} · {med.dosageForm}
                      </div>
                      <StockGauge
                        stock={med.stockQuantity}
                        threshold={med.reorderThreshold}
                        scale={med.reorderThreshold * 1.5}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`${card} overflow-hidden lg:col-span-2`}>
          <div className={cardHeader}>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Your work queue</h2>
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 tabular-nums">
                {queue.total}
              </span>
            </div>
            <Link
              href="/orders"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              All orders <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          </div>
          {queue.rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center text-sm text-slate-500">
              <CircleCheck aria-hidden className="size-6 text-emerald-500" />
              Nothing is waiting on you right now.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-xl text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className={th}>Patient</th>
                    <th className={th}>Medication</th>
                    <th className={th}>Status</th>
                    <th className={`${th} text-right`}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {queue.rows.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/70">
                      <td className={td}>
                        <div className="flex items-center gap-3">
                          <Avatar name={order.patientName} />
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {order.patientName}
                            </div>
                            <div className="font-mono text-xs text-slate-500">
                              ORD-{String(order.id).padStart(5, "0")}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={td}>
                        <div>{order.medicationName}</div>
                        <div className="text-xs text-slate-500">
                          {order.medicationStrength} · qty{" "}
                          <span className="tabular-nums">{order.quantity}</span>
                        </div>
                      </td>
                      <td className={td}>
                        <StatusBadge status={order.status} />
                      </td>
                      <td className={`${td} text-right`}>
                        <OrderRowActions
                          orderId={order.id}
                          status={order.status}
                          role={role}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={card}>
          <div className={cardHeader}>
            <h2 className="text-sm font-semibold">
              {role === "technician" ? "Your recent activity" : "Recent activity"}
            </h2>
            {role !== "technician" && (
              <Link
                href="/audit"
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                Audit log
              </Link>
            )}
          </div>
          {feed.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500">
              No activity recorded yet.
            </p>
          ) : (
            <ol className="px-5 py-4">
              {feed.map((row, index) => {
                const { icon: Icon, tint } =
                  AUDIT_ICONS[row.action] ?? AUDIT_FALLBACK;
                return (
                  <li key={row.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {index < feed.length - 1 && (
                      <span
                        aria-hidden
                        className="absolute top-8 bottom-0 left-3.5 w-px bg-slate-200"
                      />
                    )}
                    <span
                      className={`relative grid size-7 shrink-0 place-items-center rounded-full ${tint}`}
                    >
                      <Icon aria-hidden className="size-3.5" />
                    </span>
                    <div className="min-w-0 text-sm">
                      <p className="text-slate-600">
                        <span className="font-medium text-slate-900">
                          {row.actorName}
                        </span>{" "}
                        {describeAudit(row)}
                      </p>
                      <RelativeTime
                        value={row.createdAt}
                        className="text-slate-500"
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}

function KpiCard({
  label,
  value,
  footnote,
  icon: Icon,
  tint,
  href,
  yours = false,
}: {
  label: string;
  value: number;
  footnote: string;
  icon: LucideIcon;
  tint: string;
  href: string;
  yours?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`${card} group block p-4 transition-shadow hover:shadow-md sm:p-5`}
    >
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        <span className={`grid size-9 place-items-center rounded-lg ${tint}`}>
          <Icon aria-hidden className="size-4.5" />
        </span>
      </div>
      <div className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
        {value}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
        {yours && value > 0 && (
          <span className="shrink-0 rounded bg-brand-50 px-1.5 py-0.5 font-medium whitespace-nowrap text-brand-700">
            Your action
          </span>
        )}
        <span className="truncate">{footnote}</span>
      </div>
    </Link>
  );
}
