import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/");

  return (
    <div className="mx-auto mt-8 w-full max-w-sm space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto grid size-10 place-items-center rounded-lg bg-teal-600 text-lg font-bold text-white">
            Rx
          </span>
          <h1 className="mt-3 text-lg font-semibold text-slate-900">
            Sign in to MedOps Portal
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Medication operations for the pharmacy team
          </p>
        </div>
        <LoginForm />
      </div>

      <p className="text-center text-xs text-slate-400">
        Demo system — all data fictional. Accounts below are seeded demo
        users.
      </p>
    </div>
  );
}
