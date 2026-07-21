import { describe, expect, it } from "vitest";
import { renderTemplate, templateVars, emailMessage, DEFAULT_EMAIL_TEMPLATE } from "./templates";
import type { Business, Invoice } from "./types";

const inv = {
  id: "i1", business_id: "b1", invoice_number: "JJ-0042", status: "unpaid",
  issue_date: "2026-05-30", customer_id: 1, job_event: "OMM shoot Cam Assistant",
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

describe("emailMessage", () => {
  it("uses the default template when business template is empty", () => {
    expect(emailMessage(inv, biz)).toBe(
      "Hello!\nAttached is the invoice for OMM shoot Cam Assistant for May 27–29! Do let me know if you have any questions!\n\n--\nRegards,\nChua Jia Jun"
    );
  });
  it("uses the stored template when set", () => {
    const custom = { ...biz, email_template: "Yo {first_name}" } as Business;
    expect(emailMessage(inv, custom)).toBe("Yo Jane");
  });
});
