import type { Invoice } from "./types";

const real = (invoices: Invoice[]) => invoices.filter((i) => i.status !== "draft");

export function yearlyStats(invoices: Invoice[]) {
  const map = new Map<number, { invoicedCents: number; collectedCents: number }>();
  for (const i of real(invoices)) {
    const year = Number(i.issue_date.slice(0, 4));
    const e = map.get(year) ?? { invoicedCents: 0, collectedCents: 0 };
    e.invoicedCents += i.total_cents;
    if (i.status === "paid") e.collectedCents += i.total_cents;
    map.set(year, e);
  }
  return [...map.entries()]
    .map(([year, e]) => ({ year, ...e }))
    .sort((a, b) => b.year - a.year);
}

export function monthlyStats(invoices: Invoice[], year: number) {
  const months = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1, invoicedCents: 0, collectedCents: 0,
  }));
  for (const i of real(invoices)) {
    if (Number(i.issue_date.slice(0, 4)) !== year) continue;
    const m = months[Number(i.issue_date.slice(5, 7)) - 1];
    m.invoicedCents += i.total_cents;
    if (i.status === "paid") m.collectedCents += i.total_cents;
  }
  return months;
}

export function clientStats(invoices: Invoice[]) {
  const map = new Map<string, number>();
  for (const i of real(invoices)) {
    const name = i.customers?.name ?? "Unknown";
    map.set(name, (map.get(name) ?? 0) + i.total_cents);
  }
  return [...map.entries()]
    .map(([name, invoicedCents]) => ({ name, invoicedCents }))
    .sort((a, b) => b.invoicedCents - a.invoicedCents);
}
