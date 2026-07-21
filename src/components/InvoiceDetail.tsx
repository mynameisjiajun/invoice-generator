"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteInvoice, getBusiness, getInvoice, listEvents, markSent, setPaid } from "@/lib/db";
import { formatSGD } from "@/lib/money";
import { paynowPayload } from "@/lib/paynow";
import { normalizeSgMobile } from "@/lib/phone";
import { qrDataUrl } from "@/lib/qr";
import { emailMessage, whatsappMessage } from "@/lib/templates";
import { invoiceDocLabel, isOverdue, type Business, type Invoice, type InvoiceEvent } from "@/lib/types";
import FocusFrame from "@/components/FocusFrame";
import ConfirmSheet from "@/components/ConfirmSheet";
import {
  IconCheck, IconCopy, IconDownload, IconEdit, IconReceipt, IconShare,
  IconTrash, IconUndo, IconWarning, IconWhatsApp,
} from "@/components/icons";

export default function InvoiceDetail({ id }: { id: string }) {
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [events, setEvents] = useState<InvoiceEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [offerReceipt, setOfferReceipt] = useState(false);

  useEffect(() => {
    getInvoice(id)
      .then((inv) => {
        setInvoice(inv);
        return getBusiness(inv.business_id);
      })
      .then(setBusiness)
      .catch((e) => setError(e.message));
    listEvents(id).then(setEvents).catch(() => {});
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
    const hasPaynow = st.paynow_number.trim() !== "";
    const qrPromise = hasPaynow
      ? qrDataUrl(paynowPayload({
          mobile: st.paynow_number,
          amountCents: inv.total_cents,
          reference: inv.invoice_number ?? "",
          merchantName: st.payee_name.toUpperCase(),
        }))
      : Promise.resolve(null);
    const [qr, logo] = await Promise.all([qrPromise, fetchLogo()]);
    const { pdf } = await import("@react-pdf/renderer");
    const { default: InvoicePdf } = await import("@/components/InvoicePdf");
    const blob = await pdf(
      <InvoicePdf invoice={inv} business={st} qr={qr} logo={logo} variant={variant} />
    ).toBlob();
    const filename = `${invoiceDocLabel(inv, variant)}.pdf`;
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

  // One send action: native share sheet with the PDF attached — picking Gmail /
  // WhatsApp there carries the attachment, which a mailto/compose URL never can.
  // Some share targets drop the `text` when a file is present (iOS Gmail), so the
  // message is also copied to the clipboard before the sheet opens.
  async function sendInvoice(variant: "invoice" | "receipt" = "invoice") {
    const inv = invoice!; const biz = business!;
    setBusy(true);
    try {
      const { blob, filename } = await generatePdfBlob(variant);
      const file = new File([blob], filename, { type: "application/pdf" });
      const text = emailMessage(inv, biz);
      try { await navigator.clipboard.writeText(text); } catch { /* non-fatal */ }
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text, title: filename.replace(".pdf", "") });
        if (variant === "invoice" && inv.status !== "draft") {
          await markSent(inv.id, inv.business_id);
          setInvoice({ ...inv, sent_at: inv.sent_at ?? new Date().toISOString() });
          listEvents(inv.id).then(setEvents).catch(() => {});
        }
      } else {
        // Desktop fallback: download the PDF, then open a Gmail compose draft
        // pre-addressed and pre-bodied — user attaches the just-downloaded file.
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement("a"), { href: url, download: filename });
        a.click();
        URL.revokeObjectURL(url);
        openGmailCompose(text);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    }
    setBusy(false);
  }

  const whatsapp = normalizeSgMobile(invoice.customers?.phone);

  function openWhatsApp() {
    const inv = invoice!;
    const msg = whatsappMessage(inv, business!);
    const base = whatsapp.e164 ? `https://wa.me/${whatsapp.e164}` : "https://wa.me/";
    if (whatsapp.e164 && !whatsapp.isMobile) {
      if (!confirm(`${inv.customers?.phone} looks like a landline, not a mobile — WhatsApp may not open a chat for it. Try anyway?`)) return;
    }
    window.open(`${base}?text=${encodeURIComponent(msg)}`, "_blank");
    if (inv.status !== "draft") {
      markSent(inv.id, inv.business_id).then(() => {
        setInvoice({ ...inv, sent_at: inv.sent_at ?? new Date().toISOString() });
        listEvents(inv.id).then(setEvents).catch(() => {});
      });
    }
  }

  // Opens a pre-filled Gmail compose draft to the customer's email. Gmail's
  // compose URL can't carry an attachment, so this is only the desktop
  // fallback for sendInvoice — the mobile path uses the share sheet instead.
  function openGmailCompose(body: string) {
    const inv = invoice!;
    const email = inv.customers?.email?.trim() ?? "";
    const subject = `Invoice ${inv.invoice_number ?? ""} from ${business!.name}`;
    const url =
      `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}` +
      `&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, "_blank");
  }

  async function onTogglePaid() {
    const inv = invoice!;
    try {
      const paid = inv.status !== "paid";
      await setPaid(inv.id, paid, inv.business_id);
      setInvoice({ ...inv, status: paid ? "paid" : "unpaid", paid_date: paid ? new Date().toISOString().slice(0, 10) : null });
      listEvents(inv.id).then(setEvents).catch(() => {});
      if (paid) setOfferReceipt(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  async function onDelete() {
    const inv = invoice!;
    setConfirmingDelete(false);
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
          {invoice.due_date && (
            <p style={{ color: isOverdue(invoice) ? "var(--warning)" : "var(--text-tertiary)", fontSize: "0.85rem" }}>
              Due {invoice.due_date}
            </p>
          )}
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
        <button onClick={() => sendInvoice()} disabled={busy} className="btn btn-secondary icon-btn" style={{ flex: 1 }}>
          <IconShare /> Send invoice
        </button>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {invoice.customers?.phone && (
          <button onClick={openWhatsApp} className="btn btn-secondary icon-btn btn-whatsapp" style={{ flex: 1, minWidth: 150 }}>
            <IconWhatsApp /> WhatsApp {invoice.customers.name?.split(/\s+/)[0]}
            {!whatsapp.isMobile && <IconWarning size={13} />}
          </button>
        )}
        {invoice.status === "paid" && (
          <button onClick={() => sendInvoice("receipt")} disabled={busy}
            className="btn btn-secondary icon-btn" style={{ flex: 1, minWidth: 150 }}>
            <IconReceipt /> Receipt PDF
          </button>
        )}
      </div>
      {invoice.sent_at && (
        <p style={{ color: "var(--text-tertiary)", fontSize: 13, marginTop: -8, marginBottom: 16 }}>
          Sent {new Date(invoice.sent_at).toLocaleDateString("en-SG", { day: "numeric", month: "short" })}
        </p>
      )}

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

      {events.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-label">Activity</div>
          {events.map((ev) => (
            <p key={ev.id} style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
              {({ created: "Invoice created", sent: "Sent", reminded: "Reminder sent",
                 paid: "Marked paid", unpaid: "Marked unpaid" } as const)[ev.kind]}
              {" · "}
              {new Date(ev.created_at).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          ))}
        </div>
      )}

      <button onClick={() => setConfirmingDelete(true)} className="btn-danger icon-btn"
        style={{ display: "flex", width: "100%", padding: "10px", borderRadius: "var(--radius-sm)" }}>
        <IconTrash /> Delete invoice
      </button>

      <ConfirmSheet
        open={confirmingDelete}
        danger
        title={invoice.status === "draft" ? "Delete this draft?" : `Delete invoice ${invoice.invoice_number}?`}
        message={invoice.status === "draft"
          ? "This draft will be permanently removed."
          : "This can't be undone. If it's your most recent invoice, its number will be reused for the next one."}
        confirmLabel="Delete"
        onConfirm={onDelete}
        onCancel={() => setConfirmingDelete(false)}
      />

      <ConfirmSheet
        open={offerReceipt}
        title="Send receipt?"
        message={`Send a receipt to ${invoice.customers?.name?.trim().split(/\s+/)[0] ?? "the customer"} now?`}
        confirmLabel="Send receipt"
        onConfirm={() => { setOfferReceipt(false); sendInvoice("receipt"); }}
        onCancel={() => setOfferReceipt(false)}
      />
    </main>
  );
}
