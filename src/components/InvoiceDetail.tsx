"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteInvoice, getBusiness, getInvoice, setPaid } from "@/lib/db";
import { formatSGD } from "@/lib/money";
import { paynowPayload } from "@/lib/paynow";
import { normalizeSgMobile } from "@/lib/phone";
import { qrDataUrl } from "@/lib/qr";
import type { Business, Invoice } from "@/lib/types";
import FocusFrame from "@/components/FocusFrame";
import {
  IconCheck, IconCopy, IconDownload, IconEdit, IconReceipt, IconShare,
  IconTrash, IconUndo, IconWarning, IconWhatsApp,
} from "@/components/icons";

export default function InvoiceDetail({ id }: { id: string }) {
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getInvoice(id)
      .then((inv) => {
        setInvoice(inv);
        return getBusiness(inv.business_id);
      })
      .then(setBusiness)
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return (
    <div className="page-container">
      <div className="card" style={{ borderColor: "var(--warning)", background: "var(--warning-bg)" }}>
        <p style={{ color: "var(--warning)", fontWeight: 600 }}>{error}</p>
      </div>
    </div>
  );

  if (!invoice || !business) return (
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

  async function generatePdfBlob(variant: "invoice" | "receipt" = "invoice"): Promise<{ blob: Blob; filename: string }> {
    const inv = invoice!; const st = business!;
    const payload = paynowPayload({
      mobile: st.paynow_number,
      amountCents: inv.total_cents,
      reference: inv.invoice_number ?? "",
      merchantName: st.payee_name.toUpperCase(),
    });
    const [qr, logo] = await Promise.all([qrDataUrl(payload), fetchLogo()]);
    const { pdf } = await import("@react-pdf/renderer");
    const { default: InvoicePdf } = await import("@/components/InvoicePdf");
    const blob = await pdf(
      <InvoicePdf invoice={inv} business={st} qr={qr} logo={logo} variant={variant} />
    ).toBlob();
    const word = variant === "receipt" ? "Receipt" : "Invoice";
    const filename = `${word} ${inv.invoice_number ?? "DRAFT"}.pdf`;
    return { blob, filename };
  }

  async function downloadPdf(variant: "invoice" | "receipt" = "invoice") {
    setBusy(true);
    try {
      const { blob, filename } = await generatePdfBlob(variant);
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: filename });
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  async function sharePdf(variant: "invoice" | "receipt" = "invoice") {
    setBusy(true);
    try {
      const { blob, filename } = await generatePdfBlob(variant);
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

  const whatsapp = normalizeSgMobile(invoice.customers?.phone);

  function openWhatsApp() {
    const inv = invoice!;
    const firstName = (inv.customers?.name ?? "").trim().split(/\s+/)[0] || "there";
    const msg =
      `Hi ${firstName}! Here's your invoice ${inv.invoice_number ?? ""} for ` +
      `${inv.job_event || "the shoot"} — total ${formatSGD(inv.total_cents)}. ` +
      `You can PayNow via the QR in the PDF (sending it right after this) or to ${business!.paynow_number}. Thank you!`;
    const base = whatsapp.e164 ? `https://wa.me/${whatsapp.e164}` : "https://wa.me/";
    if (whatsapp.e164 && !whatsapp.isMobile) {
      if (!confirm(`${inv.customers?.phone} looks like a landline, not a mobile — WhatsApp may not open a chat for it. Try anyway?`)) return;
    }
    window.open(`${base}?text=${encodeURIComponent(msg)}`, "_blank");
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
          <FocusFrame>
            <span className="money" style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
              {formatSGD(invoice.total_cents)}
            </span>
          </FocusFrame>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <button onClick={() => downloadPdf()} disabled={busy} className="btn btn-primary icon-btn" style={{ flex: 1 }}>
          <IconDownload /> {busy ? "Generating…" : "Download PDF"}
        </button>
        <button onClick={() => sharePdf()} disabled={busy} className="btn btn-secondary icon-btn" style={{ flex: 1 }}>
          <IconShare /> Share PDF
        </button>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        {invoice.customers?.phone && (
          <button onClick={openWhatsApp} className="btn btn-secondary icon-btn btn-whatsapp" style={{ flex: 1 }}>
            <IconWhatsApp /> WhatsApp {invoice.customers.name?.split(/\s+/)[0]}
            {!whatsapp.isMobile && <IconWarning size={13} />}
          </button>
        )}
        {invoice.status === "paid" && (
          <button onClick={() => sharePdf("receipt")} disabled={busy}
            className="btn btn-secondary icon-btn" style={{ flex: 1 }}>
            <IconReceipt /> Receipt PDF
          </button>
        )}
      </div>

      {/* Manage row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {invoice.status !== "draft" && (
          <button onClick={onTogglePaid} className="btn btn-ghost icon-btn" style={{ flex: 1 }}>
            {invoice.status === "paid" ? <IconUndo /> : <IconCheck />}
            {invoice.status === "paid" ? "Undo paid" : "Mark paid"}
          </button>
        )}
        {invoice.status !== "paid" && (
          <Link href={`/invoices/new?draft=${invoice.id}`} className="btn btn-ghost icon-btn"
            style={{ flex: 1, textAlign: "center", textDecoration: "none" }}>
            <IconEdit /> Edit
          </Link>
        )}
        <Link href={`/invoices/new?duplicate=${invoice.id}`} className="btn btn-ghost icon-btn"
          style={{ flex: 1, textAlign: "center", textDecoration: "none" }}>
          <IconCopy /> Duplicate
        </Link>
      </div>

      <button onClick={onDelete} className="btn-danger icon-btn"
        style={{ display: "flex", width: "100%", padding: "10px", borderRadius: "var(--radius-sm)" }}>
        <IconTrash /> Delete invoice
      </button>
    </main>
  );
}
