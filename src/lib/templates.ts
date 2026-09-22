import { formatSGD } from "@/lib/money";
import type { Business, Invoice } from "@/lib/types";

// The user's real default email copy — seeded here (not in the DB) so it can
// evolve without a migration. Placeholders: {name} {first_name} {job} {job_date}
// {invoice_number} {total} {paynow} {payee_name} {business_name}
export const DEFAULT_EMAIL_TEMPLATE = [
  "Hello {first_name},",
  "",
  "Attached is the invoice for {job} on {job_date}! It was a pleasure working on this with you.",
  "",
  "The total comes up to {total} — payable via PayNow using the QR code in the PDF, or directly to {paynow}.",
  "",
  "Do let me know if you have any questions!",
  "",
  "Best,",
  "{payee_name}",
].join("\n");

// Matches how the user names invoices by hand: project name + the role
// they did, e.g. "Invoice for OMM WAGNER'S SIEGFRIED cam assist" — {job}
// already carries both, since that's what goes into the job field per-invoice.
export const DEFAULT_EMAIL_SUBJECT = "Invoice for {job}";

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

/** Cleans up the wreckage an empty placeholder leaves behind. `job_date` is a
 *  free-text field and is sometimes blank, which would otherwise render as
 *  "at the shoot on  — I really enjoyed it." Strips a preposition left
 *  dangling before punctuation or a line end, then collapses the double
 *  spaces and space-before-punctuation that the blank left. Line structure
 *  (and so paragraph breaks) is preserved. */
export function tidyMessage(text: string): string {
  return text
    .split("\n")
    .map((line) =>
      line
        .replace(/ (?:on|for|at) (?=\s*(?:[—,.!?:;]|$))/g, " ")
        .replace(/[ \t]{2,}/g, " ")
        .replace(/ +(?=[,.!?:;])/g, "")
        .trimEnd()
    )
    .join("\n");
}

export function emailMessage(inv: Invoice, biz: Business): string {
  const t = biz.email_template.trim() || DEFAULT_EMAIL_TEMPLATE;
  return tidyMessage(renderTemplate(t, templateVars(inv, biz)));
}

/** Subject line for the invoice email. Not stored in the DB (no migration):
 *  the body is the part worth customising per business, the subject isn't. */
export function emailSubject(inv: Invoice, biz: Business): string {
  return renderTemplate(DEFAULT_EMAIL_SUBJECT, templateVars(inv, biz))
    .replace(/\s+/g, " ")
    .trim();
}

export function whatsappMessage(inv: Invoice, biz: Business): string {
  const t = biz.whatsapp_template.trim() || DEFAULT_WHATSAPP_TEMPLATE;
  return tidyMessage(renderTemplate(t, templateVars(inv, biz)));
}
