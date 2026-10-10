import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { panel } from "@/components/ui";
import { roleCan } from "@/lib/permissions";
import { listMedications } from "@/lib/queries";
import NewOrderForm from "./NewOrderForm";

export const metadata: Metadata = { title: "New order" };

export default async function NewOrderPage() {
  const session = await auth();
  if (!session) redirect("/login");

  if (!roleCan(session.user.role, "create")) {
    return (
      <div className={`mx-auto mt-10 max-w-md border-l-4 border-l-danger p-6 ${panel}`}>
        <h1 className="font-semibold">Not permitted</h1>
        <p className="mt-1 text-sm text-ink-2">
          Your role cannot create orders.
        </p>
        <Link
          href="/orders"
          className="label-mono mt-4 inline-block text-ink-2 hover:text-ink"
        >
          ← Back to orders
        </Link>
      </div>
    );
  }

  const medications = await listMedications();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link href="/orders" className="label-mono text-ink-3 hover:text-ink">
          ← Back to orders
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          New order
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          Orders start as <strong className="text-ink">pending</strong> and
          need pharmacist verification before they can be filled.
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
