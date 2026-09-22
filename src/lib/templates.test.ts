import { describe, expect, it } from "vitest";
import {
  renderTemplate, templateVars, emailMessage, emailSubject, tidyMessage,
  DEFAULT_EMAIL_TEMPLATE,
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
