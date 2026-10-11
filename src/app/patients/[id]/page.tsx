import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AllergyNote } from "@/components/AllergyNote";
import { Avatar } from "@/components/Avatar";
import { OrdersTable } from "@/components/OrdersTable";
import { PageHeader } from "@/components/PageHeader";
import { btnPrimary, card, cardHeader } from "@/components/ui";
import { formatBirthDate } from "@/lib/age";
import { requirePageSession } from "@/lib/pageSession";
import { getPatientById, listOrders } from "@/lib/queries";

export async function generateMetadata({
  params,
}: PageProps<"/patients/[id]">): Promise<Metadata> {
  const patient = await getPatientById(Number((await params).id) || 0);
  return { title: patient?.name ?? "Patient" };
}

export default async function PatientPage({ params }: PageProps<"/patients/[id]">) {
  const session = await requirePageSession();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const [patient, orders] = await Promise.all([
    getPatientById(id),
    listOrders({ patientId: id, pageSize: 100 }),
  ]);
  if (!patient) notFound();

  const active = orders.rows.filter((o) =>
    ["pending", "verified", "filled"].includes(o.status),
  ).length;

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/patients" className="hover:text-brand-600">
            ← Patients
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            <Avatar name={patient.name} />
            {patient.name}
          </span>
        }
        description={<span className="font-mono">{patient.mrn}</span>}
        actions={
          <Link href={`/orders/new?patient=${patient.id}`} className={btnPrimary}>
            <Plus aria-hidden className="size-4" />
            New order for patient
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Date of birth" value={formatBirthDate(patient.dateOfBirth)} />
        <Stat label="Allergies" value={<AllergyNote allergies={patient.allergies} />} />
        <Stat label="Phone" value={patient.phone ?? "Not recorded"} />
        <Stat label="Orders" value={`${active} active · ${orders.total} total`} />
      </div>

      <section className={`${card} overflow-hidden`}>
        <div className={cardHeader}>
          <h2 className="text-sm font-semibold">Prescriptions and orders</h2>
        </div>
        <OrdersTable
          rows={orders.rows}
          role={session.user.role}
          hide={["patient"]}
          empty="No orders for this patient yet."
        />
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={`${card} p-4`}>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
