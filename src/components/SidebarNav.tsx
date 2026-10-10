"use client";

import {
  ClipboardList,
  Database,
  History,
  LayoutDashboard,
  Pill,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { UserRole } from "@/db/schema";

const NAV_ITEMS: {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: UserRole[];
}[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders", label: "Orders", icon: ClipboardList },
  { href: "/medications", label: "Inventory", icon: Pill },
  {
    href: "/audit",
    label: "Audit log",
    icon: History,
    roles: ["pharmacist", "admin"],
  },
  { href: "/fhir", label: "FHIR feed", icon: Database },
];

function isActive(pathname: string, href: string) {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}

/** Vertical nav for the desktop sidebar, horizontal tabs on small screens. */
export default function SidebarNav({
  role,
  orientation,
}: {
  role: UserRole;
  orientation: "vertical" | "horizontal";
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(role),
  );

  if (orientation === "horizontal") {
    return (
      <nav className="flex gap-1 overflow-x-auto px-4 text-sm">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-1.5 border-b-2 px-2.5 py-2.5 whitespace-nowrap ${
                active
                  ? "border-white font-medium text-white"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              <item.icon aria-hidden className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="space-y-0.5">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-nav-700 font-medium text-white"
                : "text-slate-400 hover:bg-nav-800 hover:text-white"
            }`}
          >
            {active && (
              <span
                aria-hidden
                className="absolute inset-y-1.5 -left-3 w-1 rounded-r bg-brand-500"
              />
            )}
            <item.icon
              aria-hidden
              className={`size-4.5 ${active ? "text-brand-100" : ""}`}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
