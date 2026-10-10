import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { RxMark } from "@/components/Header";
import { panel } from "@/components/ui";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

const STAGES = ["Pending", "Verified", "Filled", "Completed"];

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/");

  return (
    <div className={`mx-auto mt-4 grid max-w-4xl md:grid-cols-2 ${panel}`}>
      {/* Brand side, laid out like a dispensing label. */}
      <div className="flex flex-col justify-between gap-10 border-b border-rule bg-ink p-8 text-on-ink md:border-r md:border-b-0">
        <div className="flex items-center gap-3">
          <RxMark size="lg" />
          <div>
            <div className="text-lg font-semibold tracking-tight">MedOps</div>
            <div className="label-mono opacity-60">Medication operations</div>
          </div>
        </div>
        <div>
          <h1 className="text-3xl leading-tight font-semibold tracking-tight">
            Every order, verified before it leaves the bench.
          </h1>
          <ol className="mt-8 grid grid-cols-4 gap-1">
            {STAGES.map((stage, i) => (
              <li key={stage}>
                <div className={`h-1.5 ${i === 3 ? "bg-signal" : "bg-current opacity-80"}`} />
                <div className="label-mono mt-2 opacity-60">
                  0{i + 1} {stage}
                </div>
              </li>
            ))}
          </ol>
        </div>
        <p className="label-mono opacity-50">
          Demo system · all data fictional
        </p>
      </div>

      <div className="p-8">
        <p className="label-mono text-ink-3">Staff sign-in</p>
        <h2 className="mt-1 mb-6 text-2xl font-semibold tracking-tight">
          Welcome back
        </h2>
        <LoginForm />
      </div>
    </div>
  );
}
