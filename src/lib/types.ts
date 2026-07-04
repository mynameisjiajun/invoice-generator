import type { DiscountType, LineItem } from "./money";

export type Customer = {
  id: number; name: string; phone: string; email: string; address: string;
};

export type Preset = {
  id: string; name: string; description: string;
  unit_price_cents: number; default_qty: number;
};

export type InvoiceStatus = "draft" | "unpaid" | "paid";

export type Invoice = {
  id: string;
  invoice_number: string | null;
  status: InvoiceStatus;
  issue_date: string;            // ISO date
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
  customers?: Customer | null;   // joined
};

export type Settings = {
  id: number; business_name: string; address: string; phone: string;
  email: string; paynow_number: string; payee_name: string;
  bank_details: string; payment_terms: string;
  invoice_prefix: string; next_invoice_seq: number;
};

export function isOverdue(inv: Invoice, today = new Date()): boolean {
  if (inv.status !== "unpaid") return false;
  const due = new Date(inv.issue_date);
  due.setDate(due.getDate() + 30);
  return today > due;
}
