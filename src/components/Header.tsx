import Link from "next/link";

import { auth } from "@/auth";
import { RoleBadge } from "@/components/badges";
import NavLinks from "@/components/NavLinks";
import type { UserRole } from "@/db/schema";
import LogoutButton from "@/components/LogoutButton";

const NAV_ITEMS: {
  href: string;
  label: string;
  roles?: UserRole[];
}[] = [
  { href: "/", label: "Dashboard" },
  { href: "/orders", label: "Orders" },
  { href: "/medications", label: "Inventory" },
  { href: "/audit", label: "Audit log", roles: ["pharmacist", "admin"] },
  { href: "/fhir", label: "FHIR feed" },
];

export function RxMark({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <span
      aria-hidden
      className={`grid place-items-center bg-signal font-mono font-semibold text-black ${
        size === "lg" ? "size-11 text-lg" : "size-7 text-xs"
      }`}
    >
      Rx
    </span>
  );
}

export default async function Header() {
  const session = await auth();
  const role = session?.user.role;

  return (
    <header className="border-b border-rule bg-card">
      <div className="mx-auto flex min-h-14 w-full max-w-6xl flex-wrap items-stretch gap-x-6 px-4 sm:px-6">
        <div className="flex items-center gap-3 py-3">
          <Link href="/" className="focus-ink flex items-center gap-2.5">
            <RxMark />
            <span className="font-semibold tracking-tight">MedOps</span>
          </Link>
          <span className="label-mono border border-dashed border-rule px-1.5 py-0.5 text-ink-3">
            Demo · fictional data
          </span>
        </div>

        {session ? (
          <>
            <div className="order-last flex w-full items-stretch sm:order-none sm:w-auto sm:flex-1">
              <NavLinks
                items={NAV_ITEMS.filter(
                  (item) => !item.roles || (role && item.roles.includes(role)),
                )}
              />
            </div>
            <div className="ml-auto flex items-center gap-3 py-3">
              <span className="hidden text-sm text-ink-2 md:inline">
                {session.user.name}
              </span>
              {role && <RoleBadge role={role} />}
              <LogoutButton />
            </div>
          </>
        ) : (
          <div className="ml-auto flex items-center">
            <Link
              href="/login"
              className="focus-ink bg-ink px-3 py-1.5 text-sm font-semibold text-on-ink"
            >
              Sign in
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
