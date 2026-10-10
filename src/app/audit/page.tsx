import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { RoleBadge } from "@/components/badges";
import { RelativeTime } from "@/components/RelativeTime";
import { btnSecondary, fieldSm, panel, td, th } from "@/components/ui";
import type { UserRole } from "@/db/schema";
import { describeAudit } from "@/lib/audit";
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
  const session = await auth();
  if (!session) redirect("/login");
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

  return (
    <div className="space-y-6">
      <div>
        <p className="label-mono text-ink-3">
          {total} entr{total === 1 ? "y" : "ies"} · written in the same
          transaction as the change
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Audit log
        </h1>
      </div>

      <form
        action="/audit"
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
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
          <option value="">All actors</option>
          {actors.map((actor) => (
            <option key={actor.id} value={actor.id}>
              {actor.name} ({actor.role})
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 px-1 text-sm text-ink-2">
          <input
            type="checkbox"
            name="logins"
            value="1"
            defaultChecked={includeLogins}
            className="size-4 accent-current"
          />
          Include sign-ins
        </label>
        <button type="submit" className={btnSecondary}>
          Apply filters
        </button>
      </form>

      <div className={`overflow-x-auto ${panel}`}>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-rule bg-sunken">
            <tr>
              <th className={th}>When</th>
              <th className={th}>Actor</th>
              <th className={th}>Action</th>
              <th className={th}>What happened</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule-soft">
            {rows.map((row) => (
              <tr key={row.id} className="align-top hover:bg-sunken">
                <td className={`${td} text-ink-2`}>
                  <RelativeTime value={row.createdAt} />
                </td>
                <td className={`${td} whitespace-nowrap`}>
                  <span className="font-medium">{row.actorName}</span>{" "}
                  <RoleBadge role={row.actorRole as UserRole} />
                </td>
                <td className={td}>
                  <code className="font-mono text-xs text-ink">
                    {row.action}
                  </code>
                  <span className="block font-mono text-xs text-ink-3">
                    {row.entityType} #{row.entityId}
                  </span>
                </td>
                <td className={`${td} max-w-md`}>
                  <span className="text-ink-2">{describeAudit(row)}</span>
                  {row.details != null && (
                    <code
                      title={JSON.stringify(row.details)}
                      className="mt-0.5 block truncate font-mono text-xs text-ink-3"
                    >
                      {JSON.stringify(row.details)}
                    </code>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-ink-2">
                  No audit entries match the current filters.
                </td>
              </tr>
            )}
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
