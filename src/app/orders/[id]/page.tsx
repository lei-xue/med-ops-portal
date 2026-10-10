import { Stethoscope } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AllergyNote } from "@/components/AllergyNote";
import { Avatar } from "@/components/Avatar";
import { ProductBadges, StatusBadge } from "@/components/badges";
import { AUDIT_FALLBACK, AUDIT_ICONS } from "@/components/icons";
import { orderCode } from "@/components/OrdersTable";
import { PageHeader } from "@/components/PageHeader";
import { RelativeTime } from "@/components/RelativeTime";
import { StockGauge } from "@/components/StockGauge";
import { card, cardHeader, recordLink } from "@/components/ui";
import { formatBirthDate } from "@/lib/age";
import { describeAudit } from "@/lib/audit";
import { formatDateTime, formatQuantity } from "@/lib/format";
import { requirePageSession } from "@/lib/pageSession";
import { getOrderDetail, getOrderHistory } from "@/lib/queries";
import OrderRowActions from "../OrderRowActions";

export async function generateMetadata({
  params,
}: PageProps<"/orders/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: orderCode(Number(id) || 0) };
}

export default async function OrderDetailPage({
  params,
}: PageProps<"/orders/[id]">) {
  const session = await requirePageSession();
  const orderId = Number((await params).id);
  if (!Number.isInteger(orderId)) notFound();

  const [order, history] = await Promise.all([
    getOrderDetail(orderId),
    getOrderHistory(orderId),
  ]);
  if (!order) notFound();

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/orders" className="hover:text-brand-600">
            ← Medication orders
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{orderCode(order.id)}</span>
            <StatusBadge status={order.status} />
          </span>
        }
        description={`Entered ${formatDateTime(order.createdAt)} by ${order.createdByName}`}
        actions={
          <OrderRowActions
            orderId={order.id}
            status={order.status}
            role={session.user.role}
          />
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className={card}>
            <div className={cardHeader}>
              <h2 className="text-sm font-semibold">
                {order.prescriberId ? "Prescription" : "OTC order"}
              </h2>
              <ProductBadges
                rxStatus={order.medicationRxStatus}
                schedule={order.medicationSchedule}
              />
            </div>
            <div className="space-y-5 p-5">
              <div>
                <Link
                  href={`/medications/${order.medicationId}`}
                  className={`${recordLink} text-lg`}
                >
                  {order.medicationName} {order.medicationStrength}
                </Link>
                <div className="text-sm text-slate-500">
                  {order.medicationBrandName && `${order.medicationBrandName} · `}
                  {order.medicationForm} · {order.medicationRoute}
                </div>
              </div>

              <div className="rounded-md border-l-4 border-brand-500 bg-brand-50/60 px-4 py-3">
                <div className="text-xs font-medium text-brand-700">Directions (sig)</div>
                <p className="mt-0.5 text-slate-900">
                  {order.directions ?? "No directions recorded."}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Fact label="Quantity" value={formatQuantity(order.quantity, order.stockUnit)} />
                <Fact
                  label="Days supply"
                  value={order.daysSupply ? `${order.daysSupply} days` : "—"}
                />
                <Fact
                  label="Refills"
                  value={
                    order.medicationSchedule === "II"
                      ? "None (C-II)"
                      : String(order.refills)
                  }
                />
                <Fact label="Last update" value={<RelativeTime value={order.updatedAt} />} />
              </dl>

              {order.notes && (
                <p className="text-sm text-slate-600">
                  <span className="font-medium text-slate-800">Note: </span>
                  {order.notes}
                </p>
              )}
            </div>
          </section>

          <section className={card}>
            <div className={cardHeader}>
              <h2 className="text-sm font-semibold">History</h2>
              <span className="text-xs text-slate-500">From the audit log</span>
            </div>
            <ol className="px-5 py-4">
              {history.map((row, index) => {
                const { icon: Icon, tint } = AUDIT_ICONS[row.action] ?? AUDIT_FALLBACK;
                return (
                  <li key={row.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {index < history.length - 1 && (
                      <span
                        aria-hidden
                        className="absolute top-8 bottom-0 left-3.5 w-px bg-slate-200"
                      />
                    )}
                    <span
                      className={`relative grid size-7 shrink-0 place-items-center rounded-full ${tint}`}
                    >
                      <Icon aria-hidden className="size-3.5" />
                    </span>
                    <div className="text-sm">
                      <p className="text-slate-600">
                        <span className="font-medium text-slate-900">{row.actorName}</span>{" "}
                        {describeAudit(row)}
                      </p>
                      <span className="text-xs text-slate-500">
                        {formatDateTime(row.createdAt)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        <div className="space-y-6">
          <section className={card}>
            <div className={cardHeader}>
              <h2 className="text-sm font-semibold">Patient</h2>
              <span className="font-mono text-xs text-slate-500">{order.patient.mrn}</span>
            </div>
            <div className="space-y-3 p-5 text-sm">
              <div className="flex items-center gap-3">
                <Avatar name={order.patient.name} />
                <Link href={`/patients/${order.patient.id}`} className={recordLink}>
                  {order.patient.name}
                </Link>
              </div>
              <Row label="Date of birth" value={formatBirthDate(order.patient.dateOfBirth)} />
              <Row label="Allergies" value={<AllergyNote allergies={order.patient.allergies} />} />
            </div>
          </section>

          <section className={card}>
            <div className={cardHeader}>
              <h2 className="text-sm font-semibold">Prescriber</h2>
              {order.prescriberNpi && (
                <span className="font-mono text-xs text-slate-500">NPI {order.prescriberNpi}</span>
              )}
            </div>
            <div className="p-5 text-sm">
              {order.prescriberId ? (
                <div className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600">
                    <Stethoscope aria-hidden className="size-4" />
                  </span>
                  <div>
                    <Link href={`/prescribers/${order.prescriberId}`} className={recordLink}>
                      {order.prescriberName}, {order.prescriberCredentials}
                    </Link>
                    <div className="text-xs text-slate-500">{order.prescriberSpecialty}</div>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500">
                  Over-the-counter product: no prescriber required.
                </p>
              )}
            </div>
          </section>

          <section className={card}>
            <div className={cardHeader}>
              <h2 className="text-sm font-semibold">Stock</h2>
              <Link
                href={`/medications/${order.medicationId}`}
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                View product
              </Link>
            </div>
            <div className="space-y-2 p-5 text-sm">
              <div className="flex items-baseline justify-between">
                <span>
                  <span className="text-lg font-semibold tabular-nums">
                    {order.medicationStockQuantity}
                  </span>{" "}
                  <span className="text-slate-500">{order.stockUnit} on hand</span>
                </span>
                <span className="text-xs text-slate-500">
                  reorder at {order.medicationReorderThreshold}
                </span>
              </div>
              <StockGauge
                stock={order.medicationStockQuantity}
                threshold={order.medicationReorderThreshold}
                scale={Math.max(
                  order.medicationStockQuantity,
                  order.medicationReorderThreshold * 2,
                )}
              />
              {["pending", "verified"].includes(order.status) &&
                order.medicationStockQuantity < order.quantity && (
                  <p className="text-xs font-medium text-red-700">
                    Not enough stock to fill this order.
                  </p>
                )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
