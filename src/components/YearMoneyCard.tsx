"use client";
import { useState } from "react";
import Link from "next/link";
import { formatSGD } from "@/lib/money";
import { AGE_BANDS, yearCsv, yearSummary, type AgeBand } from "@/lib/tax";
import type { Expense, Invoice } from "@/lib/types";

const AGE_KEY = "apex.stats.ageBand";

/** Profit, Form B's 4 lines and the MediSave + tax set-aside for one year.
 *  Only rendered client-side (after data loads), so localStorage is safe. */
export default function YearMoneyCard({ invoices, expenses, year, expensesReady }: {
  invoices: Invoice[]; expenses: Expense[]; year: number; expensesReady: boolean;
}) {
  const [age, setAge] = useState<AgeBand>(() => {
    try { return (localStorage.getItem(AGE_KEY) as AgeBand) || "under35"; } catch { return "under35"; }
  });
  const s = yearSummary(invoices, expenses, year, age);

  function exportCsv() {
    const blob = new Blob([yearCsv(s, invoices, expenses)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: `apex-${year}-form-b.csv` }).click();
    URL.revokeObjectURL(url);
  }

  const row = (label: string, cents: number, opts: { bold?: boolean; muted?: boolean; minus?: boolean } = {}) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: "0.9rem",
      fontWeight: opts.bold ? 700 : 400, color: opts.muted ? "var(--text-tertiary)" : undefined }}>
      <span>{label}</span>
      <span className="money">{opts.minus && cents > 0 ? "−" : ""}{formatSGD(cents)}</span>
    </div>
  );

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div className="section-label">{year} · profit &amp; set-aside</div>
        <Link href="/invoices_login/expenses" style={{ fontSize: "0.8rem" }}>Expenses ›</Link>
      </div>
      {!expensesReady && (
        <p style={{ fontSize: "0.78rem", color: "var(--warning)", margin: "0 0 8px" }}>
          Expenses aren&apos;t set up yet (run apex-calendar-expenses.sql in Supabase), so profit here is before costs.
        </p>
      )}
      {row("Revenue (invoiced)", s.revenueCents)}
      {row("Collected so far", s.collectedCents, { muted: true })}
      {row("Expenses", s.expensesCents, { minus: true })}
      {row("Profit", s.profitCents, { bold: true })}
      {s.gearCents > 0 && row("Gear bought (capital allowances)", s.gearCents, { minus: true, muted: true })}

      <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "var(--bg-primary)", border: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 700 }}>Set aside</span>
          <span className="money" style={{ fontWeight: 800, fontSize: "1.2rem" }}>{formatSGD(s.setAsideCents)}</span>
        </div>
        {row("MediSave (compulsory, estimate)", s.medisaveCents, { muted: true })}
        {row("Income tax on this business (estimate)", s.taxCents, { muted: true })}
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem", marginTop: 6 }}>
          Your age on 1 Jan {year}
          <select className="input" style={{ width: "auto", padding: "4px 28px 4px 8px", fontSize: "0.8rem" }}
            value={age} onChange={(e) => {
              const v = e.target.value as AgeBand;
              setAge(v);
              try { localStorage.setItem(AGE_KEY, v); } catch { /* fine */ }
            }}>
            {AGE_BANDS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
          </select>
        </label>
        <p style={{ margin: "8px 0 0", fontSize: "0.72rem", color: "var(--text-tertiary)" }}>
          A guide, not advice: MediSave applies once yearly profit passes $6,000; tax ignores other income (like a salary)
          and reliefs besides earned income relief. Exact MediSave:{" "}
          <a href="https://www.cpf.gov.sg/member/tools-and-services/calculators/self-employed-medisave-contribution-calculator"
            target="_blank" rel="noopener noreferrer">CPF calculator</a>.
        </p>
      </div>

      <button className="btn btn-secondary" style={{ width: "100%", marginTop: 12 }} onClick={exportCsv}>
        Export {year} for Form B (CSV)
      </button>
    </div>
  );
}
