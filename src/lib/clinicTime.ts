const DEFAULT_TIME_ZONE = "America/New_York";

function resolveTimeZone(value: string | undefined): string {
  const candidate = value?.trim() || DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate });
    return candidate;
  } catch {
    console.warn(`Invalid CLINIC_TIME_ZONE "${candidate}", falling back to UTC`);
    return "UTC";
  }
}

/**
 * The pharmacy's local time zone (IANA name, e.g. "America/Toronto").
 * "Today" in dashboard counts and every displayed timestamp use this zone,
 * not the server's, which is UTC inside the container.
 */
export const CLINIC_TIME_ZONE = resolveTimeZone(process.env.CLINIC_TIME_ZONE);
