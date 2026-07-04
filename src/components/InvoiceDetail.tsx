"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteInvoice, getInvoice, getSettings, setPaid } from "@/lib/db";
import { formatSGD } from "@/lib/money";
import { paynowPayload } from "@/lib/paynow";
import { qrDataUrl } from "@/lib/qr";
import type { Invoice, Settings } from "@/lib/types";

export default function InvoiceDetail({ id }: { id: string }) {
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getInvoice(id).then(setInvoice).catch((e) => setError(e.message));
    getSettings().then(setSettings).catch((e) => setError(e.message));
  }, [id]);

  if (error) return (
    <div className="page-container">
      <div className="card" style={{ borderColor: "var(--warning)", background: "var(--warning-bg)" }}>
        <p style={{ color: "var(--warning)", fontWeight: 600 }}>{error}</p>
      </div>
    </div>
  );

  if (!invoice || !settings) return (
    <div className="page-container">
      <div className="card animate-pulse-soft" style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--text-tertiary)" }}>Loading invoice…</p>
      </div>
    </div>
  );

  async function fetchLogo(): Promise<string | null> {
    try {
      const res = await fetch("/logo.png");
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!blob.type.startsWith("image/")) return null;
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  async function generatePdfBlob(): Promise<{ blob: Blob; filename: string }> {
    const inv = invoice!; const st = settings!;
    const payload = paynowPayload({
      mobile: st.paynow_number,
      amountCents: inv.total_cents,
      reference: inv.invoice_number ?? "",
      merchantName: st.payee_name.toUpperCase(),
    });
    const [qr, logo] = await Promise.all([qrDataUrl(payload), fetchLogo()]);
    const { pdf } = await import("@react-pdf/renderer");
    const { default: InvoicePdf } = await import("@/components/InvoicePdf");
    const blob = await pdf(<InvoicePdf invoice={inv} settings={st} qr={qr} logo={logo} />).toBlob();
    const filename = `Invoice ${inv.invoice_number ?? "DRAFT"}.pdf`;
    return { blob, filename };
  }

  async function downloadPdf() {
    setBusy(true);
    try {
      const { blob, filename } = await generatePdfBlob();
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: filename });
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  async function sharePdf() {
    setBusy(true);
    try {
      const { blob, filename } = await generatePdfBlob();
      const file = new File([blob], filename, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: filename.replace(".pdf", "") });
      } else {
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement("a"), { href: url, download: filename });
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    }
    setBusy(false);
  }

  async function onTogglePaid() {
    const inv = invoice!;
    try {
      const paid = inv.status !== "paid";
      await setPaid(inv.id, paid);
      setInvoice({ ...inv, status: paid ? "paid" : "unpaid", paid_date: paid ? new Date().toISOString().slice(0, 10) : null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  async function onDelete() {
    const inv = invoice!;
    const msg = inv.status === "draft"
      ? "Delete this draft?"
      : `Delete invoice ${inv.invoice_number}?\n\nThis can't be undone. If it's your most recent invoice, its number will be reused for the next one.`;
    if (!confirm(msg)) return;
    try {
      await deleteInvoice(inv.id);
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  const statusBadge = invoice.status === "paid"
    ? <span className="badge badge-paid">Paid</span>
    : invoice.status === "draft"
      ? <span className="badge badge-draft">Draft</span>
      : <span className="badge badge-unpaid">Unpaid</span>;

  return (
    <main className="page-container animate-slide-up">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 className="page-title">{invoice.invoice_number ?? "Draft"}</h1>
          <p style={{ color: "var(--text-tertiary)", fontSize: "0.85rem" }}>
            Issued {invoice.issue_date}
          </p>
        </div>
        {statusBadge}
      </div>

      {/* Invoice summary card */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-label">Customer</div>
        <p style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 2 }}>{invoice.customers?.name}</p>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>{invoice.job_event}</p>
        <p style={{ color: "var(--text-tertiary)", fontSize: "0.8rem" }}>
          {invoice.job_date} · {invoice.job_location}
        </p>
        <div style={{
          marginTop: 16,
          paddingTop: 16,
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}>
          <span className="section-label" style={{ marginBottom: 0 }}>Total Due</span>
          <span style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
            {formatSGD(invoice.total_cents)}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <button onClick={downloadPdf} disabled={busy} className="btn btn-primary" style={{ flex: 1 }}>
          {busy ? "Generating…" : "⬇ Download PDF"}
        </button>
        <button onClick={sharePdf} disabled={busy} className="btn btn-secondary" style={{ flex: 1 }}>
          ↗ Share PDF
        </button>
      </div>

      {/* Manage row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {invoice.status !== "draft" && (
          <button onClick={onTogglePaid} className="btn btn-ghost" style={{ flex: 1 }}>
            {invoice.status === "paid" ? "Undo paid" : "✓ Mark paid"}
          </button>
        )}
        {invoice.status !== "paid" && (
          <Link href={`/invoices/new?draft=${invoice.id}`} className="btn btn-ghost"
            style={{ flex: 1, textAlign: "center", textDecoration: "none" }}>
            Edit
          </Link>
        )}
        <Link href={`/invoices/new?duplicate=${invoice.id}`} className="btn btn-ghost"
          style={{ flex: 1, textAlign: "center", textDecoration: "none" }}>
          Duplicate
        </Link>
      </div>

      <button onClick={onDelete} className="btn-danger"
        style={{ display: "block", width: "100%", padding: "10px", borderRadius: "var(--radius-sm)" }}>
        Delete invoice
      </button>
    </main>
  );
}
