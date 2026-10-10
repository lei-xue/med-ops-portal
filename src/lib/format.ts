const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDateTime(value: Date | string): string {
  return dateTimeFormat.format(new Date(value));
}

const relativeFormat = new Intl.RelativeTimeFormat("en-US", {
  numeric: "auto",
  style: "short",
});

const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.35],
  ["month", 12],
  ["year", Number.POSITIVE_INFINITY],
];

/** "5 min. ago", "yesterday", "3 wk. ago" — relative to `now`. */
export function formatRelative(
  value: Date | string,
  now: Date = new Date(),
): string {
  let delta = (new Date(value).getTime() - now.getTime()) / 1000;
  if (Math.abs(delta) < 45) return "just now";
  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(delta) < size) {
      return relativeFormat.format(Math.round(delta), unit);
    }
    delta /= size;
  }
  return formatDateTime(value);
}
