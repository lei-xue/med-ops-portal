import Link from "next/link";

import { auth } from "@/auth";
import { KpiCard } from "@/components/KpiCard";
import { RoleBadge } from "@/components/badges";
import { formatDateTime } from "@/lib/format";
import { getDashboardStats, getRecentAudit } from "@/lib/queries";

function describeAudit(row: {
  action: string;
  entityType: string;
  entityId: number;
  details: unknown;
}): string {
  const details = (row.details ?? {}) as Record<string, unknown>;
  if (row.action === "order.create") {
    return `created order #${row.entityId} for ${String(details.patientName ?? "patient")}`;
  }
  if (row.action === "inventory.adjust") {
    return `adjusted stock of ${String(details.medicationName ?? "medication")} from ${String(details.from ?? "?")} to ${String(details.to ?? "?")}`;
  }
  if (row.action === "order.fill") {
    return `filled order #${row.entityId} (qty ${String(details.quantity ?? "?")}), stock ${String(details.stockBefore ?? "?")} → ${String(details.stockAfter ?? "?")}`;
  }
  if (row.action === "user.login") {
    return "signed in";
  }
  if (typeof details.from === "string" && typeof details.to === "string") {
    return `moved order #${row.entityId} from ${details.from} to ${details.to}`;
  }
  return `updated ${row.entityType} #${row.entityId}`;
}

export default async function DashboardPage() {
  const session = await auth();
  const [stats, feed] = await Promise.all([
    getDashboardStats(),
    getRecentAudit(10),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Good day, {session?.user.name ?? "friend"}
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Medication operations overview — {session?.user.email}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Pending orders"
          value={stats.pending}
          href="/orders?status=pending"
          tone="teal"
          hint="awaiting pharmacist verification"
        />
        <KpiCard
          label="Verified — awaiting fill"
          value={stats.verifiedAwaitingFill}
          href="/orders?status=verified"
          tone="sky"
          hint="ready for the fill bench"
        />
        <KpiCard
          label="Completed today"
          value={stats.completedToday}
          href="/orders?status=completed"
          tone="emerald"
        />
        <KpiCard
          label="Low-stock medications"
          value={stats.lowStock}
          href="/medications"
          tone="rose"
          hint="at or below reorder threshold"
        />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Recent activity
          </h2>
          <Link
            href="/audit"
            className="text-xs font-medium text-teal-700 hover:text-teal-600"
          >
            View full audit log →
          </Link>
        </div>
        {feed.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            No activity recorded yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {feed.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm"
              >
                <span className="w-32 shrink-0 text-xs text-slate-400 tabular-nums">
                  {formatDateTime(row.createdAt)}
                </span>
                <span className="font-medium text-slate-800">
                  {row.actorName}
                </span>
                <RoleBadge role={row.actorRole} />
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
                  {row.action}
                </code>
                <span className="text-slate-600">{describeAudit(row)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
