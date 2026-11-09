import { formatSGD } from "@/lib/money";
import { paynowDisplay } from "@/lib/paynow";
import { attachesRentalTerms, isPrintBusiness, isQuote, isRentalInvoice, type Business, type Invoice } from "@/lib/types";
import { balanceCents, depositCents, depositOutstanding, dueNowCents, isFullUpfront, paidCents } from "@/lib/payments";
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

const SIGN_OFF = /^(best|regards|kind regards|warm(est)? regards|thanks|thank you|cheers|sincerely)\b[^\n]*(\n[^\n]*){0,2}$/i;

/** What the client should pay next on a deposit invoice, in words. */
export function depositMessageNote(inv: Invoice): string | null {
  if (isQuote(inv) || isRentalInvoice(inv)) return null;
  if (isFullUpfront(inv) && paidCents(inv) === 0) {
    return `Full payment of ${formatSGD(inv.total_cents)} is due before the shoot to confirm your booking.`;
  }
  if (depositOutstanding(inv)) {
    const balance = inv.total_cents - depositCents(inv);
    return `To lock in your date, a ${inv.deposit_percent}% deposit of ${formatSGD(dueNowCents(inv))} is due now; ` +
      `the balance of ${formatSGD(balance)} is due on delivery.`;
  }
  const paid = paidCents(inv);
  if (paid > 0 && balanceCents(inv) > 0) {
    return `We've received ${formatSGD(paid)} so far, thank you! The balance of ${formatSGD(balanceCents(inv))} is due on delivery.`;
  }
  return null;
}

/** Slots notes in above the sign-off ("Best,\nName") rather than after the
 *  signature, when the message ends with one. */
function insertNotes(message: string, notes: (string | null)[]): string {
  const add = notes.filter((n): n is string => Boolean(n));
  if (!add.length) return message;
  const paras = message.split(/\n\s*\n/);
  const last = paras[paras.length - 1] ?? "";
  if (paras.length > 1 && SIGN_OFF.test(last.trim())) {
    return [...paras.slice(0, -1), ...add, last].join("\n\n");
  }
  return [message, ...add].join("\n\n");
}

function rentalNote(inv: Invoice): string | null {
  if (!isRentalInvoice(inv)) return null;
  return attachesRentalTerms(inv) ? RENTAL_MESSAGE_NOTE : RENTAL_MESSAGE_NOTE_SEPARATE;
}

function withRentalNote(inv: Invoice, message: string): string {
  return insertNotes(message, [depositMessageNote(inv), rentalNote(inv)]);
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

// Rentals get their own wording (a gear hire isn't "a pleasure working on
// this with you"), and say payment is due before collection, as the T&C
// require (2.1). Built-in rather than a Settings template so the payment
// condition can't be edited out by accident. {job_date} is the rental's date
// range; the "({job_date})" is dropped when the period isn't set.
export const RENTAL_EMAIL_TEMPLATE = [
  "Hello {first_name},",
  "",
  "Thanks for renting with {business_name}! Attached is the invoice for {job} ({job_date}).",
  "",
  "The total comes up to {total}. Please pay via PayNow using the QR code in the PDF, or directly to {paynow}, before collection to confirm your booking.",
  "",
  "Do let me know if you have any questions!",
  "",
  "Best,",
  "{payee_name}",
].join("\n");

export const RENTAL_WHATSAPP_TEMPLATE =
  "Hi {first_name}! Here's your rental invoice {invoice_number} for {job} ({job_date}) — total {total}. " +
  "Please PayNow via the QR in the PDF or to {paynow} before collection to confirm your booking. Thank you!";

/** Fills a rental template; an unset period leaves no empty "()" behind. */
function renderRental(template: string, vars: Record<string, string>): string {
  const t = vars.job_date ? template : template.replace(/ \(\{job_date\}\)/g, "");
  return renderTemplate(t, vars);
}

function isRentalFor(inv: Invoice, biz: Business): boolean {
  return isRentalInvoice(inv) && !isPrintBusiness(biz);
}

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
  if (isQuote(inv)) return quoteMessage(QUOTE_EMAIL_TEMPLATE, inv, biz);
  if (isRentalFor(inv, biz)) {
    return withRentalNote(inv, tidyMessage(renderRental(RENTAL_EMAIL_TEMPLATE, templateVars(inv, biz))));
  }
  const t = biz.email_template.trim() || DEFAULT_EMAIL_TEMPLATE;
  return withRentalNote(inv, tidyMessage(renderTemplate(t, templateVars(inv, biz))));
}

/** Subject line for the invoice email. Not stored in the DB (no migration):
 *  the body is the part worth customising per business, the subject isn't. */
