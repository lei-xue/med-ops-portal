"use client";

import { useState, type FormEvent } from "react";

import { btnPrimary, field } from "@/components/ui";

const DEMO_ACCOUNTS = [
  { label: "Admin", email: "admin@demo.local" },
  { label: "Pharmacist", email: "pharmacist@demo.local" },
  { label: "Technician", email: "tech@demo.local" },
];

const DEMO_PASSWORD = "demo1234!";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "Unable to sign in. Please try again.");
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const callbackUrl = params.get("callbackUrl");
      window.location.href =
        callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={field}
          placeholder="you@demo.local"
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={field}
          placeholder="••••••••"
        />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={`${btnPrimary} h-10 w-full`}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <div className="pt-4">
        <div className="mb-3 flex items-center gap-3 text-xs text-slate-500">
          <span className="h-px flex-1 bg-slate-200" />
          Demo accounts · password{" "}
          <code className="font-mono text-slate-700">{DEMO_PASSWORD}</code>
          <span className="h-px flex-1 bg-slate-200" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => {
                setEmail(account.email);
                setPassword(DEMO_PASSWORD);
              }}
              title={account.email}
              className={`rounded-md border px-2 py-2 text-xs font-medium transition-colors ${
                email === account.email
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {account.label}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}
