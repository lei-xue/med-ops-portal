import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { roleCan } from "@/lib/permissions";
import { listMedications } from "@/lib/queries";
import NewOrderForm from "./NewOrderForm";

export const metadata: Metadata = { title: "New order" };

export default async function NewOrderPage() {
  const session = await auth();
  if (!session) redirect("/login");

  if (!roleCan(session.user.role, "create")) {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-lg border border-rose-200 bg-rose-50 p-6 text-center">
        <h1 className="font-semibold text-rose-800">Not permitted</h1>
        <p className="mt-1 text-sm text-rose-700">
          Your role cannot create orders.
        </p>
        <Link
          href="/orders"
          className="mt-4 inline-block text-sm font-medium text-teal-700 hover:text-teal-600"
        >
          ← Back to orders
        </Link>
      </div>
    );
  }

  const medications = await listMedications();

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <Link
          href="/orders"
          className="text-xs font-medium text-teal-700 hover:text-teal-600"
        >
          ← Back to orders
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">
          New medication order
        </h1>
        <p className="text-sm text-slate-500">
          Orders start as <strong>pending</strong> and require pharmacist
          verification before filling.
        </p>
      </div>

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
    </div>
  );
}
