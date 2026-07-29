export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Derives an invoice-number prefix from a business name: initials of up to
 *  three words, uppercased, e.g. "3D Printing" -> "DP-", "JJ Visuals" -> "JV-".
 *  `taken` is the set of prefixes already in use by other businesses — pass
 *  every existing business's invoice_prefix so two businesses never share
 *  one (each business's own numbering is independent, but a shared prefix
 *  reads as "the same series" and confuses PayNow references). Falls back
 *  to appending digits until free. */
export function invoicePrefix(name: string, taken: Iterable<string>): string {
  const takenSet = new Set(taken);
  const words = name.trim().toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  const initials = (words.length > 0 ? words.slice(0, 3).map((w) => w[0]).join("") : "INV");
  let candidate = `${initials}-`;
  let n = 2;
  while (takenSet.has(candidate)) {
    candidate = `${initials}${n}-`;
    n += 1;
  }
  return candidate;
}
