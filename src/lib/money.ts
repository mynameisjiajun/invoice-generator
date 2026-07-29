export type LineItem = { description: string; qty: number; unitPriceCents: number };
export type DiscountType = "none" | "amount" | "percent";

export function lineTotalCents(item: LineItem): number {
  return Math.round(item.qty * item.unitPriceCents);
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
