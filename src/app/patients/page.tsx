import type { Metadata } from "next";
import Link from "next/link";

import { AllergyNote } from "@/components/AllergyNote";
import { Avatar } from "@/components/Avatar";
import { PageHeader } from "@/components/PageHeader";
import { RelativeTime } from "@/components/RelativeTime";
import { SearchBox } from "@/components/SearchBox";
import { card, recordLink, td, th } from "@/components/ui";
import { formatBirthDate } from "@/lib/age";
import { requirePageSession } from "@/lib/pageSession";
import { listPatients } from "@/lib/queries";

export const metadata: Metadata = { title: "Patients" };

export default async function PatientsPage({
  searchParams,
}: PageProps<"/patients">) {
  await requirePageSession();
  const q = String((await searchParams).q ?? "");
  const rows = await listPatients(q);

  return (
    <>
      <PageHeader
        title="Patients"
        description="Fictional patient records. Every order links back to one of these."
      />
      <div className={`${card} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <SearchBox action="/patients" q={q} placeholder="Search name or MRN" />
          <span className="text-xs text-slate-500">
            {rows.length} patient{rows.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="overflow-x-auto border-t border-slate-200">
          <table className="w-full min-w-3xl text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Patient</th>
                <th className={th}>Date of birth</th>
                <th className={th}>Allergies</th>
                <th className={`${th} text-right`}>Active orders</th>
                <th className={th}>Last order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70">
                  <td className={td}>
                    <div className="flex items-center gap-3">
                      <Avatar name={p.name} />
                      <div>
                        <Link href={`/patients/${p.id}`} className={recordLink}>
                          {p.name}
                        </Link>
                        <div className="font-mono text-[11px] text-slate-500">{p.mrn}</div>
                      </div>
                    </div>
                  </td>
                  <td className={`${td} whitespace-nowrap text-slate-700`}>
                    {formatBirthDate(p.dateOfBirth)}
                  </td>
                  <td className={`${td} text-xs`}>
                    <AllergyNote allergies={p.allergies} />
                  </td>
                  <td className={`${td} text-right tabular-nums`}>
                    {p.activeCount}
                    <span className="text-xs text-slate-500"> / {p.orderCount}</span>
                  </td>
                  <td className={td}>
                    {p.lastOrderAt ? (
                      <RelativeTime value={p.lastOrderAt} className="text-slate-600" />
                    ) : (
                      <span className="text-xs text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-14 text-center text-sm text-slate-500">
                    No patients match “{q}”.
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
