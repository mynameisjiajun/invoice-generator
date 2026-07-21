import type { DiscountType, LineItem } from "./money";

export type Customer = {
  id: number; business_id: string; name: string; company: string; phone: string;
  email: string; uen: string; address: string;
};

export type Preset = {
  id: string; business_id: string; name: string; description: string;
  unit_price_cents: number; default_qty: number;
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
  customers?: Customer | null;   // joined
};

export type Business = {
  id: string; name: string; slug: string; address: string; phone: string;
  email: string; paynow_number: string; payee_name: string;
  bank_details: string; payment_terms: string;
  invoice_prefix: string; next_invoice_seq: number;
  archived_at: string | null;
  email_template: string; whatsapp_template: string;
};

export function isOverdue(inv: Invoice, today = new Date()): boolean {
  if (inv.status !== "unpaid") return false;
  const due = inv.due_date ? new Date(inv.due_date) : new Date(inv.issue_date);
  if (!inv.due_date) due.setDate(due.getDate() + 30);
  return today > due;
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

export type PrintMaterial = {
  name: string;
  density_g_cm3: number;
  cost_per_gram_cents: number;
};

export type PrintPricingSettings = {
  business_id: string;
  materials: PrintMaterial[];
  print_speed_cm3_per_hour: number;
  cost_per_hour_cents: number;
  waste_percent: number;
  infill_percent: number;
  multi_colour_time_surcharge_percent: number;
  multi_colour_waste_percent: number;
  minimum_price_cents: number | null;
  telegram_handle: string;
};

export type PrintQuoteStatus = "new" | "contacted" | "archived";

export type PrintQuote = {
  id: string;
  business_id: string;
  material: string;
  volume_cm3: number;
  weight_g: number;
  estimated_hours: number;
  price_cents: number;
  file_path: string;
  multi_colour: boolean;
  notes: string;
  status: PrintQuoteStatus;
  created_at: string;
};
