/** The pure half of <NumberInput>, split out so the behaviour that actually
 *  bit us is unit-testable without a DOM environment. */

/** What the input should show.
 *
 *  `draft` is the user's literal keystrokes while the field is focused, and
 *  it always wins — that's the whole fix. Deriving the text from `value` on
 *  every keystroke is what silently ate the decimal point and turned 87.50
 *  into 8750.
 *
 *  With no draft (not being edited) the text comes from the number, and 0
 *  renders as empty so a fresh line item shows its placeholder rather than
 *  reading as already filled in. */
export function displayText(draft: string | null, value: number): string {
  if (draft !== null) return draft;
  return value ? String(value) : "";
}

/** Text → number for the model. Incomplete input ("", ".", "87.", "-") is
 *  worth 0 so running totals stay defined; the draft keeps the partial text
 *  on screen meanwhile, so the user never sees their typing corrected. */
export function parseAmount(text: string): number {
  return parseFloat(text) || 0;
}

/** Replays a sequence of keystrokes through the same display/parse cycle the
 *  component performs, returning what the field shows and what the model
 *  holds. Exists so a regression of the 100x bug fails a test instead of an
 *  invoice. `commit` mimics blur, where the draft is dropped and the text is
 *  re-derived from the number. */
export function simulateTyping(
  keys: string,
  opts: { commit?: boolean } = {},
): { text: string; value: number } {
  let draft: string | null = null;
  let value = 0;

  for (const key of keys) {
    const next: string = displayText(draft, value) + key;
    draft = next;
    value = parseAmount(next);
  }

  if (opts.commit) draft = null;
  return { text: displayText(draft, value), value };
}
