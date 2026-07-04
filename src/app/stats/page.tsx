"use client";
import { useEffect, useState } from "react";
import { listInvoices } from "@/lib/db";
import { formatSGD } from "@/lib/money";
import { clientStats, monthlyStats, yearlyStats } from "@/lib/stats";
import type { Invoice } from "@/lib/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function StatsPage() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => { listInvoices().then(setInvoices); }, []);

  if (!invoices) return (
    <div className="page-container">
      <div className="card animate-pulse-soft" style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--text-tertiary)" }}>Loading stats…</p>
      </div>
    </div>
  );

  const years = yearlyStats(invoices);
  const months = monthlyStats(invoices, year);
  const clients = clientStats(invoices);
  const max = Math.max(...months.map((m) => m.invoicedCents), 1);
  const outstanding = invoices.filter((i) => i.status === "unpaid").reduce((s, i) => s + i.total_cents, 0);
  const totalInvoiced = years.reduce((s, y) => s + y.invoicedCents, 0);
  const totalCollected = years.reduce((s, y) => s + y.collectedCents, 0);

  return (
    <main className="page-container animate-fade-in">
      <h1 className="page-title">Stats</h1>
      <p className="page-subtitle">Revenue overview and analytics</p>

      {/* Summary stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--warning)" }}>{formatSGD(outstanding)}</div>
          <div className="stat-label">Outstanding</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatSGD(totalInvoiced)}</div>
          <div className="stat-label">Invoiced</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--success)" }}>{formatSGD(totalCollected)}</div>
          <div className="stat-label">Collected</div>
        </div>
      </div>

      {/* By year */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-label">By Year</div>
        {years.map((y) => (
          <button key={y.year} onClick={() => setYear(y.year)}
            className={`year-btn ${y.year === year ? "year-btn-active" : ""}`}>
            <span style={{ fontWeight: 700 }}>{y.year}</span>
            <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
              {formatSGD(y.invoicedCents)} invoiced · {formatSGD(y.collectedCents)} collected
            </span>
          </button>
        ))}
        {years.length === 0 && (
          <div className="empty-state" style={{ padding: "24px 0" }}>
            <p>No finalized invoices yet.</p>
          </div>
        )}
      </div>

      {/* Monthly chart */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-label">{year} Monthly Breakdown</div>
        <div className="bar-chart-container">
          {months.map((m) => (
            <div key={m.month} className="bar-column">
              <div className="bar-outer" style={{ height: `${(m.invoicedCents / max) * 100}%` }}>
                <div className="bar-inner"
                  style={{ height: m.invoicedCents ? `${(m.collectedCents / m.invoicedCents) * 100}%` : 0 }} />
              </div>
              <span className="bar-label">{MONTHS[m.month - 1]}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: "var(--border-subtle)" }} />
            Invoiced
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: "var(--accent)" }} />
            Collected
          </div>
        </div>
      </div>

      {/* By client */}
      <div className="card">
        <div className="section-label">By Client</div>
        {clients.length === 0 && (
          <p style={{ color: "var(--text-tertiary)", fontSize: "0.85rem" }}>No data yet.</p>
        )}
        {clients.map((c, i) => {
          const pct = clients[0]?.invoicedCents ? (c.invoicedCents / clients[0].invoicedCents) * 100 : 0;
          return (
            <div key={c.name} className="animate-fade-in" style={{
              animationDelay: `${i * 0.05}s`,
              padding: "12px 0",
              borderBottom: i < clients.length - 1 ? "1px solid var(--border-subtle)" : "none",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{c.name}</span>
                <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{formatSGD(c.invoicedCents)}</span>
              </div>
              <div style={{
                height: 4,
                borderRadius: 2,
                background: "var(--border-subtle)",
                overflow: "hidden",
              }}>
                <div style={{
                  height: "100%",
                  width: `${pct}%`,
                  borderRadius: 2,
                  background: "var(--accent)",
                  transition: "width 0.5s ease",
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
