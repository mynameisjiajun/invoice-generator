"use client";
import type { LineItem } from "@/lib/money";
import { formatSGD, lineTotalCents } from "@/lib/money";
import { daysLabel, rentalDays, rentalPeriodError } from "@/lib/rental";
import { IconClose } from "@/components/icons";
import NumberInput from "@/components/NumberInput";

/** "Shoot" vs "Equipment rental" switch at the top of the job card
 *  (photo businesses only). Same chip styling as the print handover picker. */
export function RentalModeChips({ isRental, onChange }: {
  isRental: boolean; onChange: (isRental: boolean) => void;
}) {
  return (
    <div className="chip-row" style={{ paddingBottom: 0 }} role="group" aria-label="Invoice type">
      {([false, true] as const).map((rental) => (
        <button key={String(rental)} type="button"
          className={`chip ${isRental === rental ? "chip-active" : ""}`}
          aria-pressed={isRental === rental}
          onClick={() => { if (isRental !== rental) onChange(rental); }}>
          {rental ? "Equipment rental" : "Shoot / service"}
        </button>
      ))}
    </div>
  );
}

/** Rental card fields. They reuse the invoice's job fields where they mean
 *  the same thing (project → job_event, collection & return → job_location)
 *  and add the rental period (rental_start / rental_end, datetime-local). */
export function RentalDetailsFields({ project, start, end, location, attachTerms, onChange, onAttachTermsChange }: {
  project: string; start: string; end: string; location: string;
  /** Whether the rental T&C pages go on the end of the invoice PDF. */
  attachTerms: boolean;
  onChange: (patch: { jobEvent?: string; rentalStart?: string; rentalEnd?: string; jobLocation?: string }) => void;
  onAttachTermsChange: (attach: boolean) => void;
}) {
  const days = rentalDays(start, end);
  const problem = rentalPeriodError(start, end);
  return (
    <>
      <div>
        <label className="input-label">Production / project (optional)</label>
        <input className="input" placeholder="e.g. Short film — Night Market"
          value={project} onChange={(e) => onChange({ jobEvent: e.target.value })} />
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 180px" }}>
          <label className="input-label">Collection</label>
          <input type="date" className="input" aria-label="Collection date"
            value={start.slice(0, 10)} onChange={(e) => onChange({ rentalStart: e.target.value })} />
        </div>
        <div style={{ flex: "1 1 180px" }}>
          <label className="input-label">Return</label>
          <input type="date" className="input" aria-label="Return date"
            min={start ? start.slice(0, 10) : undefined}
            value={end.slice(0, 10)} onChange={(e) => onChange({ rentalEnd: e.target.value })} />
        </div>
      </div>
      <p role={problem ? "alert" : undefined} style={{
        margin: "-2px 0 0", fontSize: "0.8rem", fontWeight: problem || days ? 600 : 400,
        color: problem ? "var(--warning)" : days ? "var(--text-primary)" : "var(--text-tertiary)",
      }}>
        {problem ?? (days ? `Rental period: ${daysLabel(days)}` : "Add collection and return times to work out the days")}
      </p>
      <div>
        <label className="input-label">Collection & return</label>
        <input className="input" placeholder="e.g. Self-collect & return at our studio"
          value={location} onChange={(e) => onChange({ jobLocation: e.target.value })} />
      </div>
      <div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
          <input type="checkbox" checked={attachTerms}
            onChange={(e) => onAttachTermsChange(e.target.checked)} />
          Attach the rental T&amp;C to the invoice PDF
        </label>
        <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
          {attachTerms
            ? "The T&C and a signature page with this invoice number follow the invoice."
            : "Untick only if you've sent the T&C separately. The invoice still says the rental is subject to them."}
        </p>
      </div>
    </>
  );
}

/** One rented item: name, qty, days, day rate, optional replacement value. */
export function RentalLineItem({ item, index, onChange, onRemove }: {
  item: LineItem; index: number;
  onChange: (item: LineItem) => void; onRemove: () => void;
}) {
  const rental = item.rental ?? { days: 1 };
  const n = index + 1;
  return (
    <div style={{
      background: "var(--bg-primary)",
      borderRadius: "var(--radius-md)",
      padding: 14,
      border: "1px solid var(--border-subtle)",
    }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 10 }}>
        <input className="input" placeholder="Item, e.g. Sony FX3 body"
          aria-label={`Item for line ${n}`}
          value={item.description}
          onChange={(e) => onChange({ ...item, description: e.target.value })} />
        <button className="btn-danger" aria-label="Remove item" onClick={onRemove}>
          <IconClose size={14} />
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <div style={{ width: 60 }}>
          <label className="input-label">Qty</label>
          <NumberInput placeholder="1" aria-label={`Quantity for line ${n}`}
            style={{ textAlign: "center" }} value={item.qty}
            onValueChange={(q) => onChange({ ...item, qty: q })} />
        </div>
        <div style={{ width: 60 }}>
          <label className="input-label">Days</label>
          <NumberInput placeholder="1" aria-label={`Days for line ${n}`}
            style={{ textAlign: "center" }} value={rental.days}
            onValueChange={(d) => onChange({ ...item, rental: { ...rental, days: d } })} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <label className="input-label">Day rate ($)</label>
          <NumberInput placeholder="0.00" aria-label={`Day rate for line ${n}`}
            value={item.unitPriceCents / 100}
            onValueChange={(v) => onChange({ ...item, unitPriceCents: Math.round(v * 100) })} />
        </div>
        <div style={{ textAlign: "right", minWidth: 72, paddingBottom: 10 }}>
          <span className="money" style={{ fontWeight: 700, fontSize: "0.95rem" }}>
            {formatSGD(lineTotalCents({ ...item, rental }))}
          </span>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <label className="input-label">Replacement value ($, optional)</label>
        <NumberInput placeholder="e.g. 5500" aria-label={`Replacement value for line ${n}`}
          value={(rental.replacementCents ?? 0) / 100}
          onValueChange={(v) => onChange({ ...item, rental: { ...rental, replacementCents: Math.round(v * 100) } })} />
        <p style={{ margin: "4px 0 0", fontSize: "0.72rem", color: "var(--text-tertiary)" }}>
          Not charged. It&apos;s what the renter pays if the item is lost or damaged beyond repair (T&amp;C 6.4).
        </p>
      </div>
    </div>
  );
}
