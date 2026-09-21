import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { RoleBadge } from "@/components/badges";
import type { UserRole } from "@/db/schema";
import { formatDateTime } from "@/lib/format";
import { AUDIT_ACTIONS } from "@/lib/permissions";
import { listActors, listAuditLogs } from "@/lib/queries";

export const metadata: Metadata = { title: "Audit log" };

interface AuditPageProps {
  searchParams: Promise<{
    action?: string;
    actor?: string;
    page?: string;
  }>;
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role === "technician") {
    redirect("/");
  }

  const params = await searchParams;
  const action = AUDIT_ACTIONS.find((a) => a === params.action) ?? undefined;
  const actorId = Number.parseInt(params.actor ?? "", 10) || undefined;
  const page = Number.parseInt(params.page ?? "1", 10) || 1;

  const [{ rows, total, pageCount }, actors] = await Promise.all([
    listAuditLogs({ action, actorId, page, pageSize: 20 }),
    listActors(),
  ]);

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const usp = new URLSearchParams();
    const merged = { action, actorId, ...overrides };
    if (merged.action) usp.set("action", merged.action);
    if (merged.actorId) usp.set("actor", String(merged.actorId));
    const p = overrides.page ?? (page > 1 ? String(page) : undefined);
    if (p && p !== "1") usp.set("page", p);
    const qs = usp.toString();
    return qs ? `/audit?${qs}` : "/audit";
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Audit log</h1>
        <p className="text-sm text-slate-500">
          {total} entr{total === 1 ? "y" : "ies"} — every mutation is recorded
          in the same transaction that applied it.
        </p>
      </div>

      <form
        action="/audit"
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        <select
          name="action"
          defaultValue={action ?? ""}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-teal-500 focus:outline-none"
        >
          <option value="">All actions</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          name="actor"
          defaultValue={actorId ? String(actorId) : ""}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-teal-500 focus:outline-none"
        >
          <option value="">All actors</option>
          {actors.map((actor) => (
            <option key={actor.id} value={actor.id}>
              {actor.name} ({actor.role})
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Apply filters
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-2.5 font-medium">Time</th>
              <th className="px-4 py-2.5 font-medium">Actor</th>
              <th className="px-4 py-2.5 font-medium">Action</th>
              <th className="px-4 py-2.5 font-medium">Entity</th>
              <th className="px-4 py-2.5 font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-2.5 text-xs whitespace-nowrap text-slate-500 tabular-nums">
                  {formatDateTime(row.createdAt)}
                </td>
                <td className="px-4 py-2.5">
                  <span className="font-medium text-slate-800">
                    {row.actorName}
                  </span>{" "}
                  <RoleBadge role={row.actorRole as UserRole} />
                </td>
                <td className="px-4 py-2.5">
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
                    {row.action}
                  </code>
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-600">
                  {row.entityType} #{row.entityId}
                </td>
                <td className="max-w-md px-4 py-2.5">
                  <code
                    title={JSON.stringify(row.details) ?? undefined}
                    className="block truncate font-mono text-xs text-slate-500"
                  >
                    {row.details ? JSON.stringify(row.details) : "—"}
                  </code>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No audit entries match the current filters.
                </td>
              </tr>
            )}
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
