"use client";
import type { LineItem } from "@/lib/money";
import { formatSGD } from "@/lib/money";
import {
  MATERIALS, emptyPrintSpec, formatHandover, materialRate, parseHandover, printBreakdown,
  type PrintSpec,
} from "@/lib/printRates";
import { IconClose } from "@/components/icons";
import NumberInput from "@/components/NumberInput";

/** Project card fields for a 3D-print invoice. They reuse the invoice's
 *  job fields: project name → job_event, ready-by date → job_date (ISO),
 *  handover → job_location ("Collection" / "Delivery: <address>"). */
export function PrintProjectFields({ project, readyBy, location, customerAddress, onChange }: {
  project: string; readyBy: string; location: string;
  /** Pre-fills the delivery address the first time Delivery is picked. */
  customerAddress: string;
  onChange: (patch: { jobEvent?: string; jobDate?: string; jobLocation?: string }) => void;
}) {
  const handover = parseHandover(location);
  return (
    <>
      <div>
        <label className="input-label">Project</label>
        <input className="input" placeholder="e.g. Drone mount parts"
          value={project} onChange={(e) => onChange({ jobEvent: e.target.value })} />
      </div>
      <div>
        <label className="input-label">Handover</label>
        <div className="chip-row" style={{ paddingBottom: 0 }}>
          {(["collection", "delivery"] as const).map((mode) => (
            <button key={mode} type="button"
              className={`chip ${handover.mode === mode ? "chip-active" : ""}`}
              aria-pressed={handover.mode === mode}
              onClick={() => onChange({
                jobLocation: formatHandover({
                  mode, address: mode === "delivery" ? handover.address || customerAddress : "",
                }),
              })}>
              {mode === "collection" ? "Collection" : "Delivery"}
            </button>
          ))}
        </div>
        {handover.mode === "delivery" && (
          <input className="input" style={{ marginTop: 10 }} placeholder="Delivery address"
            autoComplete="street-address"
            value={handover.address}
            onChange={(e) => onChange({ jobLocation: formatHandover({ mode: "delivery", address: e.target.value }) })} />
        )}
      </div>
      <div>
        <label className="input-label">Ready by (optional)</label>
        <input type="date" className="input" value={readyBy}
          onChange={(e) => onChange({ jobDate: e.target.value })} />
      </div>
    </>
  );
}

/** One printed part: name, material chips, colour, grams/hours, and a
 *  price that follows the rate card until it's typed over. */
export function PrintLineItem({ item, index, onChange, onRemove }: {
  item: LineItem; index: number;
  onChange: (item: LineItem) => void;
  onRemove: () => void;
}) {
  const spec = item.print ?? emptyPrintSpec();
  const calc = printBreakdown(spec);
  const customMaterial = materialRate(spec.material) === null;

  // The price tracks the formula until the owner types their own. It counts
  // as overridden only when it differs from what the *current* specs
  // calculate to (or from 0 when nothing calculates yet), so editing grams
  // on an untouched line keeps auto-filling, while a hand-typed price is
  // never silently replaced.
  function setSpec(patch: Partial<PrintSpec>) {
    const next = { ...spec, ...patch };
    const overridden = item.unitPriceCents !== (calc?.totalCents ?? 0);
    const nextCalc = printBreakdown(next);
    onChange({
      ...item, print: next,
      unitPriceCents: overridden ? item.unitPriceCents : nextCalc?.totalCents ?? 0,
    });
  }

  return (
    <div style={{
      background: "var(--bg-primary)",
      borderRadius: "var(--radius-md)",
      padding: 14,
      border: "1px solid var(--border-subtle)",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <input className="input" placeholder="Part name, e.g. Phone stand"
          aria-label={`Part name for line ${index + 1}`}
          value={item.description}
          onChange={(e) => onChange({ ...item, description: e.target.value })} />
        <button className="btn-danger" style={{ marginTop: 6 }} aria-label="Remove line" onClick={onRemove}>
          <IconClose size={14} />
        </button>
      </div>

      <div>
        <label className="input-label">Material</label>
        <div className="chip-row" style={{ flexWrap: "wrap", paddingBottom: 0 }}>
          {MATERIALS.map((m) => (
            <button key={m.name} type="button"
              className={`chip ${spec.material === m.name ? "chip-active" : ""}`}
              aria-pressed={spec.material === m.name}
              onClick={() => setSpec({ material: m.name })}>
              {m.name}
            </button>
          ))}
          <button type="button" className={`chip ${customMaterial ? "chip-active" : ""}`}
            aria-pressed={customMaterial}
            onClick={() => { if (!customMaterial) setSpec({ material: "" }); }}>
            Other
          </button>
        </div>
        {customMaterial && (
          <input className="input" style={{ marginTop: 8 }} placeholder="Material name (price it yourself)"
            value={spec.material} onChange={(e) => setSpec({ material: e.target.value })} />
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 2 }}>
          <label className="input-label">Colour</label>
          <input className="input" placeholder="e.g. Black"
            value={spec.colour} onChange={(e) => setSpec({ colour: e.target.value })} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="input-label">Grams</label>
          <NumberInput placeholder="0" inputMode="decimal"
            aria-label={`Grams for line ${index + 1}, including flush tower`}
            title="Include the flush tower"
            value={spec.grams} onValueChange={(n) => setSpec({ grams: n })} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="input-label">Hours</label>
          <NumberInput placeholder="0" inputMode="decimal"
            aria-label={`Print hours for line ${index + 1}`}
            value={spec.hours} onValueChange={(n) => setSpec({ hours: n })} />
        </div>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
        <input type="checkbox" checked={spec.multiColour}
          onChange={(e) => setSpec({ multiColour: e.target.checked })} />
        Multi-colour (AMS) — +20% on print time
      </label>
      <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
        Grams should include the flush tower.
      </p>

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <div style={{ width: 72 }}>
          <label className="input-label">Qty</label>
          <NumberInput placeholder="1"
            aria-label={`Quantity for line ${index + 1}`}
            style={{ textAlign: "center" }}
            value={item.qty}
            onValueChange={(n) => onChange({ ...item, qty: n })} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="input-label">Price each ($)</label>
          <NumberInput placeholder="0.00"
            aria-label={`Unit price for line ${index + 1}`}
            value={item.unitPriceCents / 100}
            onValueChange={(n) => onChange({ ...item, unitPriceCents: Math.round(n * 100) })} />
        </div>
        <div style={{ textAlign: "right", minWidth: 80, paddingBottom: 10 }}>
          <span className="money" style={{ fontWeight: 700, fontSize: "0.95rem" }}>
            {formatSGD(Math.round(item.qty * item.unitPriceCents))}
          </span>
        </div>
      </div>

      {calc && (
        <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span>
            Rate card: material {formatSGD(calc.materialCents)} + time {formatSGD(calc.timeCents)} = {formatSGD(calc.totalCents)}
          </span>
          {item.unitPriceCents !== calc.totalCents && (
            <button type="button" className="btn-ghost" style={{ padding: "2px 8px", fontSize: "0.75rem" }}
              onClick={() => onChange({ ...item, unitPriceCents: calc.totalCents })}>
              ↺ Use {formatSGD(calc.totalCents)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
