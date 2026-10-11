// Deterministic tint so the same person keeps the same colour everywhere.
const TINTS = [
  "bg-brand-100 text-brand-700",
  "bg-emerald-100 text-emerald-800",
  "bg-amber-100 text-amber-800",
  "bg-violet-100 text-violet-800",
  "bg-sky-100 text-sky-800",
  "bg-rose-100 text-rose-800",
];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")
  ).toUpperCase();
}

export function Avatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md";
}) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden
      className={`inline-grid shrink-0 place-items-center rounded-full font-semibold ${
        TINTS[hash % TINTS.length]
      } ${size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs"}`}
    >
      {initials(name) || "?"}
    </span>
  );
}
