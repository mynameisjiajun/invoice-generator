// Branded HTML for invoice/receipt emails (Apex Cinematics).
//
// Email HTML is its own dialect: table layout, inline styles, no web fonts,
// no CSS variables, and images by absolute URL (Gmail strips data: URIs). The
// plain-text body still goes out alongside this as the text/plain part, so
// clients that block HTML or images lose nothing.
//
// Colours match the PDF's APEX palette. Small text never uses the brand
// orange on light backgrounds (only ~2.9:1); orange is for the rules/accents.

import { formatSGD } from "./money";
import { formatJobDate } from "./printRates";
import { formatSgPhone } from "./phone";
import { isQuote, type Business, type Invoice } from "./types";
import { balanceCents, depositOutstanding, dueNowCents, isFullUpfront, paidCents } from "./payments";
import { SITE } from "@/components/portfolio/seo";

const INK = "#191919";
const ORANGE = "#F65F0D";
const PAPER = "#F4F4F4";
const MID = "#5A5A5A";
const FOOT_TEXT = "#9A9A9A";
const FONT = "Arial, Helvetica, sans-serif";

export const EMAIL_LOGO_URL = `${SITE}/email/apex-logo.png`;

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** The message as paragraphs: blank lines split paragraphs, single newlines
 *  become <br>, everything escaped. */
function paragraphs(text: string): string {
  return text
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .map((p) => `<p style="margin:0 0 16px;">${esc(p).replace(/\r?\n/g, "<br>")}</p>`)
    .join("");
}

export function invoiceEmailHtml({ body, invoice, business, variant, logoUrl = EMAIL_LOGO_URL }: {
  body: string;
  invoice: Invoice;
  business: Business;
  variant: "invoice" | "receipt";
  logoUrl?: string;
}): string {
  const isReceipt = variant === "receipt";
  const quote = isQuote(invoice);
  const number = invoice.invoice_number ?? "Draft";
  const docWord = isReceipt ? "Receipt" : quote ? "Quote" : "Invoice";
  const paid = paidCents(invoice);
  const balance = balanceCents(invoice);
  // The card shows what matters now: the quote total, the deposit or balance
  // due, or what was received.
  let amountLabel = "Amount due";
  let amount = invoice.total_cents;
  let meta = invoice.due_date ? `Due ${formatJobDate(invoice.due_date)}` : "";
  if (quote) {
    amountLabel = "Total";
    meta = invoice.due_date ? `Valid until ${formatJobDate(invoice.due_date)}` : "";
  } else if (isReceipt) {
    amountLabel = balance > 0 ? "Received" : "Paid in full";
    amount = paid || invoice.total_cents;
    meta = balance > 0
      ? `Balance ${formatSGD(balance)} due on delivery`
      : invoice.paid_date ? `Received ${formatJobDate(invoice.paid_date)}` : "Payment received";
  } else if (isFullUpfront(invoice) && paid === 0) {
    meta = "Due before the shoot";
  } else if (depositOutstanding(invoice)) {
    amountLabel = "Deposit due now";
    amount = dueNowCents(invoice);
    meta = `Balance ${formatSGD(invoice.total_cents - paid - amount)} on delivery`;
  } else if (paid > 0 && balance > 0) {
    amountLabel = "Balance due";
    amount = balance;
    meta = `${formatSGD(paid)} received`;
  }
  const metaLine = [esc(meta), "PDF attached"].filter(Boolean).join(" &nbsp;·&nbsp; ");
  const site = SITE.replace(/^https?:\/\//, "");
  const contact = [
    business.phone ? esc(formatSgPhone(business.phone)) : "",
    business.email
      ? `<a href="mailto:${esc(business.email)}" style="color:${FOOT_TEXT};text-decoration:none;">${esc(business.email)}</a>`
      : "",
    `<a href="${SITE}" style="color:${ORANGE};text-decoration:none;">${site}</a>`,
  ].filter(Boolean).join(" &nbsp;·&nbsp; ");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(`${docWord} ${number}`)}</title>
</head>
<body style="margin:0;padding:0;background:#ECECEC;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ECECEC" style="background:#ECECEC;">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

    <tr><td bgcolor="${INK}" style="background:${INK};padding:28px 32px 24px;">
      <a href="${SITE}" style="text-decoration:none;">
        <img src="${esc(logoUrl)}" width="200" alt="APEX CINEMATICS"
          style="display:block;width:200px;max-width:100%;height:auto;border:0;color:#F4F4F4;font:bold 20px ${FONT};letter-spacing:2px;">
      </a>
    </td></tr>
    <tr><td bgcolor="${ORANGE}" height="4" style="background:${ORANGE};height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>

    <tr><td bgcolor="#FFFFFF" style="background:#FFFFFF;padding:32px 32px 28px;font-family:${FONT};font-size:15px;line-height:1.6;color:${INK};">
      ${paragraphs(body)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAPER}"
        style="background:${PAPER};border-left:4px solid ${ORANGE};margin-top:8px;">
        <tr><td style="padding:16px 20px;font-family:${FONT};">
          <div style="font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:${MID};">
            ${docWord} ${esc(number)} &nbsp;·&nbsp; ${esc(amountLabel)}
          </div>
          <div style="font-size:26px;font-weight:bold;color:${INK};margin-top:4px;">${esc(formatSGD(amount))}</div>
          <div style="font-size:13px;color:${MID};margin-top:2px;">${metaLine}</div>
        </td></tr>
      </table>
    </td></tr>

    <tr><td bgcolor="${INK}" style="background:${INK};padding:22px 32px 24px;font-family:${FONT};font-size:12px;line-height:1.7;color:${FOOT_TEXT};">
      <div style="font-size:12px;font-weight:bold;letter-spacing:3px;color:#F4F4F4;">${esc(business.name.toUpperCase())}</div>
      <div>${contact}</div>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`;
}
