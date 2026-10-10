"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { btnQuiet } from "@/components/ui";

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
      className={btnQuiet}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
