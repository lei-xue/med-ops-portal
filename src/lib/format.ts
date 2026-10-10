import { CLINIC_TIME_ZONE } from "@/lib/clinicTime";

// Explicit fields rather than dateStyle/timeStyle: those can't be combined
// with timeZoneName (Node 22 throws).
const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: CLINIC_TIME_ZONE,
  timeZoneName: "short",
});

const longDateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: CLINIC_TIME_ZONE,
});

/** "Saturday, October 10, 2026" in the clinic's time zone. */
export function formatLongDate(value: Date | string): string {
  return longDateFormat.format(new Date(value));
}

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

/** "1 tube", "2 tubes", "100 mL": stock units are stored in the plural. */
export function formatQuantity(quantity: number, unit: string): string {
  const singular = quantity === 1 && unit.endsWith("s") ? unit.slice(0, -1) : unit;
  return `${quantity.toLocaleString("en-US")} ${singular}`;
}
