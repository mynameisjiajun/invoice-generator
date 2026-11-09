import { describe, expect, it } from "vitest";
import {
  renderTemplate, templateVars, emailMessage, emailSubject, tidyMessage,
  DEFAULT_EMAIL_TEMPLATE, RENTAL_MESSAGE_NOTE, RENTAL_MESSAGE_NOTE_SEPARATE, whatsappMessage,
} from "./templates";
import type { Business, Invoice } from "./types";

const inv = {
  id: "i1", business_id: "b1", invoice_number: "JJ-0042", status: "unpaid",
  issue_date: "2026-05-30", due_date: "2026-06-29", customer_id: 1, job_event: "OMM shoot Cam Assistant",
  job_date: "May 27–29", job_location: "", line_items: [], discount_type: "none",
  discount_value: 0, subtotal_cents: 45000, total_cents: 45000, paid_date: null,
  sent_at: null,
  customers: { id: 1, business_id: "b1", name: "Jane Tan", company: "", phone: "", email: "jane@x.com", uen: "", address: "" },
} as Invoice;

const biz = {
  id: "b1", name: "JJ Media", slug: "jj", address: "", phone: "", email: "",
  paynow_number: "91234567", payee_name: "Chua Jia Jun", bank_details: "",
  payment_terms: "", invoice_prefix: "JJ", next_invoice_seq: 43, archived_at: null,
  email_template: "", whatsapp_template: "",
} as Business;

describe("renderTemplate", () => {
  it("substitutes known placeholders", () => {
    expect(renderTemplate("Hi {first_name}, total {total}", { first_name: "Jane", total: "$450.00" }))
      .toBe("Hi Jane, total $450.00");
  });
  it("leaves unknown placeholders intact so typos are visible", () => {
    expect(renderTemplate("Hi {nope}", {})).toBe("Hi {nope}");
  });
});

describe("templateVars", () => {
  it("derives vars from invoice + business", () => {
    const v = templateVars(inv, biz);
    expect(v.first_name).toBe("Jane");
    expect(v.job).toBe("OMM shoot Cam Assistant");
    expect(v.job_date).toBe("May 27–29");
    expect(v.invoice_number).toBe("JJ-0042");
    expect(v.total).toBe("$450.00");
    expect(v.paynow).toBe("91234567");
    expect(v.payee_name).toBe("Chua Jia Jun");
  });
  it("labels a UEN PayNow destination", () => {
    expect(templateVars(inv, { ...biz, paynow_number: "53533808b" }).paynow).toBe("UEN 53533808B");
  });
  it("falls back when customer/number missing", () => {
    const bare = { ...inv, invoice_number: null, customers: null } as Invoice;
    const v = templateVars(bare, biz);
    expect(v.first_name).toBe("there");
    expect(v.invoice_number).toBe("");
  });
});

describe("tidyMessage", () => {
  it("drops a preposition left dangling by a blank placeholder", () => {
    expect(tidyMessage("Thank you for having me at the shoot on  — I enjoyed it."))
      .toBe("Thank you for having me at the shoot — I enjoyed it.");
    expect(tidyMessage("Invoice for the shoot on ")).toBe("Invoice for the shoot");
  });
  it("leaves a real date alone", () => {
    expect(tidyMessage("at the shoot on May 27–29 — thanks."))
      .toBe("at the shoot on May 27–29 — thanks.");
  });
  it("collapses double spaces and space before punctuation", () => {
    expect(tidyMessage("total  $450.00 .")).toBe("total $450.00.");
  });
  it("preserves blank lines, so paragraphs survive", () => {
    expect(tidyMessage("Hi Jane,\n\nThanks.")).toBe("Hi Jane,\n\nThanks.");
  });
});

