// Equipment rental helpers (Apex Cinematics). Rental periods are stored as
// `datetime-local` strings ("YYYY-MM-DDTHH:mm", Singapore local time) in
// invoices.rental_start / rental_end.

import type { LineItem } from "./money";

const DT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function parse(value: string | null | undefined): Date | null {
  const m = (value ?? "").match(DT);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
}

/** Chargeable days for a rental period: every started 24 hours counts as a
 *  day (matches the T&C's late-return rule), minimum 1. Null when either end
 *  is missing/invalid or the return is not after collection. */
export function rentalDays(start: string | null | undefined, end: string | null | undefined): number | null {
  const a = parse(start), b = parse(end);
  if (!a || !b) return null;
  const ms = b.getTime() - a.getTime();
  if (ms <= 0) return null;
  return Math.max(1, Math.ceil(ms / 86_400_000));
}

/** "Sat 14 Nov 2026, 10:00 am" — falls back to the raw value if unparseable. */
export function formatRentalDateTime(value: string | null | undefined): string {
  const d = parse(value);
  if (!d) return value ?? "";
  const date = d.toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${date.replace(/,/g, "")}, ${time}`;
}

/** "1 day" / "3 days". */
export function daysLabel(n: number): string {
  return `${n} day${n === 1 ? "" : "s"}`;
}

/** Message for a rental period that can't be right, or null if it's fine.
 *  `complete` also requires both ends to be filled in (finalizing). */
export function rentalPeriodError(start: string, end: string, complete = false): string | null {
  if (!start || !end) {
    return complete ? "Add the collection and return date & time for this rental" : null;
  }
  return rentalDays(start, end) === null ? "The return time must be after the collection time" : null;
}

/** A blank equipment line for a rental of `days` days. */
export function newRentalLine(days: number): LineItem {
  return { description: "", qty: 1, unitPriceCents: 0, rental: { days } };
}

/** Switching a form to rental: every non-print line becomes a rental line
 *  (description, qty and price kept; the price is read as a day rate). */
export function toRentalLines(lines: LineItem[], days: number): LineItem[] {
  return lines.map((li) => (li.print || li.rental ? li : { ...li, rental: { days } }));
}

/** Switching back: drop the rental specs, keep everything else. */
export function fromRentalLines(lines: LineItem[]): LineItem[] {
  return lines.map((li) => {
    if (!li.rental) return li;
    const { rental: _rental, ...rest } = li; // eslint-disable-line @typescript-eslint/no-unused-vars
    return rest;
  });
}

/** The rental period changed from `prevDays` to `nextDays`: move every line
 *  still on the old count to the new one. Lines whose days were changed by
 *  hand (e.g. a lens needed for one day of a three-day hire) stay put. */
export function syncRentalDays(lines: LineItem[], prevDays: number, nextDays: number): LineItem[] {
  if (prevDays === nextDays) return lines;
  return lines.map((li) =>
    li.rental && li.rental.days === prevDays ? { ...li, rental: { ...li.rental, days: nextDays } } : li);
}
