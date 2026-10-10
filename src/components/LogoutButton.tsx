"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={pending}
      title="Sign out"
      aria-label="Sign out"
      className="grid size-8 place-items-center rounded-md text-slate-400 transition-colors hover:bg-nav-700 hover:text-white disabled:opacity-50"
    >
      <LogOut aria-hidden className="size-4" />
    </button>
  );
}
