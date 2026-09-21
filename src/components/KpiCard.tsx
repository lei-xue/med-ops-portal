import Link from "next/link";

interface KpiCardProps {
  label: string;
  value: number;
  href: string;
  tone?: "teal" | "sky" | "emerald" | "rose";
  hint?: string;
}

const TONE_STYLES = {
  teal: "text-teal-600 border-teal-200",
  sky: "text-sky-600 border-sky-200",
  emerald: "text-emerald-600 border-emerald-200",
  rose: "text-rose-600 border-rose-200",
} as const;

export function KpiCard({ label, value, href, tone = "teal", hint }: KpiCardProps) {
  return (
    <Link
      href={href}
      className={`block rounded-lg border bg-white p-4 shadow-sm transition-colors hover:bg-slate-50 ${TONE_STYLES[tone]}`}
    >
      <div className="text-xs font-medium tracking-wide text-slate-500 uppercase">
        {label}
      </div>
      <div className={`mt-1 text-3xl font-semibold tabular-nums ${TONE_STYLES[tone].split(" ")[0]}`}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </Link>
  );
}
