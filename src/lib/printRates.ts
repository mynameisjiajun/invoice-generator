// JJ Gears & Prints rate card. Prices are Material Weight + Print Time,
// exactly as published to customers — change them here when the card
// changes. Invoices store the price that was charged, so editing a rate
// never alters an invoice that already exists.

export const MATERIALS = [
  { name: "PLA Basic", centsPerGram: 3 },
  { name: "PETG", centsPerGram: 3 },
  { name: "PLA+", centsPerGram: 4 },
  { name: "PLA Matte", centsPerGram: 4 },
  { name: "PLA Galaxy", centsPerGram: 5 },
  { name: "TPU", centsPerGram: 6 },
] as const;

/** Print time / electricity rate. */
export const CENTS_PER_HOUR = 200;
/** Multi-colour (AMS) surcharge on the time fee only. */
export const MULTI_COLOUR_TIME_SURCHARGE = 0.2;
/** Express (1–2 days) is charged per build plate. */
export const EXPRESS_CENTS_PER_PLATE = 500;

/** Specs for one printed part, stored on its line item. `material` is
 *  free text so a material that isn't on the card can still be invoiced
 *  (it just has no rate, so nothing is calculated for it). */
export type PrintSpec = {
  material: string;
  colour: string;
  grams: number;
  hours: number;
  multiColour: boolean;
};

export function emptyPrintSpec(): PrintSpec {
  return { material: MATERIALS[0].name, colour: "", grams: 0, hours: 0, multiColour: false };
}

export function materialRate(material: string): number | null {
  return MATERIALS.find((m) => m.name === material)?.centsPerGram ?? null;
}

export type PrintBreakdown = { materialCents: number; timeCents: number; totalCents: number };

/** Per-piece price from the rate card, or null when there's nothing to
 *  calculate (unknown material, or no grams/hours entered yet). */
export function printBreakdown(spec: PrintSpec): PrintBreakdown | null {
  const rate = materialRate(spec.material);
  if (rate === null || (spec.grams <= 0 && spec.hours <= 0)) return null;
  const materialCents = Math.round(Math.max(spec.grams, 0) * rate);
  const timeCents = Math.round(
    Math.max(spec.hours, 0) * CENTS_PER_HOUR * (spec.multiColour ? 1 + MULTI_COLOUR_TIME_SURCHARGE : 1),
  );
  return { materialCents, timeCents, totalCents: materialCents + timeCents };
}

/** "PLA Basic, Black · 40g · 2h · Multi-colour" — the spec line under a
 *  part's name. Empty parts are left out. */
export function printSpecLine(spec: PrintSpec): string {
  const mat = [spec.material.trim(), spec.colour.trim()].filter(Boolean).join(", ");
  return [
    mat,
    spec.grams > 0 ? `${spec.grams}g` : "",
    spec.hours > 0 ? `${spec.hours}h` : "",
    spec.multiColour ? "Multi-colour" : "",
  ].filter(Boolean).join(" · ");
}

/** Handover is stored in the invoice's existing `job_location` field as
 *  "Collection" or "Delivery: <address>", so no schema change is needed. */
export type Handover = { mode: "collection" | "delivery"; address: string };

export function parseHandover(location: string): Handover {
  const m = location.trim().match(/^Delivery(?::\s*([\s\S]*))?$/);
  if (m) return { mode: "delivery", address: (m[1] ?? "").trim() };
  return { mode: "collection", address: "" };
}

export function formatHandover(h: Handover): string {
  if (h.mode === "collection") return "Collection";
  return h.address.trim() ? `Delivery: ${h.address.trim()}` : "Delivery";
}

/** The ready-by date is picked with a date input and stored as ISO
 *  (YYYY-MM-DD); show it as "10 Oct 2026". Free text (photo invoices'
 *  "20 June 2026, 7-9PM") passes through unchanged. */
export function formatJobDate(value: string): string {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return value;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
}
