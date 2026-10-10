import Link from "next/link";

import { auth } from "@/auth";
import { RoleBadge, StatusBadge } from "@/components/badges";
import { RelativeTime } from "@/components/RelativeTime";
import { StockGauge } from "@/components/StockGauge";
import { panel } from "@/components/ui";
import type { OrderStatus, UserRole } from "@/db/schema";
import { describeAudit } from "@/lib/audit";
import { attentionStatusesFor, isLowStock } from "@/lib/permissions";
import {
  getDashboardStats,
  getRecentAudit,
  listMedications,
  listOrders,
} from "@/lib/queries";
import OrderRowActions from "./orders/OrderRowActions";

const todayFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function DashboardPage() {
  const session = await auth();
  const role: UserRole = session?.user.role ?? "technician";
  const attention = attentionStatusesFor(role);

  const [stats, queue, medications, feed] = await Promise.all([
    getDashboardStats(),
    listOrders({ statuses: attention, pageSize: 6 }),
    listMedications(),
    getRecentAudit(8, { excludeLogins: true }),
  ]);

  const lowStock = medications.filter(isLowStock);
  const stockScale = Math.max(
    ...lowStock.map((m) => Math.max(m.stockQuantity, m.reorderThreshold * 1.5)),
    1,
  );

  const stages: {
    status: OrderStatus;
    label: string;
    value: number;
    hint: string;
  }[] = [
    {
      status: "pending",
      label: "Pending",
      value: stats.pending,
      hint: "awaiting pharmacist verification",
    },
    {
      status: "verified",
      label: "Verified",
      value: stats.verifiedAwaitingFill,
      hint: "ready for the fill bench",
    },
    {
      status: "filled",
      label: "Filled",
      value: stats.filledAwaitingPickup,
      hint: "awaiting hand-off",
    },
    {
      status: "completed",
      label: "Completed",
      value: stats.completedToday,
      hint: "closed out today",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-mono text-ink-3">
            {todayFormat.format(new Date())} · shift overview
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Good day, {session?.user.name?.split(" ")[0] ?? "friend"}.
          </h1>
        </div>
        <p className="text-sm text-ink-2">
          <span className="font-mono font-semibold text-ink tabular-nums">
            {queue.total}
          </span>{" "}
          order{queue.total === 1 ? "" : "s"} waiting on you
        </p>
      </div>

      {/* The order state machine, drawn as the page's main figure. */}
      <section aria-label="Order pipeline" className={panel}>
        <ol className="grid grid-cols-2 md:grid-cols-4">
          {stages.map((stage, index) => {
            const yourMove =
              attention.includes(stage.status) && stage.value > 0;
            return (
              <li
                key={stage.status}
                className={`relative border-rule ${
                  index % 2 === 1 ? "border-l" : ""
                } ${index >= 2 ? "border-t md:border-t-0" : ""} ${
                  index === 2 ? "md:border-l" : ""
                }`}
              >
                <Link
                  href={`/orders?status=${stage.status}`}
                  className={`focus-ink group block h-full border-t-4 p-5 transition-colors hover:bg-sunken ${
                    yourMove ? "border-signal" : "border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="label-mono text-ink-3">
                      0{index + 1} · {stage.label}
                    </span>
                    {yourMove && (
                      <span className="label-mono font-semibold text-signal-ink">
                        Your move
                      </span>
                    )}
                  </div>
                  <div className="mt-3 font-mono text-5xl font-medium tracking-tight tabular-nums">
                    {stage.value}
                  </div>
                  <div className="mt-2 text-sm text-ink-2">{stage.hint}</div>
                </Link>
                {index < stages.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute top-1/2 -right-3 z-10 hidden size-6 -translate-y-1/2 place-items-center border border-rule bg-card font-mono text-xs text-ink-3 md:grid"
                  >
                    →
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <div className="grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <SectionHead
            title="Waiting on you"
            href="/orders"
            linkLabel="All orders"
          />
          <div className={panel}>
            {queue.rows.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-ink-2">
                Nothing in your queue. Bench is clear.
              </p>
            ) : (
              <ul className="divide-y divide-rule-soft">
                {queue.rows.map((order) => (
                  <li
                    key={order.id}
                    className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 px-5 py-4 sm:grid-cols-[3rem_1fr_auto_auto]"
                  >
                    <span className="font-mono text-xs text-ink-3">
                      #{order.id}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {order.patientName}
                      </div>
                      <div className="truncate text-sm text-ink-2">
                        {order.medicationName}{" "}
                        <span className="text-ink-3">
                          {order.medicationStrength} ×{" "}
                          <span className="font-mono">{order.quantity}</span>
                        </span>
                      </div>
                    </div>
                    <div className="col-start-2 sm:col-start-auto">
                      <StatusBadge status={order.status} attention />
                    </div>
                    <div className="col-start-2 sm:col-start-auto">
                      <OrderRowActions
                        orderId={order.id}
                        status={order.status}
                        role={role}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="space-y-8">
          <section>
            <SectionHead
              title="Stock watch"
              href="/medications"
              linkLabel="Inventory"
            />
            <div className={panel}>
              {lowStock.length === 0 ? (
                <p className="px-5 py-6 text-sm text-ink-2">
                  Everything is above its reorder line.
                </p>
              ) : (
                <ul className="divide-y divide-rule-soft">
                  {lowStock.map((med) => (
                    <li key={med.id} className="space-y-2 px-5 py-4">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-medium">{med.name}</span>
                        <span className="font-mono text-sm text-signal-ink tabular-nums">
                          {med.stockQuantity}
                          <span className="text-ink-3">
                            {" "}
                            / {med.reorderThreshold}
                          </span>
                        </span>
                      </div>
                      <StockGauge
                        stock={med.stockQuantity}
                        threshold={med.reorderThreshold}
                        scale={stockScale}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section>
            <SectionHead
              title="Activity"
              href={role === "technician" ? undefined : "/audit"}
              linkLabel="Audit log"
            />
            {feed.length === 0 ? (
              <p className="text-sm text-ink-2">No activity recorded yet.</p>
            ) : (
              <ol className="relative space-y-4 border-l border-rule pl-5">
                {feed.map((row) => (
                  <li key={row.id} className="relative text-sm">
                    <span
                      aria-hidden
                      className="absolute top-1.5 -left-[23px] size-[7px] bg-ink"
                    />
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium">{row.actorName}</span>
                      <RoleBadge role={row.actorRole} />
                      <RelativeTime
                        value={row.createdAt}
                        className="ml-auto text-ink-3"
                      />
                    </div>
                    <p className="mt-0.5 text-ink-2">{describeAudit(row)}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function SectionHead({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href?: string;
  linkLabel: string;
}) {
  return (
    <div className="perforation mb-3 flex items-baseline justify-between pb-2">
      <h2 className="label-mono font-semibold text-ink">{title}</h2>
      {href && (
        <Link
          href={href}
          className="focus-ink label-mono text-ink-3 hover:text-ink"
        >
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}
