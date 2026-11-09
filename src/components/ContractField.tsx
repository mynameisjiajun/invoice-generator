"use client";
import NumberInput from "@/components/NumberInput";
import {
  CLAUSE_OPTIONS, matchPreset, presetContract, type ClauseId, type ContractSettings,
} from "@/lib/shootTerms";

/** "Shoot contract": off by default (friends, small jobs). On: pick
 *  Standard or Strict, then switch any clause for this client. */
export default function ContractField({ contract, depositPercent, onChange }: {
  contract: ContractSettings | null;
  depositPercent: number;
  onChange: (c: ContractSettings | null) => void;
}) {
  const hasDeposit = depositPercent > 0 && depositPercent < 100;

  function toggle(id: ClauseId, on: boolean) {
    if (!contract) return;
    const next = on ? [...contract.on, id] : contract.on.filter((x) => x !== id);
    onChange({ ...contract, on: next, preset: matchPreset(next) });
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="section-label">Shoot contract</div>
      <div className="chip-row" style={{ paddingBottom: 0 }} role="group" aria-label="Attach shoot contract">
        <button type="button" className={`chip ${!contract ? "chip-active" : ""}`} aria-pressed={!contract}
          onClick={() => onChange(null)}>
          No contract
        </button>
        {(["standard", "strict"] as const).map((p) => (
          <button key={p} type="button" className={`chip ${contract?.preset === p ? "chip-active" : ""}`}
            aria-pressed={contract?.preset === p}
            onClick={() => onChange(contract
              ? { ...presetContract(p), revisions: contract.revisions, deliveryDays: contract.deliveryDays }
              : presetContract(p))}>
            {p === "standard" ? "Standard" : "Strict"}
          </button>
        ))}
        {contract?.preset === "custom" && <span className="chip chip-active" aria-current="true">Custom</span>}
      </div>
      <p style={{ margin: "8px 0 0", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
        {!contract
          ? "For big jobs, or clients you're unsure about. Attaches a Shoot Agreement with a signature page."
          : contract.preset === "strict"
            ? "Standard, plus late-payment interest, \"no reply in 14 days = approved\" and overtime."
            : "Switch any condition on or off for this client."}
      </p>

      {contract && (
        <div style={{ display: "flex", flexDirection: "column", marginTop: 12 }}>
          {CLAUSE_OPTIONS.map((o) => {
            const on = contract.on.includes(o.id);
            const inactive = o.id === "deposit_nonrefundable" && !hasDeposit;
            return (
              <div key={o.id} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
                borderTop: "1px solid var(--border-subtle)", opacity: inactive ? 0.55 : 1,
              }}>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1, cursor: "pointer" }}>
                  <input type="checkbox" checked={on} onChange={(e) => toggle(o.id, e.target.checked)}
                    style={{ marginTop: 3 }} />
                  <span>
                    <span style={{ display: "block", fontSize: "0.88rem", color: "var(--text-primary)" }}>{o.label}</span>
                    <span style={{ display: "block", fontSize: "0.72rem", color: "var(--text-tertiary)" }}>
                      {inactive ? "No deposit on this invoice" : o.hint}
                    </span>
                  </span>
                </label>
                {on && o.id === "revisions" && (
                  <div style={{ width: 64 }}>
                    <NumberInput aria-label="Revision rounds included" value={contract.revisions}
                      style={{ textAlign: "center" }}
                      onValueChange={(n) => onChange({ ...contract, revisions: Math.max(0, Math.round(n)) })} />
                  </div>
                )}
                {on && o.id === "delivery" && (
                  <div style={{ width: 64 }}>
                    <NumberInput aria-label="Working days to deliver" value={contract.deliveryDays}
                      style={{ textAlign: "center" }}
                      onValueChange={(n) => onChange({ ...contract, deliveryDays: Math.max(1, Math.round(n)) })} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
