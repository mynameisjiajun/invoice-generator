import type { DiscountType, LineItem } from "./money";
import { plusDaysIso, todayLocalIso } from "./date";

export type Customer = {
  id: number; business_id: string; name: string; company: string; phone: string;
  email: string; uen: string; address: string;
};

export type Preset = {
  id: string; business_id: string; name: string; description: string;
  unit_price_cents: number; default_qty: number;
  /** Replacement value for rental gear (migration 022); 0/absent = none. */
  replacement_cents?: number;
};

export type InvoiceStatus = "draft" | "unpaid" | "paid";

export type Invoice = {
  id: string;
  business_id: string;
  invoice_number: string | null;
  status: InvoiceStatus;
  issue_date: string;            // ISO date
  due_date: string | null;       // ISO date
  customer_id: number | null;
  job_event: string;
  job_date: string;
  job_location: string;
  line_items: LineItem[];
  discount_type: DiscountType;
  discount_value: number;
  subtotal_cents: number;
  total_cents: number;
  paid_date: string | null;
  sent_at: string | null;
  /** Equipment rental (migration 020). Optional because rows read before
   *  the migration don't have them. Rental invoices carry the rental T&C. */
  is_rental?: boolean;
  rental_start?: string;         // "YYYY-MM-DDTHH:mm" (local) or ""
  rental_end?: string;           // "YYYY-MM-DDTHH:mm" (local) or ""
  /** Attach the rental T&C to the PDF (migration 021). false = the T&C
   *  were sent separately; undefined (older rows) counts as attached. */
  rental_terms?: boolean;
  /** When the renter's signed T&C acknowledgement came back (migration
   *  022); null/absent = not yet. */
  rental_signed_at?: string | null;
  /** "quote" rows are quotes (migration 023): own Q-numbers, never counted
   *  as revenue or overdue; due_date is "valid until". */
  doc_type?: DocType;
  /** Share of the total asked upfront to confirm a shoot (0 = none). */
  deposit_percent?: number;
  /** On a quote: the invoice it was converted into. */
  converted_invoice_id?: string | null;
  payments?: Payment[];          // joined
  customers?: Customer | null;   // joined
};

export type DocType = "invoice" | "quote";

/** One transfer received against an invoice (deposit, balance, …). */
export type Payment = {
  id: string; invoice_id: string; business_id: string;
  amount_cents: number; paid_on: string; note: string; created_at: string;
};

export function isQuote(inv: Pick<Invoice, "doc_type"> | null | undefined): boolean {
  return inv?.doc_type === "quote";
}

export type Business = {
  id: string; name: string; slug: string; address: string; phone: string;
  email: string; paynow_number: string; payee_name: string;
  bank_details: string; payment_terms: string;
  invoice_prefix: string; next_invoice_seq: number;
  archived_at: string | null;
  email_template: string; whatsapp_template: string;
  logo_data_url: string | null;
  /** "print" switches invoices to the 3D-print form and PDF. Optional
   *  because rows read before migration 019 don't have it. */
  kind?: BusinessKind;
  next_quote_seq?: number;
};

export type BusinessKind = "photo" | "print";

export function isPrintBusiness(b: Pick<Business, "kind"> | null | undefined): boolean {
  return b?.kind === "print";
}

export function isRentalInvoice(inv: Pick<Invoice, "is_rental"> | null | undefined): boolean {
  return inv?.is_rental === true;
}

/** A rental invoice whose PDF carries the T&C pages. */
export function attachesRentalTerms(inv: Pick<Invoice, "is_rental" | "rental_terms"> | null | undefined): boolean {
  return isRentalInvoice(inv) && inv?.rental_terms !== false;
}

/** A finalized rental still waiting on the renter's signed acknowledgement. */
export function awaitingRentalSignature(inv: Pick<Invoice, "is_rental" | "status" | "rental_signed_at">): boolean {
  return inv.is_rental === true && inv.status !== "draft" && !inv.rental_signed_at;
}

export function isOverdue(inv: Invoice, todayIso = todayLocalIso()): boolean {
  if (inv.status !== "unpaid" || isQuote(inv)) return false;
  const due = inv.due_date ?? plusDaysIso(inv.issue_date, 30);
  return todayIso > due;
}

export type InvoiceEventKind = "created" | "sent" | "reminded" | "paid" | "unpaid";
export type InvoiceEvent = {
  id: string; invoice_id: string; business_id: string;
  kind: InvoiceEventKind; created_at: string;
};

/** Label used as the PDF's title and download filename:
 *  "Invoice for <Name> <DDMMYYYY> <Number>" (sanitized for filenames). */
export function invoiceDocLabel(inv: Invoice, variant: "invoice" | "receipt" = "invoice"): string {
  const word = variant === "receipt" ? "Receipt" : "Invoice";
  const name = inv.customers?.name?.trim() || "Client";
  const p = inv.issue_date.split("-"); // ISO YYYY-MM-DD
  const date = p.length === 3 ? `${p[2]}${p[1]}${p[0]}` : inv.issue_date.replace(/-/g, "");
  const number = inv.invoice_number ?? "DRAFT";
  return `${word} for ${name} ${date} ${number}`
    .replace(/[/\\:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

