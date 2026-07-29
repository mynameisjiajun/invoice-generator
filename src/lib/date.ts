/** Today's date as YYYY-MM-DD in the browser's local timezone.
 *  `new Date().toISOString()` is UTC — in Singapore (UTC+8) that stamps
 *  "yesterday" for the first 8 hours of every day. Use this instead
 *  anywhere a date is captured "as of now" (issue date, paid date). */
export function todayLocalIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Adds `days` to a bare YYYY-MM-DD date string. Safe from local-timezone
 *  drift: a bare date string parses as UTC midnight, and re-serializing
 *  via toISOString() stays UTC throughout, so the offset never leaks in. */
export function plusDaysIso(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
