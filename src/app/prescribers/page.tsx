import { Stethoscope } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/PageHeader";
import { SearchBox } from "@/components/SearchBox";
import { card, recordLink, td, th } from "@/components/ui";
import { requirePageSession } from "@/lib/pageSession";
import { listPrescribers } from "@/lib/queries";

export const metadata: Metadata = { title: "Prescribers" };

export default async function PrescribersPage({
  searchParams,
}: PageProps<"/prescribers">) {
  await requirePageSession();
  const q = String((await searchParams).q ?? "");
  const rows = await listPrescribers(q);

  return (
    <>
      <PageHeader
        title="Prescribers"
        description="Fictional clinicians (NPIs are not real). Prescription-only orders must name one."
      />
      <div className={`${card} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <SearchBox action="/prescribers" q={q} placeholder="Search name, NPI or specialty" />
          <span className="text-xs text-slate-500">
            {rows.length} prescriber{rows.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="overflow-x-auto border-t border-slate-200">
          <table className="w-full min-w-3xl text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Prescriber</th>
                <th className={th}>NPI</th>
                <th className={th}>Specialty</th>
                <th className={th}>Practice</th>
                <th className={`${th} text-right`}>Orders</th>
                <th className={`${th} text-right`}>Patients</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70">
                  <td className={td}>
                    <div className="flex items-center gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600">
                        <Stethoscope aria-hidden className="size-4" />
                      </span>
                      <Link href={`/prescribers/${p.id}`} className={recordLink}>
                        {p.name}, {p.credentials}
                      </Link>
                    </div>
                  </td>
                  <td className={`${td} font-mono text-xs text-slate-600`}>{p.npi}</td>
                  <td className={td}>{p.specialty}</td>
                  <td className={`${td} text-slate-600`}>{p.practice ?? "—"}</td>
                  <td className={`${td} text-right tabular-nums`}>{p.orderCount}</td>
                  <td className={`${td} text-right tabular-nums`}>{p.patientCount}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center text-sm text-slate-500">
                    No prescribers match “{q}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
