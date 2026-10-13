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
import ContactEmail from "@/components/ContactEmail";
import LoginForm from "./LoginForm";

const DESCRIPTION =
  "MedOps Portal is a portfolio demo of a pharmacy medication-order workflow for technicians, pharmacists and admins. Synthetic data only, not for clinical use.";

export const metadata: Metadata = {
  title: "Sign in",
  description: DESCRIPTION,
  alternates: { canonical: "/login" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: "MedOps Portal",
    title: "MedOps Portal — pharmacy operations demo",
    description: DESCRIPTION,
    url: "/login",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "MedOps Portal sign-in page",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MedOps Portal — pharmacy operations demo",
    description: DESCRIPTION,
    images: ["/og-image.jpg"],
  },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "MedOps Portal",
  url: "https://medops.leixue.dev",
  description: DESCRIPTION,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  isAccessibleForFree: true,
  author: {
    "@type": "Person",
    name: "Sherry (Lei) Xue",
    url: "https://blog.leixue.dev",
    sameAs: ["https://github.com/lei-xue"],
  },
};

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
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <noscript>
        <div className="mx-auto max-w-2xl p-6 text-sm text-slate-700">
          <h1 className="text-xl font-semibold">MedOps Portal</h1>
          <p className="mt-2">
            MedOps Portal is a demo of a pharmacy medication-order workflow for
            technicians, pharmacists and administrators. Orders move through
            pending, verified, filled and completed stages, with
            server-enforced prescription rules, inventory tracking and a
            complete audit trail. All data is fictional and the demo is not for
            clinical use.
          </p>
          <p className="mt-2">
            Sign in with a demo account — tech@demo.local,
            pharmacist@demo.local or admin@demo.local; the password for all
            three is demo1234!.
          </p>
          <p className="mt-2">
            Built with Next.js 16, React 19, TypeScript, Tailwind CSS v4,
            PostgreSQL 16, Drizzle ORM and Auth.js. Author: Sherry (Lei) Xue.
          </p>
        </div>
      </noscript>

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
          <ContactEmail className="relative mt-1 block text-xs text-slate-500 hover:text-white" />
        </aside>

        <main className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <BrandMark />
              <span className="font-semibold">MedOps</span>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
            <p className="mt-1 mb-8 text-sm text-slate-600">
              Use your staff account to access the pharmacy workspace.
            </p>
            <LoginForm />
          </div>
        </main>
      </div>
    </>
  );
}
