import { Stethoscope } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrdersTable } from "@/components/OrdersTable";
import { PageHeader } from "@/components/PageHeader";
import { card, cardHeader } from "@/components/ui";
import { requirePageSession } from "@/lib/pageSession";
import { getPrescriberById, listOrders } from "@/lib/queries";

export async function generateMetadata({
  params,
}: PageProps<"/prescribers/[id]">): Promise<Metadata> {
  const prescriber = await getPrescriberById(Number((await params).id) || 0);
  return { title: prescriber ? `${prescriber.name}, ${prescriber.credentials}` : "Prescriber" };
}

export default async function PrescriberPage({
  params,
}: PageProps<"/prescribers/[id]">) {
  const session = await requirePageSession();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const [prescriber, orders] = await Promise.all([
    getPrescriberById(id),
    listOrders({ prescriberId: id, pageSize: 100 }),
  ]);
  if (!prescriber) notFound();

  const patientCount = new Set(orders.rows.map((o) => o.patientId)).size;

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/prescribers" className="hover:text-brand-600">
            ← Prescribers
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-full bg-slate-100 text-slate-600">
              <Stethoscope aria-hidden className="size-4" />
            </span>
            {prescriber.name}, {prescriber.credentials}
          </span>
        }
        description={`${prescriber.specialty}${prescriber.practice ? ` · ${prescriber.practice}` : ""}`}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="NPI" value={<span className="font-mono">{prescriber.npi}</span>} />
        <Stat label="Orders written" value={orders.total} />
        <Stat label="Patients" value={patientCount} />
      </div>

      <section className={`${card} overflow-hidden`}>
        <div className={cardHeader}>
          <h2 className="text-sm font-semibold">Prescriptions</h2>
        </div>
        <OrdersTable
          rows={orders.rows}
          role={session.user.role}
          hide={["prescriber"]}
          empty="No prescriptions from this prescriber yet."
        />
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={`${card} p-4`}>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
