import { formatDateTime, formatRelative } from "@/lib/format";

/** Relative timestamp with the absolute time on hover. */
export function RelativeTime({
  value,
  className = "",
}: {
  value: Date | string;
  className?: string;
}) {
  const date = new Date(value);
  return (
    <time
      dateTime={date.toISOString()}
      title={formatDateTime(date)}
      className={`text-xs whitespace-nowrap tabular-nums ${className}`}
    >
      {formatRelative(date)}
    </time>
  );
}
