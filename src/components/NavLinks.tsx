"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLinks({
  items,
}: {
  items: { href: string; label: string }[];
}) {
  const pathname = usePathname();

  return (
    <nav className="-mb-px flex min-h-11 items-stretch gap-1 overflow-x-auto text-sm">
      {items.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`focus-ink flex items-center border-b-2 px-3 whitespace-nowrap transition-colors ${
              active
                ? "border-signal font-semibold text-ink"
                : "border-transparent text-ink-2 hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