export function emailSubject(inv: Invoice, biz: Business): string {
  return renderTemplate(isQuote(inv) ? "Quote for {job}" : DEFAULT_EMAIL_SUBJECT, templateVars(inv, biz))
    .replace(/\s+/g, " ")
    .trim();
}

export function whatsappMessage(inv: Invoice, biz: Business): string {
  if (isQuote(inv)) return quoteMessage(QUOTE_WHATSAPP_TEMPLATE, inv, biz);
  if (isRentalFor(inv, biz)) {
    return withRentalNote(inv, tidyMessage(renderRental(RENTAL_WHATSAPP_TEMPLATE, templateVars(inv, biz))));
  }
  const t = biz.whatsapp_template.trim() || DEFAULT_WHATSAPP_TEMPLATE;
  return withRentalNote(inv, tidyMessage(renderTemplate(t, templateVars(inv, biz))));
}

// ── Receipts ───────────────────────────────────────────────────────────
// Sent once an invoice is paid. Built-in wording (the Settings templates
// are invoice copy: "Attached is the invoice… payable via PayNow").

export const RECEIPT_EMAIL_TEMPLATE = [
  "Hello {first_name},",
  "",
  "Thank you for your payment! Attached is your receipt for {job}.",
  "",
  "We've received {received} for invoice {invoice_number}{paid_on}{balance_line}",
  "",
  "Thanks again, and do let me know if you need anything else!",
  "",
  "Best,",
  "{payee_name}",
].join("\n");

export const RECEIPT_WHATSAPP_TEMPLATE =
  "Hi {first_name}! Thank you for your payment of {received} for invoice {invoice_number}{paid_on}.{balance_short} " +
  "Here's your receipt for {job}. Thanks again!";

function receiptVars(inv: Invoice, biz: Business): Record<string, string> {
  // A receipt can be for a deposit: say what came in and what's left.
  const payments = inv.payments ?? [];
  const lastDate = inv.status === "paid" && inv.paid_date
    ? inv.paid_date
    : payments.length ? payments[payments.length - 1].paid_on : inv.paid_date;
  const balance = balanceCents(inv);
  return {
    ...templateVars(inv, biz),
    received: formatSGD(paidCents(inv) || inv.total_cents),
    paid_on: lastDate ? ` on ${formatJobDate(lastDate)}` : "",
    balance_line: balance > 0
      ? `. The balance of ${formatSGD(balance)} is due on delivery.`
      : ", so nothing further is due.",
    balance_short: balance > 0 ? ` Balance of ${formatSGD(balance)} due on delivery.` : "",
  };
}

export function receiptEmailMessage(inv: Invoice, biz: Business): string {
  return tidyMessage(renderTemplate(RECEIPT_EMAIL_TEMPLATE, receiptVars(inv, biz)));
}

export function receiptWhatsappMessage(inv: Invoice, biz: Business): string {
  return tidyMessage(renderTemplate(RECEIPT_WHATSAPP_TEMPLATE, receiptVars(inv, biz)));
}

export function receiptSubject(inv: Invoice, biz: Business): string {
  return renderTemplate("Receipt for {job}", templateVars(inv, biz)).replace(/\s+/g, " ").trim();
}

// ── Quotes ─────────────────────────────────────────────────────────────

export const QUOTE_EMAIL_TEMPLATE = [
  "Hello {first_name},",
  "",
  "Thanks for reaching out! Attached is the quote for {job}.",
  "",
  "The total comes to {total}{quote_deposit}.{valid_line}",
  "",
  "To go ahead, simply reply to this email and I'll send over the invoice to confirm your booking.",
  "",
  "Best,",
  "{payee_name}",
].join("\n");

export const QUOTE_WHATSAPP_TEMPLATE =
  "Hi {first_name}! Here's quote {invoice_number} for {job}: total {total}{quote_deposit}.{valid_line} " +
  "Just reply here to go ahead and I'll send the invoice. Thank you!";

function quoteMessage(template: string, inv: Invoice, biz: Business): string {
  const deposit = depositCents(inv);
  const vars = {
    ...templateVars(inv, biz),
    quote_deposit: isFullUpfront(inv)
      ? ", payable in full before the shoot to lock in your date"
      : deposit > 0
        ? `, with a ${inv.deposit_percent}% deposit (${formatSGD(deposit)}) to lock in your date`
        : "",
    valid_line: inv.due_date ? ` This quote is valid until ${formatJobDate(inv.due_date)}.` : "",
  };
  return insertNotes(tidyMessage(renderTemplate(template, vars)), [rentalNote(inv)]);
}
