import type { PrintSpec } from "./printRates";

/** Equipment-rental line (Apex Cinematics): `unitPriceCents` is the day rate
 *  per unit and `qty` is the number of units. `replacementCents` is the
 *  Replacement Value the rental T&C refers to; 0/absent means "not stated". */
export type RentalSpec = { days: number; replacementCents?: number };

/** `print` is set on 3D-print parts (JJ Gears & Prints); `rental` on
 *  equipment-rental lines; fees and every photography line leave both off. */
export type LineItem = {
  description: string; qty: number; unitPriceCents: number;
  print?: PrintSpec; rental?: RentalSpec;
};
export type DiscountType = "none" | "amount" | "percent";

export function lineTotalCents(item: LineItem): number {
  const days = item.rental ? item.rental.days : 1;
  return Math.round(item.qty * days * item.unitPriceCents);
}

export function subtotalCents(items: LineItem[]): number {
  return items.reduce((sum, item) => sum + lineTotalCents(item), 0);
}

export function discountCents(subtotal: number, type: DiscountType, value: number): number {
  let cents = 0;
  if (type === "amount") cents = Math.round(value * 100);
  if (type === "percent") cents = Math.round((subtotal * value) / 100);
  return Math.min(Math.max(cents, 0), subtotal);
}

export function totalCents(items: LineItem[], type: DiscountType, value: number): number {
  const sub = subtotalCents(items);
  return sub - discountCents(sub, type, value);
}

export function formatSGD(cents: number): string {
  return (cents / 100).toLocaleString("en-SG", {
    style: "currency", currency: "SGD", currencyDisplay: "symbol",
  }).replace("SGD", "$").replace("S$", "$");
}

/** Short money for tight spots like chart bar labels, where a full
 *  "$2,200.00" is wider than the column it sits above: $450, $2.2k, $1.3M. */
export function formatSGDCompact(cents: number): string {
  const dollars = Math.round(cents / 100);
  const abs = Math.abs(dollars);
  const sign = dollars < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${trimZero(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}$${trimZero(abs / 1_000)}k`;
  return `${sign}$${abs}`;
}

/** 2.0 -> "2", 2.25 -> "2.3" — one decimal, without a trailing ".0". */
function trimZero(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "");
}
