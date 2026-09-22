"use client";
import { useState } from "react";
import { displayText, parseAmount } from "@/lib/numberInput";

/** A numeric text input you can actually type decimals into.
 *
 *  The obvious controlled pattern — `value={n || ""}` with
 *  `onChange={e => setN(parseFloat(e.target.value) || 0)}` — rewrites the
 *  input's text from the parsed number on every keystroke, which silently
 *  eats an in-progress decimal point:
 *
 *    type "8"  -> 8      -> redisplays "8"
 *    type "7"  -> 87     -> redisplays "87"
 *    type "."  -> 87     -> redisplays "87"     <- the dot is gone
 *    type "5"  -> 875    -> redisplays "875"
 *    type "0"  -> 8750   -> redisplays "8750"
 *
 *  So entering 87.50 produced 8750 — a silent 100x error on a real invoice.
 *
 *  The fix is to let the raw text lead while the user is mid-edit, and only
 *  re-derive the text from the number once they leave the field. Intermediate
 *  states that aren't valid numbers yet ("87.", "", ".5", "-") survive long
 *  enough to finish typing, while `onValueChange` still fires continuously so
 *  running totals stay live.
 */
export default function NumberInput({
  value,
  onValueChange,
  className = "input",
  ...rest
}: {
  /** The committed numeric value, in display units (dollars, not cents). */
  value: number;
  onValueChange: (n: number) => void;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  // null = not being edited, so the text is derived from `value`. A string
  // means the user is mid-edit and their literal keystrokes win.
  const [draft, setDraft] = useState<string | null>(null);

  const text = displayText(draft, value);

  return (
    <input
      {...rest}
      className={className}
      inputMode={rest.inputMode ?? "decimal"}
      value={text}
      onChange={(e) => {
        const next = e.target.value;
        setDraft(next);
        // parseAmount("87.") === 87. The draft keeps the trailing dot on
        // screen; the model just doesn't see it yet.
        onValueChange(parseAmount(next));
      }}
      // Hand control back to `value` so the field re-normalises ("007" -> "7",
      // "87." -> "87") and later programmatic changes show up.
      onBlur={(e) => {
        setDraft(null);
        rest.onBlur?.(e);
      }}
    />
  );
}
