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
import { RelativeTime } from "@/components/RelativeTime";
import { btnSecondary, panel, td, th } from "@/components/ui";

export const metadata: Metadata = { title: "FHIR feed" };

// Must match the fetch-level revalidation in src/lib/fhir.ts.
export const revalidate = 300;

function FhirStatusBadge({ status }: { status: string }) {
  const inactive = ["cancelled", "stopped", "entered-in-error"].includes(
    status,
  );
  return (
    <span
      className={`label-mono inline-flex items-center border px-1.5 py-px ${
        inactive
          ? "border-dashed border-rule text-ink-3"
          : "border-rule text-ink"
      }`}
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
    <section className={`overflow-hidden ${panel}`}>
      <div className="flex items-baseline justify-between border-b border-rule px-4 py-3">
        <h2 className="label-mono font-semibold">{title}</h2>
        <span className="font-mono text-xs text-ink-3">{count} resources</span>
      </div>
      {children}
    </section>
  );
}

function FhirErrorCard({ message }: { message: string }) {
  return (
    <div className={`${panel} border-l-4 border-l-danger px-5 py-6`}>
      <p className="font-medium">The FHIR sandbox could not be reached</p>
      <p className="mt-1 text-sm text-ink-2">{message}</p>
      <Link href="/fhir" className={`${btnSecondary} mt-4`}>
        Retry
      </Link>
    </div>
  );
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-ink-2">
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
          <thead className="border-b border-rule bg-sunken">
            <tr>
              <th className={th}>Name</th>
              <th className={th}>Gender</th>
              <th className={th}>Birth date</th>
              <th className={th}>FHIR ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule-soft">
            {result.data.map((patient, index) => (
              <tr key={patient.id ?? index} className="hover:bg-sunken">
                <td className={`${td} font-medium`}>
                  {patient.name ?? "—"}
                </td>
                <td className={`${td} text-ink-2`}>
                  {patient.gender ?? "—"}
                </td>
                <td className={`${td} font-mono text-xs text-ink-2 tabular-nums`}>
                  {patient.birthDate ?? "—"}
                </td>
                <td className={td}>
                  <code className="font-mono text-xs text-ink-2">
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
          <thead className="border-b border-rule bg-sunken">
            <tr>
              <th className={th}>Medication</th>
              <th className={th}>Status</th>
              <th className={th}>Intent</th>
              <th className={th}>Patient</th>
              <th className={th}>Authored</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule-soft">
            {result.data.map((request, index) => (
              <tr key={request.id ?? index} className="hover:bg-sunken">
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
                <td className={`${td} text-ink-2`}>
                  {request.intent ?? "—"}
                </td>
                <td className={td}>
                  <code className="font-mono text-xs text-ink-2">
                    {request.patientReference ?? "—"}
                  </code>
                </td>
                <td className={`${td} text-ink-2`}>
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
    <div className="space-y-6">
      <div>
        <p className="label-mono text-ink-3">
          HAPI FHIR R4 · read-only · cached 5 min
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          FHIR feed
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-2">
          Live synthetic data from the public HAPI FHIR R4 test server, fetched
          server-side.
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
