import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  fetchMedicationRequests,
  fetchPatients,
  type FhirMedicationRequest,
  type FhirPatient,
  type FhirResult,
} from "@/lib/fhir";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "FHIR feed" };

// Must match the fetch-level revalidation in src/lib/fhir.ts.
export const revalidate = 300;

const MEDICATION_STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  "on-hold": "bg-amber-50 text-amber-700 ring-amber-600/20",
  completed: "bg-sky-50 text-sky-700 ring-sky-600/20",
  stopped: "bg-violet-50 text-violet-700 ring-violet-600/20",
  cancelled: "bg-rose-50 text-rose-700 ring-rose-600/20",
  "entered-in-error": "bg-rose-50 text-rose-700 ring-rose-600/20",
};

function FhirStatusBadge({ status }: { status: string }) {
  const style =
    MEDICATION_STATUS_STYLES[status] ??
    "bg-slate-100 text-slate-600 ring-slate-500/20";
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
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">
          {title}{" "}
          <span className="font-normal text-slate-400">({count})</span>
        </h2>
      </div>
      {children}
    </section>
  );
}

function FhirErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-6 text-center">
      <p className="font-medium text-rose-800">
        The FHIR sandbox could not be reached
      </p>
      <p className="mt-1 text-sm text-rose-700">{message}</p>
      <Link
        href="/fhir"
        className="mt-3 inline-block rounded-md border border-rose-300 bg-white px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100"
      >
        Retry
      </Link>
    </div>
  );
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-slate-500">
        {label}
      </td>
    </tr>
  );
}

function patientsTable(result: FhirResult<FhirPatient[]>) {
  if (!result.ok) return <FhirErrorCard message={result.error} />;
  return (
    <SectionCard title="Patients" count={result.data.length}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Gender</th>
              <th className="px-4 py-2.5 font-medium">Birth date</th>
              <th className="px-4 py-2.5 font-medium">FHIR ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {result.data.map((patient, index) => (
              <tr key={patient.id ?? index} className="hover:bg-slate-50/60">
                <td className="px-4 py-2.5 font-medium text-slate-800">
                  {patient.name ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-slate-600">
                  {patient.gender ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-slate-600 tabular-nums">
                  {patient.birthDate ?? "—"}
                </td>
                <td className="px-4 py-2.5">
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">
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
    <SectionCard title="MedicationRequests" count={result.data.length}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-2.5 font-medium">Medication</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Intent</th>
              <th className="px-4 py-2.5 font-medium">Patient</th>
              <th className="px-4 py-2.5 font-medium">Authored</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {result.data.map((request, index) => (
              <tr key={request.id ?? index} className="hover:bg-slate-50/60">
                <td className="px-4 py-2.5 font-medium text-slate-800">
                  {request.medication ?? "—"}
                </td>
                <td className="px-4 py-2.5">
                  {request.status ? (
                    <FhirStatusBadge status={request.status} />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2.5 text-slate-600">
                  {request.intent ?? "—"}
                </td>
                <td className="px-4 py-2.5">
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">
                    {request.patientReference ?? "—"}
                  </code>
                </td>
                <td className="px-4 py-2.5 text-xs whitespace-nowrap text-slate-500 tabular-nums">
                  {request.authoredOn
                    ? formatDateTime(request.authoredOn)
                    : "—"}
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
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">FHIR feed</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Live read-only feed from the public HAPI FHIR R4 test server
          (synthetic data). Fetched server-side and cached for 5 minutes.
        </p>
      </div>

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
  );
}
