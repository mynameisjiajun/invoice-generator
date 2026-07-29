"use client";
import { useEffect, useState } from "react";
import { listInvoices } from "@/lib/db";
import { todayLocalIso } from "@/lib/date";
import { formatSGD } from "@/lib/money";
import { clientStats, monthlyStats, yearlyStats } from "@/lib/stats";
import type { Invoice } from "@/lib/types";
import { IconFileExport } from "@/components/icons";
import { useBusiness } from "@/lib/businessContext";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function StatsPage() {
  const { businesses, activeBusiness } = useBusiness();
  const [scope, setScope] = useState<"active" | "all">("active");
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // null until the first load resolves, at which point it's set to the
  // most recent year with data (falling back to this year if there's none)
  // — otherwise this defaults to today's year and can show an empty chart
  // with no explanation when all your invoices are from an earlier year.
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    if (scope === "active" && !activeBusiness) return;
    setInvoices(null);
    setError(null);
    listInvoices(scope === "active" ? activeBusiness!.id : undefined)
      .then((list) => {
        setInvoices(list);
        setYear((current) => {
          if (current !== null) return current;
          const years = yearlyStats(list);
          return years[0]?.year ?? Number(todayLocalIso().slice(0, 4));
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load stats"));
  }, [scope, activeBusiness]);

  if (error) return (
    <div className="page-container">
      <div className="card" style={{ borderColor: "var(--warning)", background: "var(--warning-bg)" }}>
        <p style={{ color: "var(--warning)", fontWeight: 600 }}>Error: {error}</p>
      </div>
    </div>
  );

  if (!invoices || year === null) return (
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

  function exportCsv() {
    const esc = (v: string | number | null | undefined) => {
      const str = String(v ?? "");
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const businessName = new Map(businesses.map((b) => [b.id, b.name]));
    const header = ["Invoice No", "Status", "Issue Date", "Paid Date", "Customer", "Event", "Location",
      "Subtotal (SGD)", "Discount Type", "Discount Value", "Total (SGD)"];
    if (scope === "all") header.unshift("Business");
    const rows = [
      header,
      ...invoices!.map((i) => {
        const row = [
          i.invoice_number ?? "DRAFT", i.status, i.issue_date, i.paid_date ?? "",
          i.customers?.name ?? "", i.job_event, i.job_location,
          (i.subtotal_cents / 100).toFixed(2), i.discount_type, i.discount_value,
          (i.total_cents / 100).toFixed(2),
        ];
        if (scope === "all") row.unshift(businessName.get(i.business_id) ?? "");
        return row;
      }),
    ];
    const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const name = scope === "active" ? (activeBusiness?.slug ?? "invoices") : "all-businesses";
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `${name}-invoices-${todayLocalIso()}.csv`,
    });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="page-container animate-fade-in">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 className="page-title">Stats</h1>
          <p className="page-subtitle">Revenue overview and analytics</p>
        </div>
        <button onClick={exportCsv} className="btn btn-secondary icon-btn" style={{ padding: "8px 14px", fontSize: "0.8rem" }}>
          <IconFileExport size={15} /> Export CSV
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setScope("active")}
          className={`btn ${scope === "active" ? "btn-primary" : "btn-secondary"}`}
          style={{ padding: "6px 14px", fontSize: "0.8rem" }}>
          {activeBusiness?.name ?? "Active business"}
        </button>
        <button onClick={() => setScope("all")}
          className={`btn ${scope === "all" ? "btn-primary" : "btn-secondary"}`}
          style={{ padding: "6px 14px", fontSize: "0.8rem" }}>
          All businesses
        </button>
      </div>

      {/* Summary stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div className="stat-card stat-card--warning">
          <div className="stat-value" style={{ color: "var(--warning)" }}>{formatSGD(outstanding)}</div>
          <div className="stat-label">Outstanding</div>
        </div>
        <div className="stat-card stat-card--money">
          <div className="stat-value money">{formatSGD(totalInvoiced)}</div>
          <div className="stat-label">Invoiced</div>
        </div>
        <div className="stat-card stat-card--success">
          <div className="stat-value" style={{ color: "var(--success)" }}>{formatSGD(totalCollected)}</div>
          <div className="stat-label">Collected</div>
        </div>
      </div>

      <div className="stats-grid">
      {/* By year */}
      <div className="card stats-year-card" style={{ marginBottom: 16 }}>
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
      <div className="card stats-chart-card" style={{ marginBottom: 16 }}>
        <div className="section-label">{year} Monthly Breakdown</div>
        {months.every((m) => m.invoicedCents === 0) ? (
          <div className="empty-state" style={{ padding: "24px 0" }}>
            <p>No invoices in {year}. Pick a different year above.</p>
          </div>
        ) : (
          <>
            <div className="bar-chart-container">
              {months.map((m) => (
                <div key={m.month} className="bar-column"
                  title={`${MONTHS[m.month - 1]} ${year} — ${formatSGD(m.invoicedCents)} invoiced · ${formatSGD(m.collectedCents)} collected`}>
                  {m.invoicedCents > 0 && (
                    <span className="bar-value">{formatSGD(m.invoicedCents)}</span>
                  )}
                  <div className="bar-outer" style={{ height: m.invoicedCents ? `${Math.max(4, (m.invoicedCents / max) * 100)}%` : 0 }}>
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
          </>
        )}
      </div>

      {/* By client */}
      <div className="card stats-client-card">
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
                <span className="money" style={{ fontWeight: 700, fontSize: "0.9rem" }}>{formatSGD(c.invoicedCents)}</span>
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
      </div>
    </main>
  );
}
