import {
  CircleCheck,
  CircleX,
  Clock,
  LogIn,
  PackageCheck,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";

import type { OrderStatus } from "@/db/schema";

export const STATUS_ICONS: Record<OrderStatus, LucideIcon> = {
  pending: Clock,
  verified: ShieldCheck,
  filled: PackageCheck,
  completed: CircleCheck,
  cancelled: CircleX,
};

export const AUDIT_ICONS: Record<string, { icon: LucideIcon; tint: string }> = {
  "order.create": { icon: Plus, tint: "bg-slate-100 text-slate-600" },
  "order.verify": { icon: ShieldCheck, tint: "bg-brand-50 text-brand-600" },
  "order.fill": { icon: PackageCheck, tint: "bg-violet-50 text-violet-600" },
  "order.complete": { icon: CircleCheck, tint: "bg-emerald-50 text-emerald-600" },
  "order.cancel": { icon: CircleX, tint: "bg-red-50 text-red-600" },
  "inventory.adjust": { icon: SlidersHorizontal, tint: "bg-amber-50 text-amber-700" },
  "user.login": { icon: LogIn, tint: "bg-slate-100 text-slate-500" },
};

export const AUDIT_FALLBACK = { icon: SlidersHorizontal, tint: "bg-slate-100 text-slate-600" };
