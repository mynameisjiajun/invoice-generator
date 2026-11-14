"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  convertQuote, deleteInvoice, getBusiness, getInvoice, listEvents, markSent, setPaid, setRentalSigned,
} from "@/lib/db";
import { todayLocalIso } from "@/lib/date";
import { formatSGD } from "@/lib/money";
import { formatJobDate } from "@/lib/printRates";
import { daysLabel, formatRentalDateTime, rentalDays } from "@/lib/rental";
import { paynowPayload } from "@/lib/paynow";
import { normalizeSgMobile } from "@/lib/phone";
import { qrDataUrl } from "@/lib/qr";
import { emailMessage, receiptEmailMessage, receiptWhatsappMessage, whatsappMessage } from "@/lib/templates";
import {
  invoiceDocLabel, isOverdue, isQuote, needsSignature, type Business, type Invoice, type InvoiceEvent,
} from "@/lib/types";
import { dueNowCents, paidCents, paymentState } from "@/lib/payments";
import PaymentsCard from "@/components/PaymentsCard";
import FocusFrame from "@/components/FocusFrame";
import ConfirmSheet from "@/components/ConfirmSheet";
import {
  IconCheck, IconCopy, IconDownload, IconEdit, IconMail, IconReceipt, IconSend,
  IconShare, IconTrash, IconWarning, IconWhatsApp,
} from "@/components/icons";

