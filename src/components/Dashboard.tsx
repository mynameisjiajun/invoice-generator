"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { deleteInvoice, listInvoices, setPaid } from "@/lib/db";
import { formatSGD } from "@/lib/money";
import { isOverdue, type Invoice } from "@/lib/types";

export default function Dashboard() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listInvoices()
      .then(setInvoices)
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Something went wrong");
      });
  }, []);

  if (error) {
    return (
      <div className="page-container">
        <div className="card" style={{ borderColor: "var(--warning)", background: "var(--warning-bg)" }}>
          <p style={{ color: "var(--warning)", fontWeight: 600 }}>Error: {error}</p>
        </div>
      </div>
    );
  }

  if (!invoices) return (
    <div className="page-container">
      <div className="card animate-pulse-soft" style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--text-tertiary)" }}>Loading invoices…</p>
      </div>
    </div>
  );

  const outstanding = invoices
    .filter((i) => i.status === "unpaid")
    .reduce((s, i) => s + i.total_cents, 0);

  const unpaidCount = invoices.filter((i) => i.status === "unpaid").length;
  const paidCount = invoices.filter((i) => i.status === "paid").length;

  async function togglePaid(inv: Invoice) {
    try {
      const paid = inv.status !== "paid";
      await setPaid(inv.id, paid);
      setInvoices(invoices!.map((i) => i.id === inv.id
        ? { ...i, status: paid ? "paid" : "unpaid", paid_date: paid ? new Date().toISOString().slice(0, 10) : null }
        : i));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  async function removeInvoice(inv: Invoice) {
    const msg = inv.status === "draft"
      ? "Delete this draft?"
      : `Delete invoice ${inv.invoice_number}?\n\nThis can't be undone, and the number ${inv.invoice_number} won't be reused.`;
    if (!confirm(msg)) return;
    try {
      await deleteInvoice(inv.id);
      setInvoices(invoices!.filter((i) => i.id !== inv.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  function badge(inv: Invoice) {
    if (inv.status === "draft") return <span className="badge badge-draft">Draft</span>;
    if (inv.status === "paid") return <span className="badge badge-paid">Paid</span>;
    if (isOverdue(inv)) return <span className="badge badge-overdue">Overdue</span>;
    return <span className="badge badge-unpaid">Unpaid</span>;
  }

  return (
    <main className="page-container">
      <h1 className="page-title">Invoices</h1>
      <p className="page-subtitle">Manage your invoices and track payments</p>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-value">{formatSGD(outstanding)}</div>
          <div className="stat-label">Outstanding</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{unpaidCount}</div>
          <div className="stat-label">Unpaid</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{paidCount}</div>
          <div className="stat-label">Collected</div>
        </div>
      </div>

      {invoices.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📄</div>
          <p style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>No invoices yet</p>
          <p style={{ marginBottom: 20 }}>Create your first invoice to get started.</p>
          <Link href="/invoices/new" className="btn btn-accent">Create invoice</Link>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {invoices.map((inv, idx) => (
          <div key={inv.id} className="card animate-fade-in" style={{ animationDelay: `${idx * 0.03}s` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Link href={inv.status === "draft" ? `/invoices/new?draft=${inv.id}` : `/invoices/${inv.id}`}
                style={{ flex: 1, minWidth: 0, textDecoration: "none", color: "inherit" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                    {inv.invoice_number ?? "Draft"}
                  </span>
                  {badge(inv)}
                </div>
                <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                  {inv.customers?.name ?? "—"} · {inv.job_event || "No event"}
                </div>
                <div style={{ color: "var(--text-tertiary)", fontSize: "0.78rem", marginTop: 2 }}>
                  {inv.issue_date}
                </div>
              </Link>
              <div style={{ fontWeight: 800, fontSize: "1.05rem", whiteSpace: "nowrap" }}>
                {formatSGD(inv.total_cents)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
              {inv.status !== "draft" && (
                <button onClick={() => togglePaid(inv)} className="btn-ghost">
                  {inv.status === "paid" ? "Undo paid" : "✓ Mark paid"}
                </button>
              )}
              {inv.status !== "paid" && (
                <Link href={`/invoices/new?draft=${inv.id}`} className="btn-ghost" style={{ textDecoration: "none" }}>
                  Edit
                </Link>
              )}
              <Link href={`/invoices/new?duplicate=${inv.id}`} className="btn-ghost" style={{ textDecoration: "none" }}>
                Duplicate
              </Link>
              <button onClick={() => removeInvoice(inv)} className="btn-danger" style={{ marginLeft: "auto" }}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
