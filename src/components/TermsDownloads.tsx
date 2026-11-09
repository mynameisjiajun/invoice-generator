"use client";
import { useState } from "react";
import { presetContract } from "@/lib/shootTerms";
import { IconDownload } from "@/components/icons";

type Which = "rental" | "standard" | "strict";
const ITEMS: { key: Which; label: string; file: string }[] = [
  { key: "rental", label: "Equipment Rental T&C", file: "Apex Cinematics Equipment Rental T&C.pdf" },
  { key: "standard", label: "Shoot Agreement · Standard", file: "Apex Cinematics Shoot Agreement.pdf" },
  { key: "strict", label: "Shoot Agreement · Strict", file: "Apex Cinematics Shoot Agreement (Strict).pdf" },
];

/** Blank copies of the terms (no invoice number), to send before there's
 *  an invoice. Per-invoice copies are on each invoice. */
export default function TermsDownloads() {
  const [busy, setBusy] = useState<Which | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(item: (typeof ITEMS)[number]) {
    setBusy(item.key); setError(null);
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { TermsOnlyPdf, rentalTermsDoc, shootTermsDoc } = await import("@/components/InvoicePdf");
      const doc = item.key === "rental" ? rentalTermsDoc() : shootTermsDoc(presetContract(item.key), null);
      const blob = await pdf(<TermsOnlyPdf doc={doc} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: item.file });
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't make the PDF");
    }
    setBusy(null);
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="section-label">Terms &amp; conditions</div>
      <p style={{ margin: "0 0 12px", fontSize: "0.8rem", color: "var(--text-tertiary)" }}>
        Blank copies to send before there&apos;s an invoice. Copies with the invoice number are on each invoice.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ITEMS.map((it) => (
          <button key={it.key} className="btn btn-secondary icon-btn" style={{ justifyContent: "space-between" }}
            disabled={busy !== null} onClick={() => download(it)}>
            <span>{it.label}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <IconDownload size={14} /> {busy === it.key ? "Making…" : "PDF"}
            </span>
          </button>
        ))}
      </div>
      {error && <p style={{ color: "var(--warning)", fontSize: "0.85rem", marginTop: 8 }}>{error}</p>}
    </div>
  );
}
