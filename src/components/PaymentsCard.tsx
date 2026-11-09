"use client";
import { useState } from "react";
import { deletePayment, recordPayment } from "@/lib/db";
import { todayLocalIso } from "@/lib/date";
import { formatSGD } from "@/lib/money";
import { balanceCents, depositOutstanding, dueNowCents, isFullUpfront, paidCents } from "@/lib/payments";
import type { Invoice, Payment } from "@/lib/types";
import NumberInput from "@/components/NumberInput";
import ConfirmSheet from "@/components/ConfirmSheet";
import { IconCheck, IconClose } from "@/components/icons";

/** Money in, on one card. The big button records exactly what's due now
 *  (deposit, then balance), dated today — one tap for the usual case.
 *  "Different amount or date" covers the rest. */
export default function PaymentsCard({ invoice, onChange, onUndoPaid }: {
  invoice: Invoice;
  /** Called with the refreshed invoice; `recorded` is set after a new payment. */
  onChange: (inv: Invoice, recorded?: { amount_cents: number; nowPaid: boolean }) => void;
  /** Invoices marked paid before payments existed have no rows to delete. */
  onUndoPaid: () => void;
}) {
  const payments = invoice.payments ?? [];
  const dueNow = dueNowCents(invoice);
  const paid = paidCents(invoice);
  const balance = balanceCents(invoice);
  const deposit = depositOutstanding(invoice) && !isFullUpfront(invoice);
  const defaultNote = deposit ? "Deposit" : payments.length ? "Balance" : "Payment";

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(dueNow / 100);
  const [date, setDate] = useState(todayLocalIso());
  const [note, setNote] = useState(defaultNote);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Payment | null>(null);

  async function record(p: { amount_cents: number; paid_on: string; note: string }) {
    setBusy(true); setError(null);
    try {
      const fresh = await recordPayment(invoice, p);
      setOpen(false);
      onChange(fresh, { amount_cents: p.amount_cents, nowPaid: fresh.status === "paid" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't record the payment");
    }
    setBusy(false);
  }

  async function remove(p: Payment) {
    setPendingDelete(null); setBusy(true); setError(null);
    try {
      onChange(await deletePayment(invoice, p.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete the payment");
    }
    setBusy(false);
  }

  const quickLabel = deposit ? "Deposit received" : payments.length ? "Balance received" : "Paid in full";
  const legacyPaid = invoice.status === "paid" && payments.length === 0;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <div className="section-label" style={{ marginBottom: 0 }}>Payments</div>
        <span style={{ fontSize: "0.8rem", color: "var(--text-tertiary)" }}>
          {formatSGD(paid)} of {formatSGD(invoice.total_cents)} received
        </span>
      </div>

      {payments.map((p) => (
        <div key={p.id} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
          borderBottom: "1px solid var(--border-subtle)", fontSize: "0.9rem",
        }}>
          <span style={{ color: "var(--text-tertiary)", minWidth: 84 }}>
            {new Date(p.paid_on).toLocaleDateString("en-SG", { day: "numeric", month: "short" })}
          </span>
          <span style={{ flex: 1 }}>{p.note || "Payment"}</span>
          <span className="money" style={{ fontWeight: 700 }}>{formatSGD(p.amount_cents)}</span>
          <button className="btn-danger" aria-label={`Delete payment of ${formatSGD(p.amount_cents)}`}
            disabled={busy} onClick={() => setPendingDelete(p)}>
            <IconClose size={12} />
          </button>
        </div>
      ))}

      {legacyPaid && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
          <span style={{ fontSize: "0.9rem" }}>
            Paid in full{invoice.paid_date ? ` · ${invoice.paid_date}` : ""}
          </span>
          <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: "0.78rem" }} onClick={onUndoPaid}>
            Undo
          </button>
        </div>
      )}

      {dueNow > 0 && !open && (
        <div style={{ marginTop: payments.length ? 12 : 0 }}>
          <button className="btn btn-primary icon-btn" style={{ width: "100%" }} disabled={busy}
            onClick={() => record({ amount_cents: dueNow, paid_on: todayLocalIso(), note: defaultNote })}>
            <IconCheck /> {busy ? "Saving…" : `${quickLabel} · ${formatSGD(dueNow)}`}
          </button>
          <button className="btn btn-ghost" style={{ width: "100%", marginTop: 6, fontSize: "0.8rem" }}
            onClick={() => { setAmount(dueNow / 100); setDate(todayLocalIso()); setNote(defaultNote); setOpen(true); }}>
            Different amount or date
          </button>
          {balance > dueNow && (
            <p style={{ margin: "6px 0 0", fontSize: "0.75rem", color: "var(--text-tertiary)", textAlign: "center" }}>
              {formatSGD(balance - dueNow)} more due on delivery
            </p>
          )}
        </div>
      )}

      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="input-label">Amount ($)</label>
              <NumberInput aria-label="Payment amount" value={amount} onValueChange={setAmount} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="input-label">Received on</label>
              <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="input-label">Note</label>
            <input className="input" value={note} placeholder="Deposit, Balance…" onChange={(e) => setNote(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" style={{ flex: 2 }} disabled={busy || !(amount > 0) || !date}
              onClick={() => record({ amount_cents: Math.round(amount * 100), paid_on: date, note })}>
              {busy ? "Saving…" : "Record payment"}
            </button>
          </div>
        </div>
      )}

      {error && <p style={{ color: "var(--warning)", fontSize: "0.85rem", marginTop: 8 }}>{error}</p>}

      <ConfirmSheet
        open={pendingDelete !== null}
        danger
        title="Delete this payment?"
        message={pendingDelete ? `${formatSGD(pendingDelete.amount_cents)} received ${pendingDelete.paid_on}${pendingDelete.note ? ` (${pendingDelete.note})` : ""}. The invoice will show it as unpaid again.` : ""}
        confirmLabel="Delete"
        onConfirm={() => pendingDelete && remove(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
