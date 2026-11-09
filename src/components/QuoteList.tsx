"use client";
import Link from "next/link";
import { formatSGD } from "@/lib/money";
import { formatJobDate } from "@/lib/printRates";
import { todayLocalIso } from "@/lib/date";
import type { Invoice } from "@/lib/types";

function quoteBadge(q: Invoice, today: string) {
  if (q.status === "draft") return <span className="badge badge-draft">Draft</span>;
  if (q.converted_invoice_id) return <span className="badge badge-paid">Accepted</span>;
  if (q.due_date && q.due_date < today) return <span className="badge badge-overdue">Expired</span>;
  return <span className="badge badge-unpaid">Open</span>;
}

/** Quotes tab: open ones first (the ones that can still turn into work). */
export default function QuoteList({ quotes }: { quotes: Invoice[] }) {
  const today = todayLocalIso();
  if (quotes.length === 0) {
    return (
      <div className="empty-state">
        <p style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>No quotes yet</p>
        <p style={{ marginBottom: 20 }}>Send a price first; turn it into an invoice in one tap when they say yes.</p>
        <Link href="/invoices_login/invoices/new?type=quote" className="btn btn-accent">Create quote</Link>
      </div>
    );
  }
  const rank = (q: Invoice) =>
    q.status === "draft" ? 1 : q.converted_invoice_id ? 3 : q.due_date && q.due_date < today ? 2 : 0;
  const sorted = [...quotes].sort((a, b) => rank(a) - rank(b));
  return (
    <div className="invoice-list-grid">
      {sorted.map((q) => (
        <Link key={q.id} className="card" style={{ textDecoration: "none", color: "inherit", display: "block" }}
          href={q.status === "draft" ? `/invoices_login/invoices/new?draft=${q.id}` : `/invoices_login/invoices/${q.id}`}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>{q.invoice_number ?? "Draft"}</span>
                {quoteBadge(q, today)}
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                {q.customers?.name ?? "—"} · {q.job_event || "No event"}
              </div>
              {q.due_date && q.status !== "draft" && !q.converted_invoice_id && (
                <div style={{ color: "var(--text-tertiary)", fontSize: "0.78rem", marginTop: 2 }}>
                  Valid until {formatJobDate(q.due_date)}
                </div>
              )}
            </div>
            <div className="money" style={{ fontWeight: 800, fontSize: "1.05rem", whiteSpace: "nowrap" }}>
              {formatSGD(q.total_cents)}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
