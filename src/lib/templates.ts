import { formatSGD } from "@/lib/money";
import type { Business, Invoice } from "@/lib/types";

// The user's real default email copy — seeded here (not in the DB) so it can
// evolve without a migration. Placeholders: {name} {first_name} {job} {job_date}
// {invoice_number} {total} {paynow} {payee_name} {business_name}
export const DEFAULT_EMAIL_TEMPLATE =
  "Hello!\nAttached is the invoice for {job} for {job_date}! Do let me know if you have any questions!\n\n--\nRegards,\n{payee_name}";

export const DEFAULT_WHATSAPP_TEMPLATE =
  "Hi {first_name}! Here's your invoice {invoice_number} for {job} — total {total}. " +
  "You can PayNow via the QR in the PDF or to {paynow}. Thank you!";

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, key) => (key in vars ? vars[key] : m));
}

export function templateVars(inv: Invoice, biz: Business): Record<string, string> {
  const name = inv.customers?.name?.trim() ?? "";
  return {
    name: name || "there",
    first_name: name.split(/\s+/)[0] || "there",
    job: inv.job_event || "the shoot",
    job_date: inv.job_date || "",
    invoice_number: inv.invoice_number ?? "",
    total: formatSGD(inv.total_cents),
    paynow: biz.paynow_number.trim(),
    payee_name: biz.payee_name || biz.name,
    business_name: biz.name,
  };
}

export function emailMessage(inv: Invoice, biz: Business): string {
  const t = biz.email_template.trim() || DEFAULT_EMAIL_TEMPLATE;
  return renderTemplate(t, templateVars(inv, biz));
}

export function whatsappMessage(inv: Invoice, biz: Business): string {
  const t = biz.whatsapp_template.trim() || DEFAULT_WHATSAPP_TEMPLATE;
  return renderTemplate(t, templateVars(inv, biz));
}
