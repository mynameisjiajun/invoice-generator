import { formatSGD } from "@/lib/money";
import { paynowDisplay } from "@/lib/paynow";
import { attachesRentalTerms, isPrintBusiness, isRentalInvoice, type Business, type Invoice } from "@/lib/types";
import { formatJobDate } from "./printRates";

/** Added to every message for an equipment-rental invoice, whatever the
 *  business's own template says: the T&C only bind once acknowledged. */
export const RENTAL_MESSAGE_NOTE =
  "As this is an equipment rental, the Equipment Rental Terms & Conditions are attached after the invoice. " +
  "Please read them, then sign and send back the acknowledgement page (a photo is fine) before collection.";

/** For a rental whose T&C were sent separately rather than attached. */
export const RENTAL_MESSAGE_NOTE_SEPARATE =
  "As this is an equipment rental, it is subject to our Equipment Rental Terms & Conditions, sent separately. " +
  "Please make sure the signed acknowledgement is back with us before collection.";

/** "14 Nov 2026 to 17 Nov 2026" for a rental period, "" if incomplete. */
function rentalDateRange(inv: Invoice): string {
  const start = (inv.rental_start ?? "").slice(0, 10);
  const end = (inv.rental_end ?? "").slice(0, 10);
  if (!start || !end) return "";
  return start === end ? formatJobDate(start) : `${formatJobDate(start)} to ${formatJobDate(end)}`;
}

function withRentalNote(inv: Invoice, message: string): string {
  if (!isRentalInvoice(inv)) return message;
  const note = attachesRentalTerms(inv) ? RENTAL_MESSAGE_NOTE : RENTAL_MESSAGE_NOTE_SEPARATE;
  return `${message}\n\n${note}`;
}

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
  const rental = isRentalInvoice(inv) && !isPrintBusiness(biz);
  return {
    name: name || "there",
    first_name: name.split(/\s+/)[0] || "there",
    job: inv.job_event || (isPrintBusiness(biz) ? "your print order" : rental ? "your equipment rental" : "the shoot"),
    job_date: rental ? rentalDateRange(inv) : formatJobDate(inv.job_date || ""),
    invoice_number: inv.invoice_number ?? "",
    total: formatSGD(inv.total_cents),
    paynow: paynowDisplay(biz.paynow_number),
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
  return withRentalNote(inv, tidyMessage(renderTemplate(t, templateVars(inv, biz))));
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
  return withRentalNote(inv, tidyMessage(renderTemplate(t, templateVars(inv, biz))));
}
