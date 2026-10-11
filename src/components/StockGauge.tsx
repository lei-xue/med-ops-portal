import { isLowStock } from "@/lib/permissions";

/**
 * Stock on hand against a shared scale, with a tick at the reorder threshold.
 * Red at/below threshold, amber within 25% above it, blue otherwise.
 */
export function StockGauge({
  stock,
  threshold,
  scale,
}: {
  stock: number;
  threshold: number;
  scale: number;
}) {
  const low = isLowStock({ stockQuantity: stock, reorderThreshold: threshold });
  const near = !low && stock <= threshold * 1.25;
  const pct = (n: number) => `${Math.min(100, (n / Math.max(scale, 1)) * 100)}%`;
  return (
    <div
      role="img"
      aria-label={`${stock} on hand, reorder at ${threshold}`}
      className="relative h-1.5 w-full rounded-full bg-slate-100"
    >
      <div
        className={`absolute inset-y-0 left-0 rounded-full ${
          low ? "bg-red-500" : near ? "bg-amber-500" : "bg-brand-500"
        }`}
        style={{ width: pct(stock) }}
      />
      <div
        aria-hidden
        title={`Reorder at ${threshold}`}
        className="absolute -inset-y-1 w-0.5 rounded-full bg-slate-500"
        style={{ left: pct(threshold) }}
      />
    </div>
  );
}
