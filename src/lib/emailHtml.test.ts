import { describe, expect, it } from "vitest";
import { invoiceEmailHtml, EMAIL_LOGO_URL } from "./emailHtml";
import type { Business, Invoice } from "./types";

const business = {
  name: "Apex Cinematics", phone: "+6589055027", email: "contact@apexcinematics.tech",
} as Business;
const invoice = {
  invoice_number: "A-31", total_cents: 72100, due_date: "2026-12-09", paid_date: null,
} as Invoice;

describe("invoiceEmailHtml", () => {
  const html = invoiceEmailHtml({
    body: "Hello Jordan,\n\nTotal is $721.00 <b>now</b> & then.\nThanks\n\nBest,\nJJ",
    invoice, business, variant: "invoice",
  });

  it("frames the message with the logo and footer", () => {
    expect(html).toContain(EMAIL_LOGO_URL);
    expect(html).toContain('alt="APEX CINEMATICS"');
    expect(html).toContain("APEX CINEMATICS</div>");
    expect(html).toContain("contact@apexcinematics.tech");
  });

  it("escapes the message and keeps its paragraphs and line breaks", () => {
    expect(html).toContain("&lt;b&gt;now&lt;/b&gt; &amp; then.<br>Thanks");
    expect(html).not.toContain("<b>now</b>");
    expect(html.match(/<p style/g)).toHaveLength(3);
  });

  it("summarises the invoice", () => {
    expect(html).toContain("Invoice A-31");
    expect(html).toContain("Amount due");
    expect(html).toContain("$721.00");
    expect(html).toContain("Due 9 Dec 2026");
  });

  it("reads as paid on a receipt", () => {
    const r = invoiceEmailHtml({ body: "Thanks!", invoice: { ...invoice, status: "paid", paid_date: "2026-12-01" } as Invoice, business, variant: "receipt" });
    expect(r).toContain("Receipt A-31");
    expect(r).toContain("Paid in full");
    expect(r).toContain("Received 1 Dec 2026");
  });
});

describe("quote and deposit cards", () => {
  it("shows a quote's total and validity", () => {
    const q = invoiceEmailHtml({ body: "Hi", invoice: { ...invoice, doc_type: "quote", invoice_number: "Q-3", due_date: "2026-11-23" } as Invoice, business, variant: "invoice" });
    expect(q).toContain("Quote Q-3");
    expect(q).toContain("Valid until 23 Nov 2026");
  });
  it("shows the deposit due now on a deposit invoice", () => {
    const d = invoiceEmailHtml({ body: "Hi", invoice: { ...invoice, total_cents: 100000, deposit_percent: 50, payments: [] } as Invoice, business, variant: "invoice" });
    expect(d).toContain("Deposit due now");
    expect(d).toContain("$500.00");
    expect(d).toContain("Balance $500.00 on delivery");
  });
  it("a deposit receipt shows what was received and the balance", () => {
    const pay = { id: "1", invoice_id: "x", business_id: "b", amount_cents: 50000, paid_on: "2026-11-10", note: "Deposit", created_at: "" };
    const r = invoiceEmailHtml({ body: "Hi", invoice: { ...invoice, total_cents: 100000, deposit_percent: 50, payments: [pay] } as Invoice, business, variant: "receipt" });
    expect(r).toContain("Received");
    expect(r).toContain("Balance $500.00 due on delivery");
  });
});
