import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Avatar } from "@/components/Avatar";
import { RoleBadge } from "@/components/badges";
import { AUDIT_FALLBACK, AUDIT_ICONS } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { RelativeTime } from "@/components/RelativeTime";
import {
  btnSecondary,
  btnSecondarySm,
  card,
  fieldSm,
  td,
  th,
} from "@/components/ui";
import type { UserRole } from "@/db/schema";
import { describeAudit } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";
import { requirePageSession } from "@/lib/pageSession";
import { AUDIT_ACTIONS } from "@/lib/permissions";
import { listActors, listAuditLogs } from "@/lib/queries";

export const metadata: Metadata = { title: "Audit log" };

interface AuditPageProps {
  searchParams: Promise<{
    action?: string;
    actor?: string;
    logins?: string;
    page?: string;
  }>;
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const session = await requirePageSession();
  if (session.user.role === "technician") {
    redirect("/");
  }

  const params = await searchParams;
  const action = AUDIT_ACTIONS.find((a) => a === params.action) ?? undefined;
  const actorId = Number.parseInt(params.actor ?? "", 10) || undefined;
  // Sign-ins outnumber real changes; hide them unless asked for.
  const includeLogins = params.logins === "1";
  const page = Number.parseInt(params.page ?? "1", 10) || 1;

  const [{ rows, total, pageCount }, actors] = await Promise.all([
    listAuditLogs({
      action,
      actorId,
      excludeLogins: !includeLogins,
      page,
      pageSize: 20,
    }),
    listActors(),
  ]);

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const usp = new URLSearchParams();
    const merged = { action, actorId, ...overrides };
    if (merged.action) usp.set("action", merged.action);
    if (merged.actorId) usp.set("actor", String(merged.actorId));
    if (includeLogins) usp.set("logins", "1");
    const p = overrides.page ?? (page > 1 ? String(page) : undefined);
    if (p && p !== "1") usp.set("page", p);
    const qs = usp.toString();
    return qs ? `/audit?${qs}` : "/audit";
  };

  if (page > pageCount) redirect(buildHref({ page: String(pageCount) }));

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every mutation is written in the same database transaction that applied it, so the trail can't drift from the data."
      />

      <div className={`${card} overflow-hidden`}>
        <form
          action="/audit"
          className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center"
        >
          <select
            name="action"
            aria-label="Action"
            defaultValue={action ?? ""}
            className={fieldSm}
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
            aria-label="Actor"
            defaultValue={actorId ? String(actorId) : ""}
            className={fieldSm}
          >
            <option value="">All users</option>
            {actors.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.name} ({actor.role})
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 px-1 text-sm text-slate-600">
            <input
              type="checkbox"
              name="logins"
              value="1"
              defaultChecked={includeLogins}
              className="size-4 rounded border-slate-300 accent-brand-600"
            />
            Include sign-ins
          </label>
          <button type="submit" className={btnSecondary}>
            Apply filters
          </button>
          <span className="text-xs text-slate-500 sm:ml-auto">
            {total} entr{total === 1 ? "y" : "ies"}
          </span>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full min-w-3xl text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Event</th>
                <th className={th}>User</th>
                <th className={th}>Record</th>
                <th className={th}>Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const { icon: Icon, tint } =
                  AUDIT_ICONS[row.action] ?? AUDIT_FALLBACK;
                return (
                  <tr key={row.id} className="align-top hover:bg-slate-50/70">
                    <td className={td}>
                      <div className="flex gap-3">
                        <span
                          className={`grid size-7 shrink-0 place-items-center rounded-full ${tint}`}
                        >
                          <Icon aria-hidden className="size-3.5" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-slate-800 first-letter:uppercase">
                            {describeAudit(row)}
                          </div>
                          {row.details != null && (
                            <code
                              title={JSON.stringify(row.details)}
                              className="mt-0.5 block max-w-md truncate font-mono text-[11px] text-slate-500"
                            >
                              {JSON.stringify(row.details)}
                            </code>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className={td}>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <Avatar name={row.actorName} size="sm" />
                        <span className="font-medium">{row.actorName}</span>
                        <RoleBadge role={row.actorRole as UserRole} />
                      </div>
                    </td>
                    <td className={td}>
                      <code className="font-mono text-xs text-slate-700">
                        {row.action}
                      </code>
                      <div className="text-xs text-slate-500">
                        {row.entityType} #{row.entityId}
                      </div>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      <div className="text-slate-700">
                        {formatDateTime(row.createdAt)}
                      </div>
                      <RelativeTime
                        value={row.createdAt}
                        className="text-slate-500"
                      />
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-14 text-center text-sm text-slate-500"
                  >
                    No audit entries match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
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
