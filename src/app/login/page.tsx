import {
  History,
  PackageCheck,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { BrandMark } from "@/components/BrandMark";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: ShieldCheck,
    title: "Pharmacist verification",
    body: "Orders can't be filled until a pharmacist signs off.",
  },
  {
    icon: PackageCheck,
    title: "Atomic inventory",
    body: "Filling locks the order and stock rows so counts never drift.",
  },
  {
    icon: History,
    title: "Complete audit trail",
    body: "Every change is recorded in the same transaction that made it.",
  },
];

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.role) redirect("/");

  return (
    <div className="flex min-h-screen">
      <aside className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-nav-900 p-12 text-white lg:flex">
        {/* Faint grid, like a clinical chart background. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative flex items-center gap-3">
          <BrandMark size="lg" />
          <div className="leading-tight">
            <div className="text-lg font-semibold">MedOps</div>
            <div className="text-sm text-slate-400">Pharmacy operations</div>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl leading-snug font-semibold tracking-tight">
            Medication orders, verified at every step.
          </h1>
          <ul className="mt-10 space-y-6">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/10 text-brand-100">
                  <feature.icon aria-hidden className="size-5" />
                </span>
                <div>
                  <div className="font-medium">{feature.title}</div>
                  <div className="mt-0.5 text-sm text-slate-400">
                    {feature.body}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-500">
          Demo environment · synthetic data only · not for clinical use
        </p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark />
            <span className="font-semibold">MedOps</span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 mb-8 text-sm text-slate-500">
            Use your staff account to access the pharmacy workspace.
          </p>
          <LoginForm />
        </div>
      </main>
    </div>
  );
}
