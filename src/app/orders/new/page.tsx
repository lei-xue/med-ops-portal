import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/PageHeader";
import { card } from "@/components/ui";
import { requirePageSession } from "@/lib/pageSession";
import { roleCan } from "@/lib/permissions";
import { listMedications, listPatients, listPrescribers } from "@/lib/queries";
import NewOrderForm from "./NewOrderForm";

export const metadata: Metadata = { title: "New order" };

export default async function NewOrderPage({
  searchParams,
}: PageProps<"/orders/new">) {
  const session = await requirePageSession();

  if (!roleCan(session.user.role, "create")) {
    return (
      <div className={`${card} mx-auto mt-10 max-w-md p-6 text-center`}>
        <h1 className="font-semibold">Not permitted</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your role cannot create orders.
        </p>
        <Link
          href="/orders"
          className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          ← Back to orders
        </Link>
      </div>
    );
  }

  const params = await searchParams;
  const [medications, patients, prescribers] = await Promise.all([
    listMedications(),
    listPatients(),
    listPrescribers(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/orders" className="hover:text-brand-600">
            ← Medication orders
          </Link>
        }
        title="New medication order"
        description="Orders start as pending and need pharmacist verification before they can be filled. Prescription-only products need a prescriber."
      />
      <NewOrderForm
        initialPatientId={Number(params.patient) || null}
        initialMedicationId={Number(params.medication) || null}
        patients={patients.map((p) => ({
          id: p.id,
          name: p.name,
          mrn: p.mrn,
          dateOfBirth: p.dateOfBirth,
          allergies: p.allergies,
        }))}
        prescribers={prescribers.map((p) => ({
          id: p.id,
          name: p.name,
          credentials: p.credentials,
          specialty: p.specialty,
        }))}
        medications={medications.map((m) => ({
          id: m.id,
          name: m.name,
          brandName: m.brandName,
          strength: m.strength,
          dosageForm: m.dosageForm,
          rxStatus: m.rxStatus,
          deaSchedule: m.deaSchedule,
          stockUnit: m.stockUnit,
          stockQuantity: m.stockQuantity,
          reorderThreshold: m.reorderThreshold,
        }))}
      />
    </>
  );
}
