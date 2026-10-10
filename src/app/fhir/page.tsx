import { CloudOff, Database } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/PageHeader";
import { RelativeTime } from "@/components/RelativeTime";
import { btnSecondary, card, cardHeader, td, th } from "@/components/ui";
import {
  fetchMedicationRequests,
  fetchPatients,
  type FhirMedicationRequest,
  type FhirPatient,
  type FhirResult,
} from "@/lib/fhir";

export const metadata: Metadata = { title: "FHIR feed" };

// Must match the fetch-level revalidation in src/lib/fhir.ts.
export const revalidate = 300;

const FHIR_STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  completed: "bg-slate-100 text-slate-700 ring-slate-200",
  "on-hold": "bg-amber-50 text-amber-800 ring-amber-200",
};

function FhirStatusBadge({ status }: { status: string }) {
  const style =
    FHIR_STATUS_STYLES[status] ?? "bg-red-50 text-red-700 ring-red-200";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}
    >
      {status}
    </span>
  );
}

function SectionCard({
  title,
  resource,
  count,
  children,
}: {
  title: string;
  resource: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className={`${card} overflow-hidden`}>
      <div className={cardHeader}>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">{title}</h2>
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
            {resource}
          </code>
        </div>
        <span className="text-xs text-slate-500 tabular-nums">
          {count} resources
        </span>
      </div>
      {children}
    </section>
  );
}

function FhirErrorCard({ message }: { message: string }) {
  return (
    <div className={`${card} flex flex-col items-center px-6 py-10 text-center`}>
      <span className="grid size-10 place-items-center rounded-full bg-red-50 text-red-600">
        <CloudOff aria-hidden className="size-5" />
      </span>
      <p className="mt-3 font-medium">The FHIR sandbox could not be reached</p>
      <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p>
      <Link href="/fhir" className={`${btnSecondary} mt-4`}>
        Retry
      </Link>
    </div>
  );
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-14 text-center text-sm text-slate-500">
        {label}
      </td>
    </tr>
  );
}

function patientsTable(result: FhirResult<FhirPatient[]>) {
  if (!result.ok) return <FhirErrorCard message={result.error} />;
  return (
    <SectionCard
      title="Patients"
      resource="Patient"
      count={result.data.length}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>Name</th>
              <th className={th}>Gender</th>
              <th className={th}>Birth date</th>
              <th className={th}>FHIR ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {result.data.map((patient, index) => (
              <tr key={patient.id ?? index} className="hover:bg-slate-50/70">
                <td className={`${td} font-medium`}>
                  {patient.name ?? "—"}
                </td>
                <td className={`${td} text-slate-600`}>
                  {patient.gender ?? "—"}
                </td>
                <td className={`${td} font-mono text-xs text-slate-600 tabular-nums`}>
                  {patient.birthDate ?? "—"}
                </td>
                <td className={td}>
                  <code className="font-mono text-xs text-slate-600">
                    {patient.id ?? "—"}
                  </code>
                </td>
              </tr>
            ))}
            {result.data.length === 0 && (
              <EmptyRow colSpan={4} label="The sandbox returned no patients." />
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function medicationRequestsTable(
  result: FhirResult<FhirMedicationRequest[]>,
) {
  if (!result.ok) return <FhirErrorCard message={result.error} />;
  return (
    <SectionCard
      title="Medication requests"
      resource="MedicationRequest"
      count={result.data.length}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>Medication</th>
              <th className={th}>Status</th>
              <th className={th}>Intent</th>
              <th className={th}>Patient</th>
              <th className={th}>Authored</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {result.data.map((request, index) => (
              <tr key={request.id ?? index} className="hover:bg-slate-50/70">
                <td className={`${td} font-medium`}>
                  {request.medication ?? "—"}
                </td>
                <td className={td}>
                  {request.status ? (
                    <FhirStatusBadge status={request.status} />
                  ) : (
                    "—"
                  )}
                </td>
                <td className={`${td} text-slate-600`}>
                  {request.intent ?? "—"}
                </td>
                <td className={td}>
                  <code className="font-mono text-xs text-slate-600">
                    {request.patientReference ?? "—"}
                  </code>
                </td>
                <td className={`${td} text-slate-600`}>
                  {request.authoredOn ? (
                    <RelativeTime value={request.authoredOn} />
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {result.data.length === 0 && (
              <EmptyRow
                colSpan={5}
                label="The sandbox returned no medication requests."
              />
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

export default async function FhirPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [patients, medicationRequests] = await Promise.all([
    fetchPatients(),
    fetchMedicationRequests(),
  ]);

  const sandboxDown = !patients.ok && !medicationRequests.ok;

  return (
    <>
      <PageHeader
        title="FHIR feed"
        description="Read-only synthetic data from the public HAPI FHIR R4 test server, fetched server-side and cached for five minutes."
        actions={
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 shadow-card">
            <Database aria-hidden className="size-3.5 text-brand-600" />
            hapi.fhir.org/baseR4
            <span
              aria-hidden
              className={`size-1.5 rounded-full ${
                sandboxDown ? "bg-red-500" : "bg-emerald-500"
              }`}
            />
          </span>
        }
      />

      <div className="space-y-6">
      {sandboxDown ? (
        <FhirErrorCard
          message={
            "Neither Patients nor MedicationRequests could be loaded. " +
            (patients.ok ? "" : patients.error) +
            (medicationRequests.ok ? "" : ` ${medicationRequests.error}`)
          }
        />
      ) : (
        <>
          {patientsTable(patients)}
          {medicationRequestsTable(medicationRequests)}
        </>
      )}
      </div>
    </>
  );
}