/** Blob → bare base64 (no data-URL prefix), for posting a PDF as JSON.
 *  FileReader rather than Buffer/btoa: this runs in the browser, and btoa on a
 *  binary string breaks on bytes above 0x7F. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the generated PDF"));
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(",");
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.readAsDataURL(blob);
  });
}

export default function InvoiceDetail({ id }: { id: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const justFinalized = params.get("just") === "1";
  // From "Finalize & email" (already confirmed on the form): send once.
  const autoEmail = params.get("email") === "1";
  const autoEmailed = useRef(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [events, setEvents] = useState<InvoiceEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [offerReceipt, setOfferReceipt] = useState(false);
  const [confirmingEmail, setConfirmingEmail] = useState(false);
  const [confirmingReceiptEmail, setConfirmingReceiptEmail] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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

  useEffect(() => {
    if (!autoEmail || autoEmailed.current || !invoice || !business || invoice.status === "draft") return;
    autoEmailed.current = true;
    router.replace(`/invoices_login/invoices/${invoice.id}?just=1`);
    void Promise.resolve().then(() => emailInvoice("send"));
    // emailInvoice reads the loaded invoice; run once when it's ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEmail, invoice, business]);

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

  async function generatePdfBlob(variant: "invoice" | "receipt" = "invoice"): Promise<{ blob: Blob; filename: string }> {
    const inv = invoice!; const st = business!;
    // The QR asks for what's due now (deposit, then balance); quotes and
    // fully paid invoices get none.
    const amount = isQuote(inv) ? 0 : dueNowCents(inv);
    const hasPaynow = st.paynow_number.trim() !== "" && amount > 0;
    const qrPromise = hasPaynow
      ? qrDataUrl(paynowPayload({
          mobile: st.paynow_number,
          amountCents: amount,
          reference: inv.invoice_number ?? "",
        }))
      : Promise.resolve(null);
    const qr = await qrPromise;
    const { pdf } = await import("@react-pdf/renderer");
    const { default: InvoicePdf } = await import("@/components/InvoicePdf");
    const blob = await pdf(
      <InvoicePdf invoice={inv} business={st} qr={qr} logo={st.logo_data_url} variant={variant} />
    ).toBlob();
    const filename = `${invoiceDocLabel(inv, variant)}.pdf`;
    return { blob, filename };
  }

  // The terms on their own (rental T&C or shoot agreement), with this
  // invoice's number on the signature page — e.g. to resend for signing.
  async function downloadTerms() {
    const inv = invoice!;
    setBusy(true);
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { TermsOnlyPdf, rentalTermsDoc, shootTermsDoc } = await import("@/components/InvoicePdf");
      const doc = inv.is_rental ? rentalTermsDoc() : shootTermsDoc(inv.contract!, Number(inv.deposit_percent ?? 0));
      const blob = await pdf(<TermsOnlyPdf doc={doc} invoiceNumber={inv.invoice_number ?? "DRAFT"} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), {
        href: url, download: `${doc.title} ${inv.invoice_number ?? "Draft"}.pdf`,
      });
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
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

  // One send action: native share sheet with the PDF attached — picking Mail /
  // WhatsApp there carries the attachment, which a mailto: link never can.
  // Some share targets drop the `text` when a file is present, so the
  // message is also copied to the clipboard before the sheet opens.
  async function sendInvoice(variant: "invoice" | "receipt" = "invoice") {
    const inv = invoice!; const biz = business!;
    setBusy(true);
    try {
      const { blob, filename } = await generatePdfBlob(variant);
      const file = new File([blob], filename, { type: "application/pdf" });
      const text = variant === "receipt" ? receiptEmailMessage(inv, biz) : emailMessage(inv, biz);
      try { await navigator.clipboard.writeText(text); } catch { /* non-fatal */ }
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text, title: filename.replace(".pdf", "") });
        if (variant === "invoice" && inv.status !== "draft") {
          await markSent(inv.id, inv.business_id);
          setInvoice({ ...inv, sent_at: inv.sent_at ?? new Date().toISOString() });
          listEvents(inv.id).then(setEvents).catch(() => {});
        }
      } else {
        // Desktop fallback: download the PDF, then open a mail compose window
        // pre-addressed and pre-bodied — user attaches the just-downloaded file.
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement("a"), { href: url, download: filename });
        a.click();
        URL.revokeObjectURL(url);
        openMailCompose(text);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    }
    setBusy(false);
  }

  // Sends (or drafts) the invoice from the business address via /api/mail/send.
  // The PDF is rendered here — that's where @react-pdf/renderer and the QR code
  // already live — and posted up as base64. Recipient, subject and body are
  // derived server-side from the invoice, so this call can't be redirected.
  async function emailInvoice(mode: "send" | "draft", variant: "invoice" | "receipt" = "invoice") {
    const inv = invoice!;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { blob } = await generatePdfBlob(variant);
      const pdfBase64 = await blobToBase64(blob);
      const res = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: inv.id, mode, variant, pdfBase64 }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Sending failed");

      if (mode === "draft") {
        // iCloud can take a minute or two to sync the draft to Apple Mail.
        setNotice(`Draft for ${json.to} saved to your iCloud Drafts. It can take a minute or two to appear in Apple Mail.`);
      } else {
        const what = variant === "receipt" ? "Receipt sent" : "Sent";
        setNotice(json.savedToSent
          ? `${what} to ${json.to}. A copy is in Sent Messages in Apple Mail.`
          : `${what} to ${json.to}, but the copy couldn't be saved to Sent Messages.`);
        if (variant === "invoice" && inv.status !== "draft") {
          await markSent(inv.id, inv.business_id);
          setInvoice({ ...inv, sent_at: inv.sent_at ?? new Date().toISOString() });
          listEvents(inv.id).then(setEvents).catch(() => {});
        }
      }
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  const whatsapp = normalizeSgMobile(invoice.customers?.phone);

  function openWhatsApp() {
    const inv = invoice!;
    // Once paid, WhatsApp sends the thank-you/receipt wording instead.
    const msg = inv.status === "paid" ? receiptWhatsappMessage(inv, business!) : whatsappMessage(inv, business!);
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

  // Opens a pre-filled compose window in the default mail app (Apple Mail) to
  // the customer's email. A mailto: link can't carry an attachment, so this is
  // only the fallback for sendInvoice — where it can, the share sheet is used.
  function openMailCompose(body: string) {
    const inv = invoice!;
    const email = inv.customers?.email?.trim() ?? "";
    const subject = `Invoice ${inv.invoice_number ?? ""} from ${business!.name}`;
    window.location.href =
      `mailto:${encodeURIComponent(email)}` +
      `?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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

  async function onToggleSigned() {
    const inv = invoice!;
    try {
      const at = await setRentalSigned(inv.id, !inv.rental_signed_at);
      setInvoice({ ...inv, rental_signed_at: at });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update the T&C status");
    }
  }

  // Quote → invoice draft carrying everything over; opens it ready to finalize.
  async function onConvertQuote() {
    setBusy(true); setError(null);
    try {
      const draftId = await convertQuote(invoice!.id);
      router.push(`/invoices_login/invoices/new?draft=${draftId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't convert the quote");
      setBusy(false);
    }
  }

  async function onDelete() {
    const inv = invoice!;
    setConfirmingDelete(false);
    try {
      await deleteInvoice(inv.id, inv.doc_type ?? "invoice");
      router.push(isQuote(inv) ? "/invoices_login/invoices?tab=quotes" : "/invoices_login/invoices");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  const quote = isQuote(invoice);
  const quoteExpired = quote && invoice.status !== "draft" && !invoice.converted_invoice_id
    && !!invoice.due_date && invoice.due_date < todayLocalIso();
  const pstate = paymentState(invoice);
  const statusBadge = invoice.status === "draft"
    ? <span className="badge badge-draft">Draft</span>
    : quote
      ? invoice.converted_invoice_id
        ? <span className="badge badge-paid">Accepted</span>
        : quoteExpired
          ? <span className="badge badge-overdue">Expired</span>
          : <span className="badge badge-unpaid">Open</span>
      : pstate === "paid"
        ? <span className="badge badge-paid">Paid</span>
        : pstate === "deposit-paid"
          ? <span className="badge badge-unpaid">Deposit paid</span>
          : pstate === "part-paid"
            ? <span className="badge badge-unpaid">Part-paid</span>
            : <span className="badge badge-unpaid">Unpaid</span>;

  return (
    <main className="page-container animate-slide-up">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 className="page-title">{invoice.invoice_number ?? "Draft"}</h1>
          {justFinalized && (
            <p style={{ color: "var(--success)", fontSize: "0.85rem", fontWeight: 600 }}>
              Created — ready to send
            </p>
          )}
          <p style={{ color: "var(--text-tertiary)", fontSize: "0.85rem" }}>
            Issued {invoice.issue_date}
          </p>
          {invoice.due_date && (
            <p style={{ color: isOverdue(invoice) || quoteExpired ? "var(--warning)" : "var(--text-tertiary)", fontSize: "0.85rem" }}>
              {quote ? "Valid until" : "Due"} {invoice.due_date}
            </p>
          )}
        </div>
        {statusBadge}
      </div>

      {/* Invoice summary card */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-label">Customer</div>
        <p style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 2 }}>{invoice.customers?.name}</p>
        {invoice.is_rental ? (() => {
          const days = rentalDays(invoice.rental_start, invoice.rental_end);
          return (
            <>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                <span className="badge badge-draft" style={{ marginRight: 6 }}>Rental</span>
                {invoice.job_event || "Equipment rental"}
              </p>
              <p style={{ color: "var(--text-tertiary)", fontSize: "0.8rem", marginTop: 4 }}>
                {invoice.rental_start && invoice.rental_end
                  ? `${formatRentalDateTime(invoice.rental_start)} → ${formatRentalDateTime(invoice.rental_end)}${days ? ` · ${daysLabel(days)}` : ""}`
                  : "Rental period not set"}
              </p>
              {invoice.job_location ? (
                <p style={{ color: "var(--text-tertiary)", fontSize: "0.8rem" }}>{invoice.job_location}</p>
              ) : null}
            </>
          );
        })() : (
          <>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>{invoice.job_event}</p>
            <p style={{ color: "var(--text-tertiary)", fontSize: "0.8rem" }}>
              {[formatJobDate(invoice.job_date), invoice.job_location].filter(Boolean).join(" · ")}
            </p>
          </>
        )}
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

      {/* Quote: the one action that matters once the client says yes */}
      {quote && invoice.status !== "draft" && (
        invoice.converted_invoice_id ? (
          <Link href={`/invoices_login/invoices/${invoice.converted_invoice_id}`} className="btn btn-secondary icon-btn"
            style={{ display: "flex", width: "100%", marginBottom: 10, textDecoration: "none", justifyContent: "center" }}>
            <IconCheck /> Accepted · open the invoice
          </Link>
        ) : (
          <button onClick={onConvertQuote} disabled={busy} className="btn btn-primary icon-btn"
            style={{ width: "100%", marginBottom: 10 }}>
            <IconCheck /> Client said yes · convert to invoice
          </button>
        )
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <button onClick={() => downloadPdf()} disabled={busy} className="btn btn-primary icon-btn" style={{ flex: 1 }}>
          <IconDownload /> {busy ? "Generating…" : "Download PDF"}
        </button>
        <button onClick={() => sendInvoice()} disabled={busy}
          className={`btn btn-secondary icon-btn ${justFinalized ? "pulse-once" : ""}`} style={{ flex: 1 }}>
          <IconShare /> {quote ? "Send quote" : "Send invoice"}
        </button>
      </div>
      {invoice.customers?.email?.trim() && (
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <button onClick={() => setConfirmingEmail(true)} disabled={busy}
            className="btn btn-secondary icon-btn" style={{ flex: 1 }}>
            <IconSend /> Email now
          </button>
          <button onClick={() => emailInvoice("draft")} disabled={busy}
            className="btn btn-ghost icon-btn" style={{ flex: 1 }}>
            <IconMail /> Draft email
          </button>
        </div>
      )}
      {notice && (
        <p style={{ color: "var(--text-tertiary)", fontSize: 13, marginBottom: 10 }}>{notice}</p>
      )}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {invoice.customers?.phone && (
          <button onClick={openWhatsApp} className="btn btn-secondary icon-btn btn-whatsapp" style={{ flex: 1, minWidth: 150 }}>
            <IconWhatsApp /> WhatsApp {invoice.customers.name?.split(/\s+/)[0]}
            {!whatsapp.isMobile && <IconWarning size={13} />}
          </button>
        )}
      </div>
      {(invoice.contract || invoice.is_rental) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-label">{invoice.is_rental ? "Rental T&C" : "Shoot contract"}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {needsSignature(invoice) && !quote && invoice.status !== "draft" && (<>
              {invoice.rental_signed_at ? (
                <span className="badge badge-paid">
                  Signed {new Date(invoice.rental_signed_at).toLocaleDateString("en-SG", { day: "numeric", month: "short" })}
                </span>
              ) : (
                <span className="badge badge-unpaid">Not signed yet</span>
              )}
              <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                onClick={onToggleSigned}>
                {invoice.rental_signed_at ? "Undo" : "Mark signed"}
              </button>
            </>)}
            <button className="btn btn-ghost icon-btn" style={{ marginLeft: "auto", padding: "4px 10px", fontSize: "0.78rem" }}
              onClick={downloadTerms} disabled={busy}>
              <IconDownload size={14} /> Download T&amp;C only
            </button>
          </div>
          {invoice.contract && (
            <p style={{ margin: "8px 0 0", fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
              {invoice.contract.preset === "strict" ? "Strict" : invoice.contract.preset === "standard" ? "Standard" : "Custom"} terms
              {" · "}{invoice.contract.on.length} optional clauses on. Change them with Edit.
            </p>
          )}
        </div>
      )}

      {!quote && invoice.status !== "draft" && (
        <PaymentsCard invoice={invoice}
          onChange={(fresh, recorded) => {
            setInvoice(fresh);
            listEvents(fresh.id).then(setEvents).catch(() => {});
            if (recorded) setOfferReceipt(true);
          }}
          onUndoPaid={onTogglePaid} />
      )}
      {!quote && paidCents(invoice) > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-label">Receipt</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {invoice.customers?.email?.trim() && (
              <button onClick={() => setConfirmingReceiptEmail(true)} disabled={busy}
                className="btn btn-secondary icon-btn" style={{ flex: 1, minWidth: 140 }}>
                <IconSend /> Email receipt
              </button>
            )}
            <button onClick={() => sendInvoice("receipt")} disabled={busy}
              className="btn btn-ghost icon-btn" style={{ flex: 1, minWidth: 140 }}>
              <IconReceipt /> Share receipt
            </button>
            <button onClick={() => downloadPdf("receipt")} disabled={busy}
              className="btn btn-ghost icon-btn" style={{ flex: 1, minWidth: 140 }}>
              <IconDownload /> Download
            </button>
          </div>
        </div>
      )}
      {invoice.sent_at && (
        <p style={{ color: "var(--text-tertiary)", fontSize: 13, marginTop: -8, marginBottom: 16 }}>
          Sent {new Date(invoice.sent_at).toLocaleDateString("en-SG", { day: "numeric", month: "short" })}
        </p>
      )}

      {/* Manage row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {invoice.status !== "paid" && (
          <Link href={`/invoices_login/invoices/new?draft=${invoice.id}`} className="btn btn-ghost icon-btn"
            style={{ flex: 1, textAlign: "center", textDecoration: "none" }}>
            <IconEdit /> Edit
          </Link>
        )}
        <Link href={`/invoices_login/invoices/new?duplicate=${invoice.id}`} className="btn btn-ghost icon-btn"
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
        <IconTrash /> {quote ? "Delete quote" : "Delete invoice"}
      </button>

      <ConfirmSheet
        open={confirmingDelete}
        danger
        title={invoice.status === "draft" ? "Delete this draft?" : `Delete ${quote ? "quote" : "invoice"} ${invoice.invoice_number}?`}
        message={invoice.status === "draft"
          ? "This draft will be permanently removed."
          : "This can't be undone. If it's your most recent invoice, its number will be reused for the next one."}
        confirmLabel="Delete"
        onConfirm={onDelete}
        onCancel={() => setConfirmingDelete(false)}
      />

      <ConfirmSheet
        open={confirmingEmail}
        title={quote ? "Send this quote now?" : "Send this invoice now?"}
        message={`It will be emailed straight to ${invoice.customers?.email?.trim()} from chuajiajun@apexcinematics.tech, with the PDF attached. An email can't be unsent.`}
        confirmLabel="Send now"
        onConfirm={() => { setConfirmingEmail(false); emailInvoice("send"); }}
        onCancel={() => setConfirmingEmail(false)}
      />

      <ConfirmSheet
        open={offerReceipt}
        title="Send receipt?"
        message={invoice.customers?.email?.trim()
          ? `Email a receipt to ${invoice.customers.email.trim()} now, from chuajiajun@apexcinematics.tech?`
          : `Send a receipt to ${invoice.customers?.name?.trim().split(/\s+/)[0] ?? "the customer"} now?`}
        confirmLabel={invoice.customers?.email?.trim() ? "Email receipt" : "Send receipt"}
        onConfirm={() => {
          setOfferReceipt(false);
          if (invoice.customers?.email?.trim()) emailInvoice("send", "receipt");
          else sendInvoice("receipt");
        }}
        onCancel={() => setOfferReceipt(false)}
      />

      <ConfirmSheet
        open={confirmingReceiptEmail}
        title="Email the receipt now?"
        message={`The receipt will be emailed straight to ${invoice.customers?.email?.trim()} from chuajiajun@apexcinematics.tech, with the PDF attached.`}
        confirmLabel="Send receipt"
        onConfirm={() => { setConfirmingReceiptEmail(false); emailInvoice("send", "receipt"); }}
        onCancel={() => setConfirmingReceiptEmail(false)}
      />
    </main>
  );
}
