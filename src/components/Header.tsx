import Link from "next/link";

import { auth } from "@/auth";
import { RoleBadge } from "@/components/badges";
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

export default async function Header() {
  const session = await auth();
  const role = session?.user.role;

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="grid size-7 place-items-center rounded-md bg-teal-600 text-sm font-bold text-white">
            Rx
          </span>
          MedOps Portal
        </Link>

        {session ? (
          <>
            <nav className="flex items-center gap-1 text-sm">
              {NAV_ITEMS.filter(
                (item) => !item.roles || (role && item.roles.includes(role)),
              ).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden text-sm text-slate-700 sm:inline">
                {session.user.name}
              </span>
              {role && <RoleBadge role={role} />}
              <LogoutButton />
            </div>
          </>
        ) : (
          <div className="ml-auto">
            <Link
              href="/login"
              className="rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-500"
            >
              Sign in
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
