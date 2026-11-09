"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createExpense, deleteExpense, listExpenses } from "@/lib/db";
import { useBusiness } from "@/lib/businessContext";
import { todayLocalIso } from "@/lib/date";
import { formatSGD } from "@/lib/money";
import type { Expense, ExpenseCategory } from "@/lib/types";
import NumberInput from "@/components/NumberInput";
import ConfirmSheet from "@/components/ConfirmSheet";
import { IconClose } from "@/components/icons";

export const CATEGORIES: { key: ExpenseCategory; label: string }[] = [
  { key: "gear", label: "Gear" },
  { key: "software", label: "Software & subscriptions" },
  { key: "transport", label: "Transport" },
  { key: "marketing", label: "Marketing" },
  { key: "crew", label: "Freelancers" },
  { key: "other", label: "Other" },
];
const labelOf = (c: ExpenseCategory) => CATEGORIES.find((x) => x.key === c)?.label ?? c;

/** Money out: quick add at the top (amount, category, date, note), then
 *  everything by month. Feeds profit and the set-aside on Stats. */
export default function ExpensesView() {
  const { activeBusiness } = useBusiness();
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState<ExpenseCategory>("gear");
  const [date, setDate] = useState(todayLocalIso());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null);

  useEffect(() => {
    if (!activeBusiness) return;
    listExpenses(activeBusiness.id).then(setExpenses).catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      setError(/expenses/.test(msg)
        ? "Expenses need a one-time database update: run apex-calendar-expenses.sql (on your Desktop) in Supabase."
        : msg);
    });
  }, [activeBusiness]);

  async function add() {
    if (!activeBusiness || !(amount > 0)) return;
    setBusy(true); setError(null);
    try {
      const e = await createExpense({ spent_on: date, amount_cents: Math.round(amount * 100), category, note: note.trim() }, activeBusiness.id);
      setExpenses([e, ...(expenses ?? [])].sort((a, b) => b.spent_on.localeCompare(a.spent_on)));
      setAmount(0); setNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the expense");
    }
    setBusy(false);
  }

  async function remove(e: Expense) {
    setPendingDelete(null);
    try {
      await deleteExpense(e.id);
      setExpenses((expenses ?? []).filter((x) => x.id !== e.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete the expense");
    }
  }

  const byMonth = new Map<string, Expense[]>();
  for (const e of expenses ?? []) {
    const k = e.spent_on.slice(0, 7);
    byMonth.set(k, [...(byMonth.get(k) ?? []), e]);
  }

  return (
    <main className="page-container animate-fade-in">
      <h1 className="page-title">Expenses</h1>
      <p className="page-subtitle">
        Money out, for your profit and tax set-aside on <Link href="/invoices_login/stats">Stats</Link>
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-label">Add expense</div>
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label className="input-label">Amount ($)</label>
            <NumberInput aria-label="Expense amount" placeholder="0.00" value={amount} onValueChange={setAmount} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="input-label">Date</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="chip-row" style={{ paddingBottom: 0, marginBottom: 10 }} role="group" aria-label="Category">
          {CATEGORIES.map((c) => (
            <button key={c.key} type="button" className={`chip ${category === c.key ? "chip-active" : ""}`}
              aria-pressed={category === c.key} onClick={() => setCategory(c.key)}>{c.label}</button>
          ))}
        </div>
        <input className="input" placeholder="What was it? e.g. Sony FX3, Adobe CC, Grab to shoot"
          value={note} onChange={(e) => setNote(e.target.value)} style={{ marginBottom: 10 }} />
        <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy || !(amount > 0)} onClick={add}>
          {busy ? "Saving…" : amount > 0 ? `Add ${formatSGD(Math.round(amount * 100))}` : "Add expense"}
        </button>
        {category === "gear" && (
          <p style={{ margin: "8px 0 0", fontSize: "0.72rem", color: "var(--text-tertiary)" }}>
            Gear is claimed as capital allowances, shown separately from other expenses on Stats.
          </p>
        )}
      </div>

      {error && <div className="card" style={{ marginBottom: 16, borderColor: "var(--warning)", background: "var(--warning-bg)", color: "var(--warning)" }}>{error}</div>}

      {expenses && expenses.length === 0 && !error && (
        <p style={{ color: "var(--text-tertiary)", textAlign: "center" }}>No expenses yet.</p>
      )}

      {[...byMonth.entries()].map(([month, list]) => (
        <div key={month} className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>
              {new Date(`${month}-01T00:00`).toLocaleDateString("en-SG", { month: "long", year: "numeric" })}
            </div>
            <span className="money" style={{ fontWeight: 700 }}>{formatSGD(list.reduce((s, e) => s + e.amount_cents, 0))}</span>
          </div>
          {list.map((e) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid var(--border-subtle)" }}>
              <span style={{ color: "var(--text-tertiary)", fontSize: "0.8rem", minWidth: 50 }}>
                {new Date(`${e.spent_on}T00:00`).toLocaleDateString("en-SG", { day: "numeric", month: "short" })}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: "0.88rem" }}>{e.note || labelOf(e.category)}</span>
                {e.note && <span style={{ display: "block", fontSize: "0.72rem", color: "var(--text-tertiary)" }}>{labelOf(e.category)}</span>}
              </span>
              <span className="money" style={{ fontWeight: 700 }}>{formatSGD(e.amount_cents)}</span>
              <button className="btn-danger" aria-label="Delete expense" onClick={() => setPendingDelete(e)}>
                <IconClose size={12} />
              </button>
            </div>
          ))}
        </div>
      ))}

      <ConfirmSheet
        open={pendingDelete !== null}
        danger
        title="Delete this expense?"
        message={pendingDelete ? `${formatSGD(pendingDelete.amount_cents)} · ${pendingDelete.note || labelOf(pendingDelete.category)} · ${pendingDelete.spent_on}` : ""}
        confirmLabel="Delete"
        onConfirm={() => pendingDelete && remove(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </main>
  );
}
