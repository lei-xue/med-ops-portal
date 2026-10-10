import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/PageHeader";
import { card } from "@/components/ui";
import { roleCan } from "@/lib/permissions";
import { listMedications } from "@/lib/queries";
import NewOrderForm from "./NewOrderForm";

export const metadata: Metadata = { title: "New order" };

export default async function NewOrderPage() {
  const session = await auth();
  if (!session) redirect("/login");

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

  const medications = await listMedications();

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/orders" className="hover:text-brand-600">
            ← Medication orders
          </Link>
        }
        title="New medication order"
        description="Orders start as pending and need pharmacist verification before they can be filled."
      />
      <NewOrderForm
        medications={medications.map((m) => ({
          id: m.id,
          name: m.name,
          strength: m.strength,
          dosageForm: m.dosageForm,
          stockQuantity: m.stockQuantity,
          reorderThreshold: m.reorderThreshold,
        }))}
      />
    </>
  );
}
