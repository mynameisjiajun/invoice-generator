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
