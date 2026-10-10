import type { ReactNode } from "react";

import { Avatar } from "@/components/Avatar";
import { RoleBadge } from "@/components/badges";
import { BrandMark } from "@/components/BrandMark";
import LogoutButton from "@/components/LogoutButton";
import SidebarNav from "@/components/SidebarNav";
import type { UserRole } from "@/db/schema";

interface ShellUser {
  name: string;
  email: string;
  role: UserRole;
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark />
      <div className="leading-tight">
        <div className="text-[15px] font-semibold text-white">MedOps</div>
        <div className="text-[11px] text-slate-400">Pharmacy operations</div>
      </div>
    </div>
  );
}

export default function AppShell({
  user,
  children,
}: {
  user: ShellUser;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-nav-900 lg:flex">
        <div className="px-5 pt-5 pb-6">
          <Brand />
        </div>
        <div className="flex-1 px-3">
          <div className="mb-2 px-3 text-[11px] font-medium tracking-wider text-slate-500 uppercase">
            Workspace
          </div>
          <SidebarNav role={user.role} orientation="vertical" />
        </div>
        <div className="mx-3 mb-3 rounded-md border border-dashed border-nav-700 px-3 py-2 text-[11px] leading-snug text-slate-400">
          Demo environment. All patients and orders are fictional — no PHI.
        </div>
        <div className="flex items-center gap-3 border-t border-nav-800 px-4 py-4">
          <Avatar name={user.name} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-white">
              {user.name}
            </div>
            <RoleBadge role={user.role} tone="dark" />
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="bg-nav-900 lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Brand />
          <div className="flex items-center gap-2">
            <Avatar name={user.name} size="sm" />
            <LogoutButton />
          </div>
        </div>
        <SidebarNav role={user.role} orientation="horizontal" />
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
