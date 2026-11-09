"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listInvoices, listQuotes } from "@/lib/db";
import { useBusiness } from "@/lib/businessContext";
import { todayLocalIso } from "@/lib/date";
import { formatJobDate } from "@/lib/printRates";
import { calendarEvents, clashes, type CalEvent } from "@/lib/calendar";
import type { Invoice } from "@/lib/types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const pad = (n: number) => String(n).padStart(2, "0");

/** Month view of shoots (dark dot) and rentals (orange bar), the month's
 *  agenda, and double-booking warnings. Open quotes appear as tentative. */
export default function CalendarView() {
  const { activeBusiness } = useBusiness();
  const [data, setData] = useState<{ invoices: Invoice[]; quotes: Invoice[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = todayLocalIso();
  const [month, setMonth] = useState(today.slice(0, 7)); // "YYYY-MM"

  useEffect(() => {
    if (!activeBusiness) return;
    Promise.all([listInvoices(activeBusiness.id), listQuotes(activeBusiness.id).catch(() => [])])
      .then(([invoices, quotes]) => setData({ invoices, quotes }))
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the calendar"));
  }, [activeBusiness]);

  const events = useMemo(() => (data ? calendarEvents(data.invoices, data.quotes) : []), [data]);
  const warnings = useMemo(() => clashes(events).filter((c) => c.date >= today), [events, today]);

  const [y, m] = month.split("-").map(Number);
  const first = `${month}-01`;
  const daysInMonth = new Date(y, m, 0).getDate();
  const last = `${month}-${pad(daysInMonth)}`;
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Monday-first
  const inMonth = events.filter((e) => e.start <= last && e.end >= first);
  const on = (day: string) => inMonth.filter((e) => e.start <= day && e.end >= day);
  const shift = (d: number) => {
    const dt = new Date(y, m - 1 + d, 1);
    setMonth(`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`);
  };
  const monthName = new Date(y, m - 1, 1).toLocaleDateString("en-SG", { month: "long", year: "numeric" });

  if (error) return <main className="page-container"><p style={{ color: "var(--warning)" }}>{error}</p></main>;

  return (
    <main className="page-container animate-fade-in">
      <h1 className="page-title">Calendar</h1>
      <p className="page-subtitle">Shoots and rentals, with double bookings flagged</p>

      {warnings.length > 0 && (
        <div className="card" style={{ marginBottom: 16, borderColor: "var(--warning)", background: "var(--warning-bg)" }}>
          <div className="section-label" style={{ color: "var(--warning)" }}>Check these dates</div>
          {warnings.map((w) => (
            <p key={w.key} style={{ fontSize: "0.85rem", margin: "6px 0 0" }}>{w.text}</p>
          ))}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button className="btn btn-ghost" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
          <button className="btn btn-ghost" style={{ fontWeight: 700 }} onClick={() => setMonth(today.slice(0, 7))}
            title="Back to this month">{monthName}</button>
          <button className="btn btn-ghost" onClick={() => shift(1)} aria-label="Next month">›</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4, textAlign: "center" }}>
          {WEEKDAYS.map((d) => (
            <div key={d} style={{ fontSize: "0.68rem", color: "var(--text-tertiary)", paddingBottom: 4 }}>{d}</div>
          ))}
          {Array.from({ length: lead }, (_, i) => <div key={`b${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = `${month}-${pad(i + 1)}`;
            const evs = on(day);
            return (
              <div key={day} style={{
                minHeight: 44, borderRadius: 8, padding: "4px 2px",
                border: day === today ? "1.5px solid var(--text-primary)" : "1px solid var(--border-subtle)",
              }}>
                <div style={{ fontSize: "0.78rem", fontWeight: day === today ? 700 : 400 }}>{i + 1}</div>
                <div style={{ display: "flex", justifyContent: "center", gap: 3, flexWrap: "wrap", marginTop: 3 }}>
                  {evs.slice(0, 3).map((e) => (
                    <span key={e.id} title={e.title} style={{
                      width: e.kind === "rental" ? 12 : 7, height: 7, borderRadius: 4,
                      background: e.kind === "rental" ? "#F65F0D" : "var(--text-primary)",
                      opacity: e.tentative ? 0.4 : 1,
                    }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: "0.72rem", color: "var(--text-tertiary)", margin: "10px 0 0" }}>
          ● shoot · <span style={{ color: "#F65F0D" }}>▬</span> rental · faded = quote not yet accepted
        </p>
      </div>

      {!data ? (
        <div className="skeleton" style={{ height: 120 }} />
      ) : inMonth.length === 0 ? (
        <p style={{ color: "var(--text-tertiary)", textAlign: "center" }}>
          Nothing booked in {monthName}. Add a shoot date to an invoice or quote to see it here.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {inMonth.map((e: CalEvent) => (
            <Link key={e.id} href={e.href} className="card" style={{ textDecoration: "none", color: "inherit", opacity: e.tentative ? 0.75 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                  {formatJobDate(e.start)}{e.end !== e.start ? ` → ${formatJobDate(e.end)}` : ""}
                </span>
                <span className={`badge ${e.kind === "rental" ? "badge-unpaid" : "badge-draft"}`}>
                  {e.tentative ? "Quote" : e.kind === "rental" ? "Rental" : "Shoot"}
                </span>
              </div>
              <div style={{ fontSize: "0.88rem", marginTop: 4 }}>{e.title}</div>
              {e.sub && <div style={{ fontSize: "0.78rem", color: "var(--text-tertiary)" }}>{e.sub}</div>}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
