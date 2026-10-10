import { Cross } from "lucide-react";

export function BrandMark({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-lg bg-brand-600 text-white shadow-sm ${
        size === "lg" ? "size-11" : "size-8"
      }`}
    >
      <Cross
        className={size === "lg" ? "size-6" : "size-4.5"}
        fill="currentColor"
        strokeWidth={0}
      />
    </span>
  );
}
