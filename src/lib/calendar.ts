// Calendar: shoots and rental periods by day, plus double-booking warnings.

import { formatJobDate } from "./printRates";
import type { Invoice } from "./types";

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Best-effort date from the free-text job_date of older invoices:
 *  "20 June 2026, 7-9PM", "2026-06-20", "20/6/2026". Null if unreadable. */
export function parseLooseDate(text: string | null | undefined): string | null {
  const t = (text ?? "").trim();
  let m = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = t.match(/\b(\d{1,2})\s+([A-Za-z]{3,})\.?,?\s+(\d{4})/);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) return iso(+m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]);
  m = t.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (m) return iso(+m[3], +m[2], +m[1]);
  return null;
}

export function shootDateOf(inv: Invoice): string | null {
  if (inv.is_rental) return null;
  return inv.shoot_date || parseLooseDate(inv.job_date);
}

export type CalEvent = {
  id: string; href: string; kind: "shoot" | "rental";
  start: string; end: string;           // ISO dates, inclusive
  title: string; sub: string; tentative: boolean; // tentative = open quote
  items: string[];                       // rental item names, lower-cased
};

export function calendarEvents(invoices: Invoice[], quotes: Invoice[]): CalEvent[] {
  const out: CalEvent[] = [];
  const add = (inv: Invoice, tentative: boolean) => {
    if (inv.status === "draft") return;
    const who = inv.customers?.name ?? "No client";
    const href = `/invoices_login/invoices/${inv.id}`;
    if (inv.is_rental) {
      const start = (inv.rental_start ?? "").slice(0, 10);
      const end = (inv.rental_end ?? "").slice(0, 10) || start;
      if (!start) return;
      out.push({
        id: inv.id, href, kind: "rental", start, end: end < start ? start : end, tentative,
        title: `Rental · ${who}`, sub: inv.invoice_number ?? "",
        items: inv.line_items.filter((li) => li.rental).map((li) => li.description.trim().toLowerCase()).filter(Boolean),
      });
      return;
    }
    const day = shootDateOf(inv);
    if (!day) return;
    out.push({
      id: inv.id, href, kind: "shoot", start: day, end: day, tentative,
      title: `${inv.job_event || "Shoot"} · ${who}`, sub: [inv.invoice_number, inv.job_date].filter(Boolean).join(" · "),
      items: [],
    });
  };
  invoices.forEach((i) => add(i, false));
  quotes.filter((q) => !q.converted_invoice_id).forEach((q) => add(q, true));
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

const overlaps = (a: CalEvent, b: CalEvent) => a.start <= b.end && b.start <= a.end;

/** Double-booking warnings: two shoots the same day, a shoot while gear is
 *  out on rental, or the same item rented out twice at once. */
export function clashes(events: CalEvent[]): { key: string; text: string; date: string }[] {
  const out: { key: string; text: string; date: string }[] = [];
  const firm = events; // quotes count too: they're dates you've offered
  for (let i = 0; i < firm.length; i++) {
    for (let j = i + 1; j < firm.length; j++) {
      const a = firm[i], b = firm[j];
      if (!overlaps(a, b)) continue;
      const date = a.start > b.start ? a.start : b.start;
      if (a.kind === "shoot" && b.kind === "shoot") {
        out.push({ key: `${a.id}|${b.id}`, date, text: `Two shoots on ${formatJobDate(date)}: ${a.title} and ${b.title}` });
      } else if (a.kind !== b.kind) {
        const shoot = a.kind === "shoot" ? a : b;
        const rental = a.kind === "rental" ? a : b;
        out.push({ key: `${a.id}|${b.id}`, date, text: `${shoot.title} on ${formatJobDate(shoot.start)} while gear is out (${rental.title}). Check you have what you need.` });
      } else {
        const shared = a.items.filter((x) => b.items.includes(x));
        if (shared.length) {
          out.push({ key: `${a.id}|${b.id}`, date, text: `Rented twice at once from ${formatJobDate(date)}: ${shared.join(", ")} (${a.title} and ${b.title})` });
        }
      }
    }
  }
  return out;
}