describe("emailMessage", () => {
  it("uses the default template when business template is empty", () => {
    expect(emailMessage(inv, biz)).toBe(
      [
        "Hello Jane,",
        "",
        "Attached is the invoice for OMM shoot Cam Assistant on May 27–29! It was a pleasure working on this with you.",
        "",
        "The total comes up to $450.00 — payable via PayNow using the QR code in the PDF, or directly to 91234567.",
        "",
        "Do let me know if you have any questions!",
        "",
        "Best,",
        "Chua Jia Jun",
      ].join("\n")
    );
  });
  it("greets by first name", () => {
    expect(emailMessage(inv, biz).startsWith("Hello Jane,")).toBe(true);
  });
  it("falls back to 'there' when the customer has no name", () => {
    const anon = { ...inv, customers: null } as Invoice;
    expect(emailMessage(anon, biz).startsWith("Hello there,")).toBe(true);
  });
  it("reads cleanly when the job date is blank", () => {
    const undated = { ...inv, job_date: "" } as Invoice;
    expect(emailMessage(undated, biz)).toContain(
      "Attached is the invoice for OMM shoot Cam Assistant! It was a pleasure working on this with you."
    );
  });
  it("uses the stored template when set", () => {
    const custom = { ...biz, email_template: "Yo {first_name}" } as Business;
    expect(emailMessage(inv, custom)).toBe("Yo Jane");
  });
  it("the default template only uses placeholders templateVars supplies", () => {
    const known = new Set(Object.keys(templateVars(inv, biz)));
    const used = [...DEFAULT_EMAIL_TEMPLATE.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    expect(used.filter((k) => !known.has(k))).toEqual([]);
  });
});

describe("emailSubject", () => {
  it("names the job — project + role, matching how invoices are titled by hand", () => {
    expect(emailSubject(inv, biz)).toBe("Invoice for OMM shoot Cam Assistant");
  });
  it("falls back to a generic job name when job_event is blank", () => {
    const bare = { ...inv, job_event: "" } as Invoice;
    expect(emailSubject(bare, biz)).toBe("Invoice for the shoot");
  });
});

describe("rental invoices", () => {
  const rentalBiz = { ...(biz as object), kind: "photo" } as Business;
  const rental = {
    ...(inv as object),
    job_event: "",
    is_rental: true,
    rental_start: "2026-11-14T10:00",
    rental_end: "2026-11-17T10:00",
  } as Invoice;

  it("names the rental and its dates when there's no project name", () => {
    const v = templateVars(rental, rentalBiz);
    expect(v.job).toBe("your equipment rental");
    expect(v.job_date).toBe("14 Nov 2026 to 17 Nov 2026");
  });

  it("appends the T&C note to email and WhatsApp, only for rentals", () => {
    expect(emailMessage(rental, rentalBiz)).toContain(RENTAL_MESSAGE_NOTE);
    expect(whatsappMessage(rental, rentalBiz)).toContain(RENTAL_MESSAGE_NOTE);
    expect(emailMessage({ ...rental, is_rental: false } as Invoice, rentalBiz)).not.toContain(RENTAL_MESSAGE_NOTE);
  });

  it("says the T&C were sent separately when they're not attached", () => {
    const separate = { ...rental, rental_terms: false } as Invoice;
    expect(emailMessage(separate, rentalBiz)).toContain(RENTAL_MESSAGE_NOTE_SEPARATE);
    expect(emailMessage(separate, rentalBiz)).not.toContain(RENTAL_MESSAGE_NOTE);
    expect(whatsappMessage(separate, rentalBiz)).toContain(RENTAL_MESSAGE_NOTE_SEPARATE);
  });
});

describe("rental note placement", () => {
  it("goes above the sign-off, not after the signature", () => {
    const rentalBiz = { ...(biz as object), kind: "photo", email_template: "" } as Business;
    const rental = { ...(inv as object), is_rental: true, rental_start: "2026-11-14T10:00", rental_end: "2026-11-17T10:00" } as Invoice;
    const msg = emailMessage(rental, rentalBiz);
    expect(msg.indexOf(RENTAL_MESSAGE_NOTE)).toBeLessThan(msg.lastIndexOf("Best,"));
    expect(msg.trim().endsWith(templateVars(rental, rentalBiz).payee_name)).toBe(true);
  });
});

describe("rental wording", () => {
  const rb = { ...(biz as object), kind: "photo", email_template: "Custom {job}", whatsapp_template: "" } as Business;
  const r = { ...(inv as object), job_event: "", is_rental: true, rental_start: "2026-11-14T10:00", rental_end: "2026-11-17T10:00" } as Invoice;

  it("uses rental wording, with pay-before-collection, even over a custom template", () => {
    const msg = emailMessage(r, rb);
    expect(msg).toContain("Thanks for renting with");
    expect(msg).toContain("your equipment rental (14 Nov 2026 to 17 Nov 2026)");
    expect(msg).toContain("before collection to confirm your booking");
    expect(msg).not.toContain("pleasure working on this");
    expect(msg).not.toContain("Custom");
    expect(whatsappMessage(r, rb)).toContain("rental invoice");
  });

  it("drops the empty brackets when the period isn't set", () => {
    const msg = emailMessage({ ...r, rental_start: "", rental_end: "" } as Invoice, rb);
    expect(msg).toContain("for your equipment rental.");
    expect(msg).not.toContain("()");
  });

  it("leaves non-rental invoices on the business's own template", () => {
    expect(emailMessage({ ...r, is_rental: false } as Invoice, rb)).toBe("Custom your equipment rental".replace("your equipment rental", "the shoot"));
  });
});

import { receiptEmailMessage, receiptSubject, receiptWhatsappMessage } from "./templates";

describe("receipts", () => {
  const paid = { ...(inv as object), status: "paid", paid_date: "2026-11-09", invoice_number: "A-31", job_event: "Brand film", total_cents: 72100 } as Invoice;
  it("thanks the client and says nothing is due, without invoice payment wording", () => {
    const msg = receiptEmailMessage(paid, biz);
    expect(msg).toContain("Thank you for your payment!");
    expect(msg).toContain("We've received $721.00 for invoice A-31 on 9 Nov 2026");
    expect(msg).not.toContain("PayNow");
    expect(receiptSubject(paid, biz)).toBe("Receipt for Brand film");
    expect(receiptWhatsappMessage(paid, biz)).toContain("Thank you for your payment of $721.00");
  });
  it("reads cleanly without a paid date", () => {
    expect(receiptEmailMessage({ ...paid, paid_date: null } as Invoice, biz)).toContain("for invoice A-31, so nothing");
  });
});

import { depositMessageNote } from "./templates";

describe("quotes and deposits in messages", () => {
  const base = { ...(inv as object), job_event: "Brand film", total_cents: 100000, invoice_number: "A-40", status: "unpaid", payments: [] } as unknown as Invoice;

  it("quote email: total, deposit, validity, how to accept", () => {
    const q = { ...base, doc_type: "quote", invoice_number: "Q-3", due_date: "2026-11-23", deposit_percent: 50 } as Invoice;
    const msg = emailMessage(q, biz);
    expect(msg).toContain("Attached is the quote for Brand film.");
    expect(msg).toContain("The total comes to $1,000.00, with a 50% deposit ($500.00) to lock in your date.");
    expect(msg).toContain("valid until 23 Nov 2026");
    expect(msg).toContain("simply reply to this email");
    expect(emailSubject(q, biz)).toBe("Quote for Brand film");
    expect(whatsappMessage(q, biz)).toContain("Here's quote Q-3 for Brand film");
  });

  it("deposit invoice asks for the deposit now, above the sign-off", () => {
    const d = { ...base, deposit_percent: 50, email_template: "" } as Invoice;
    const note = depositMessageNote(d)!;
    expect(note).toBe("To lock in your date, a 50% deposit of $500.00 is due now; the balance of $500.00 is due on delivery.");
    const msg = emailMessage(d, { ...biz, email_template: "" } as Business);
    expect(msg.indexOf(note)).toBeGreaterThan(0);
    expect(msg.indexOf(note)).toBeLessThan(msg.lastIndexOf("Best,"));
  });

  it("after the deposit, asks for the balance; a deposit receipt says what's left", () => {
    const p = { id: "1", invoice_id: "x", business_id: "b", amount_cents: 50000, paid_on: "2026-11-10", note: "Deposit", created_at: "" };
    const d = { ...base, deposit_percent: 50, payments: [p] } as Invoice;
    expect(depositMessageNote(d)).toBe("We've received $500.00 so far, thank you! The balance of $500.00 is due on delivery.");
    const r = receiptEmailMessage(d, biz);
    expect(r).toContain("We've received $500.00 for invoice A-40 on 10 Nov 2026. The balance of $500.00 is due on delivery.");
    expect(r).not.toContain("nothing further is due");
  });

  it("no deposit note without a deposit", () => {
    expect(depositMessageNote({ ...base, deposit_percent: 0 } as Invoice)).toBeNull();
  });
});

describe("full payment before the shoot", () => {
  const full = { ...(inv as object), job_event: "Corporate event", total_cents: 80000, invoice_number: "A-41", status: "unpaid", payments: [], deposit_percent: 100 } as unknown as Invoice;
  it("asks for full payment before the shoot, never says deposit", () => {
    expect(depositMessageNote(full)).toBe("Full payment of $800.00 is due before the shoot to confirm your booking.");
    const q = emailMessage({ ...full, doc_type: "quote", invoice_number: "Q-9", due_date: null } as Invoice, biz);
    expect(q).toContain("payable in full before the shoot");
    expect(q).not.toContain("deposit");
  });
});

import { CONTRACT_MESSAGE_NOTE, CONTRACT_QUOTE_NOTE } from "./templates";
import { presetContract } from "./shootTerms";

describe("shoot contract in messages", () => {
  const c = { ...(inv as object), job_event: "Wedding", total_cents: 300000, invoice_number: "A-50", status: "unpaid", payments: [], deposit_percent: 50, contract: presetContract("standard") } as unknown as Invoice;
  it("invoice asks for the signed agreement; quote just points to it", () => {
    const msg = emailMessage(c, { ...biz, email_template: "" } as Business);
    expect(msg).toContain(CONTRACT_MESSAGE_NOTE);
    expect(msg.indexOf(CONTRACT_MESSAGE_NOTE)).toBeLessThan(msg.lastIndexOf("Best,"));
    expect(emailMessage({ ...c, doc_type: "quote", invoice_number: "Q-2", due_date: null } as Invoice, biz)).toContain(CONTRACT_QUOTE_NOTE);
    expect(emailMessage({ ...c, contract: null } as Invoice, biz)).not.toContain("Shoot Agreement");
  });
});
