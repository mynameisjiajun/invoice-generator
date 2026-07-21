"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { deleteInvoice, listInvoices, setPaid } from "@/lib/db";
import { useBusiness } from "@/lib/businessContext";
import { formatSGD } from "@/lib/money";
import { isOverdue, type Invoice } from "@/lib/types";
import FocusFrame from "@/components/FocusFrame";
import OnboardingBanner from "@/components/OnboardingBanner";
import ConfirmSheet from "@/components/ConfirmSheet";
import { IconCamera, IconCheck, IconCopy, IconEdit, IconSearch, IconTrash, IconUndo } from "@/components/icons";

export default function Dashboard() {
  const { activeBusiness } = useBusiness();
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Invoice | null>(null);

  useEffect(() => {
    if (!activeBusiness) return;
    setInvoices(null);
    listInvoices(activeBusiness.id)
      .then(setInvoices)
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Something went wrong");
      });
  }, [activeBusiness]);

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
      <div className="skeleton" style={{ height: 40, width: "55%", marginBottom: 10 }} />
      <div className="skeleton" style={{ height: 18, width: "75%", marginBottom: 24 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginBottom: 24 }}>
        {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 84 }} />)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 120 }} />)}
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

  async function confirmDelete() {
    const inv = pendingDelete;
    if (!inv) return;
    setPendingDelete(null);
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

      <OnboardingBanner />

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginBottom: 24 }}>
        <div className="stat-card stat-card--money">
          <div className="stat-value money">{formatSGD(outstanding)}</div>
          <div className="stat-label">Outstanding</div>
        </div>
        <div className="stat-card stat-card--warning">
          <div className="stat-value">{unpaidCount}</div>
          <div className="stat-label">Unpaid</div>
        </div>
        <div className="stat-card stat-card--success">
          <div className="stat-value">{paidCount}</div>
          <div className="stat-label">Collected</div>
        </div>
      </div>

      {invoices.length > 3 && (
        <div style={{ position: "relative", marginBottom: 16 }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)", pointerEvents: "none", display: "flex" }}>
            <IconSearch size={16} />
          </span>
          <input
            className="input"
            type="search"
            placeholder="Search by client, event, or invoice no."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ paddingLeft: 38 }}
          />
        </div>
      )}

      {invoices.length === 0 && (
        <div className="empty-state">
          <FocusFrame color="accent">
            <div className="empty-state-icon"><IconCamera size={28} /></div>
          </FocusFrame>
          <p style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>No invoices yet</p>
          <p style={{ marginBottom: 20 }}>Create your first invoice to get started.</p>
          <Link href="/invoices/new" className="btn btn-accent">Create invoice</Link>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {invoices.filter((inv) => {
          const q = query.trim().toLowerCase();
          if (!q) return true;
          return [inv.customers?.name, inv.job_event, inv.invoice_number]
            .some((v) => v?.toLowerCase().includes(q));
        }).map((inv, idx) => (
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
              <div className="money" style={{ fontWeight: 800, fontSize: "1.05rem", whiteSpace: "nowrap" }}>
                {formatSGD(inv.total_cents)}
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
              {inv.status !== "draft" && (
                <button onClick={() => togglePaid(inv)} className="btn-ghost icon-btn">
                  {inv.status === "paid" ? <IconUndo /> : <IconCheck />}
                  {inv.status === "paid" ? "Undo paid" : "Mark paid"}
                </button>
              )}
              {inv.status !== "paid" && (
                <Link href={`/invoices/new?draft=${inv.id}`} className="btn-ghost icon-btn" style={{ textDecoration: "none" }}>
                  <IconEdit /> Edit
                </Link>
              )}
              <Link href={`/invoices/new?duplicate=${inv.id}`} className="btn-ghost icon-btn" style={{ textDecoration: "none" }}>
                <IconCopy /> Duplicate
              </Link>
              <button onClick={() => setPendingDelete(inv)} className="btn-danger icon-btn" style={{ marginLeft: "auto" }}>
                <IconTrash /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmSheet
        open={pendingDelete !== null}
        danger
        title={pendingDelete?.status === "draft" ? "Delete this draft?" : `Delete invoice ${pendingDelete?.invoice_number}?`}
        message={pendingDelete?.status === "draft"
          ? "This draft will be permanently removed."
          : "This can't be undone. If it's your most recent invoice, its number will be reused for the next one."}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </main>
  );
}
