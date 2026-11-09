"use client";
import { formatSGD } from "@/lib/money";
import NumberInput from "@/components/NumberInput";

// The share paid upfront: 0 = after the job, 100 = in full before the shoot,
// anything between = deposit to book the date, balance on delivery.
const OPTIONS = [
  { pct: 0, label: "After the job" },
  { pct: 100, label: "Full before the shoot" },
  { pct: 50, label: "50% to book" },
] as const;

/** "When do they pay?" — one invoice whichever way: after the job, in full
 *  before the shoot, or part upfront to lock the date. */
export default function DepositField({ percent, totalCents, onChange }: {
  percent: number; totalCents: number; onChange: (percent: number) => void;
}) {
  const isPreset = OPTIONS.some((o) => o.pct === percent);
  const deposit = Math.round((totalCents * percent) / 100);
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="section-label">When do they pay?</div>
      <div className="chip-row" style={{ paddingBottom: 0 }} role="group" aria-label="When do they pay">
        {OPTIONS.map((o) => (
          <button key={o.pct} type="button" className={`chip ${percent === o.pct ? "chip-active" : ""}`}
            aria-pressed={percent === o.pct} onClick={() => onChange(o.pct)}>
            {o.label}
          </button>
        ))}
        <button type="button" className={`chip ${!isPreset ? "chip-active" : ""}`}
          aria-pressed={!isPreset} onClick={() => { if (isPreset) onChange(30); }}>
          Custom %
        </button>
      </div>
      {!isPreset && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, maxWidth: 200 }}>
          <NumberInput aria-label="Percentage paid upfront" placeholder="30" value={percent}
            onValueChange={(n) => onChange(Math.min(99, Math.max(1, n)))} />
          <span style={{ color: "var(--text-secondary)", whiteSpace: "nowrap" }}>% to book</span>
        </div>
      )}
      <p style={{ margin: "10px 0 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
        {percent === 0
          ? "One invoice, paid after the job (by the due date)."
          : percent >= 100
            ? "One invoice, paid in full before the shoot to confirm the booking."
            : totalCents > 0
              ? <><strong style={{ color: "var(--text-primary)" }}>{formatSGD(deposit)}</strong> now to lock the date · {formatSGD(totalCents - deposit)} on delivery. Still one invoice.</>
              : `${percent}% now to lock the date, the rest on delivery. Still one invoice.`}
      </p>
    </div>
  );
}
