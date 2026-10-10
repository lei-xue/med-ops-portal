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
          className="label-mono mb-1.5 block text-ink-2"
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
          className="label-mono mb-1.5 block text-ink-2"
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
          className="border-l-4 border-danger bg-sunken px-3 py-2 text-sm text-ink"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={`${btnPrimary} w-full py-2.5`}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <div className="perforation pt-1" />
      <div>
        <p className="label-mono mb-2 text-ink-3">
          Demo accounts · password{" "}
          <code className="normal-case">{DEMO_PASSWORD}</code>
        </p>
        <ul className="divide-y divide-rule-soft border border-rule">
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.email}>
              <button
                type="button"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(DEMO_PASSWORD);
                }}
                className={`focus-ink flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-sunken ${
                  email === account.email ? "bg-sunken" : ""
                }`}
              >
                <span className="font-medium">{account.label}</span>
                <span className="font-mono text-xs text-ink-3">
                  {account.email}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </form>
  );
}
