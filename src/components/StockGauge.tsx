import { isLowStock } from "@/lib/permissions";

/**
 * Horizontal bar of stock on hand against a shared scale, with a tick at the
 * reorder threshold. Turns signal-orange at or below the threshold.
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
  const pct = (n: number) => `${Math.min(100, (n / Math.max(scale, 1)) * 100)}%`;
  return (
    <div
      role="img"
      aria-label={`${stock} on hand, reorder at ${threshold}`}
      className="relative h-2 w-full bg-rule-soft"
    >
      <div
        className={`absolute inset-y-0 left-0 ${low ? "bg-signal" : "bg-ink"}`}
        style={{ width: pct(stock) }}
      />
      <div
        aria-hidden
        className="absolute -inset-y-1 w-px bg-ink-2"
        style={{ left: pct(threshold) }}
      />
    </div>
  );
}
