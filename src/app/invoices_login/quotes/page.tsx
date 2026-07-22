"use client";
import { useEffect, useState } from "react";
import { useBusiness } from "@/lib/businessContext";
import { listPrintQuotes, updatePrintQuoteStatus, getPrintQuoteFileUrl } from "@/lib/db";
import { formatSGD } from "@/lib/money";
import type { PrintQuote, PrintQuoteStatus } from "@/lib/types";
import { IconDownload } from "@/components/icons";

const STATUSES: PrintQuoteStatus[] = ["new", "contacted", "archived"];

export default function QuotesPage() {
  const { activeBusiness } = useBusiness();
  const [quotes, setQuotes] = useState<PrintQuote[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeBusiness) return;
    listPrintQuotes(activeBusiness.id)
      .then(setQuotes)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load quotes"));
  }, [activeBusiness]);

  async function onStatusChange(q: PrintQuote, status: PrintQuoteStatus) {
    try {
      await updatePrintQuoteStatus(q.id, status);
      setQuotes(quotes.map((x) => (x.id === q.id ? { ...x, status } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    }
  }

  async function onDownload(q: PrintQuote) {
    try {
      const url = await getPrintQuoteFileUrl(q.file_path);
      window.open(url, "_blank");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get download link");
    }
  }

  if (!activeBusiness) {
    return (
      <div className="page-container">
        <div className="skeleton" style={{ height: 36, width: "45%", marginBottom: 10 }} />
        <div className="skeleton" style={{ height: 18, width: "70%", marginBottom: 24 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 100 }} />)}
        </div>
      </div>
    );
  }

  return (
    <main className="page-container animate-fade-in">
      <h1 className="page-title">3D Print Quotes</h1>
      <p className="page-subtitle">Quote requests submitted for {activeBusiness.name}</p>

      {error && (
        <div style={{
          background: "var(--warning-bg)", color: "var(--warning)", padding: "10px 14px",
          borderRadius: "var(--radius-sm)", fontSize: "0.85rem", fontWeight: 600, marginBottom: 16,
        }}>{error}</div>
      )}

      {quotes.length === 0 && <p style={{ color: "var(--text-tertiary)" }}>No quote requests yet.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {quotes.map((q) => (
          <div key={q.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{q.material}{q.multi_colour ? " (multi-colour)" : ""}</div>
                <div style={{ color: "var(--text-tertiary)", fontSize: "0.8rem" }}>
                  {q.weight_g.toFixed(1)}g · {q.estimated_hours.toFixed(1)}h · {new Date(q.created_at).toLocaleString("en-SG")}
                </div>
                {q.notes && <div style={{ fontSize: "0.82rem", marginTop: 4 }}>{q.notes}</div>}
              </div>
              <div className="money" style={{ fontWeight: 700 }}>{formatSGD(q.price_cents)}</div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => onDownload(q)} className="btn btn-secondary icon-btn">
                <IconDownload size={14} /> Download File
              </button>
              <select className="input" value={q.status}
                onChange={(e) => onStatusChange(q, e.target.value as PrintQuoteStatus)} style={{ width: 140 }}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
