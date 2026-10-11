/** Whole years between a YYYY-MM-DD birth date and `now`. */
export function ageFrom(dateOfBirth: string, now: Date = new Date()): number {
  const [y, m, d] = dateOfBirth.split("-").map(Number);
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) {
    age -= 1;
  }
  return age;
}

/** "Mar 12, 1984 (42 y)". */
export function formatBirthDate(dateOfBirth: string | null): string {
  if (!dateOfBirth) return "Not recorded";
  const [y, m, d] = dateOfBirth.split("-").map(Number);
  const label = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${label} (${ageFrom(dateOfBirth)} y)`;
}
