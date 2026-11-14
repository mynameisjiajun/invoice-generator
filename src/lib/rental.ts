// Equipment rental helpers (Apex Cinematics). Rental periods are stored in
// invoices.rental_start / rental_end as dates ("YYYY-MM-DD", the form's
// default since Nov 2026: no times needed) or, on older rentals, as
// datetime-local strings ("YYYY-MM-DDTHH:mm", Singapore time).

import type { LineItem } from "./money";

const DT = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/;

function parse(value: string | null | undefined): { date: Date; hasTime: boolean } | null {
  const m = (value ?? "").match(DT);
  if (!m) return null;
  const hasTime = m[4] !== undefined;
  return {
    date: new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hasTime ? Number(m[4]) : 0, hasTime ? Number(m[5]) : 0),
    hasTime,
  };
}

/** Chargeable days for a rental period. Dates only: return date minus
 *  collection date, with a same-day hire counting as 1. With times (older
 *  rentals): every started 24 hours is a day. Minimum 1. Null when either
 *  end is missing/invalid or the return is before the collection. */
export function rentalDays(start: string | null | undefined, end: string | null | undefined): number | null {
  const a = parse(start), b = parse(end);
  if (!a || !b) return null;
  const ms = b.date.getTime() - a.date.getTime();
  if (!a.hasTime && !b.hasTime) {
    if (ms < 0) return null;
    return Math.max(1, Math.round(ms / 86_400_000));
  }
  if (ms <= 0) return null;
  return Math.max(1, Math.ceil(ms / 86_400_000));
}

/** "Sat 14 Nov 2026" (dates), or "Sat 14 Nov 2026, 10:00 am" for older
 *  rentals with a time. Falls back to the raw value if unparseable. */
export function formatRentalDateTime(value: string | null | undefined): string {
  const p = parse(value);
  if (!p) return value ?? "";
  const date = p.date.toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).replace(/,/g, "");
  if (!p.hasTime) return date;
  const time = p.date.toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${date}, ${time}`;
}

/** "1 day" / "3 days". */
export function daysLabel(n: number): string {
  return `${n} day${n === 1 ? "" : "s"}`;
}

/** Message for a rental period that can't be right, or null if it's fine.
 *  `complete` also requires both ends to be filled in (finalizing). */
export function rentalPeriodError(start: string, end: string, complete = false): string | null {
  if (!start || !end) {
    return complete ? "Add the collection and return dates for this rental" : null;
  }
  return rentalDays(start, end) === null ? "The return date can't be before the collection date" : null;
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
