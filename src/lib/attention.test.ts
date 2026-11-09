import { describe, expect, it } from "vitest";
import { attentionItems } from "./attention";
import type { Invoice } from "./types";

const TODAY = "2026-11-09";
const base = (over: Partial<Invoice>): Invoice => ({
  id: over.invoice_number ?? "x", business_id: "b", invoice_number: "A-1", status: "unpaid",
  issue_date: "2026-11-01", due_date: "2026-12-01", customer_id: 1,
  job_event: "Brand film", job_date: "", job_location: "", line_items: [],
  discount_type: "none", discount_value: 0, subtotal_cents: 100000, total_cents: 100000,
  paid_date: null, sent_at: null, payments: [], customers: { name: "Jordan" } as Invoice["customers"],
  ...over,
});

describe("attentionItems", () => {
  it("is empty when nothing needs chasing", () => {
    expect(attentionItems([base({}), base({ invoice_number: "A-2", status: "paid" })], [], TODAY)).toEqual([]);
  });

  it("flags overdue invoices first", () => {
    const items = attentionItems([
      base({ invoice_number: "A-3", deposit_percent: 50 }),
      base({ invoice_number: "A-4", due_date: "2026-11-01" }),
    ], [], TODAY);
    expect(items[0].title).toBe("A-4 overdue · $1,000.00");
    expect(items[0].tone).toBe("warn");
    expect(items[1].title).toBe("A-3 deposit to collect · $500.00");
  });

  it("asks for full payment before the shoot, then the balance after a deposit", () => {
    const pay = { id: "p", invoice_id: "x", business_id: "b", amount_cents: 50000, paid_on: TODAY, note: "Deposit", created_at: "" };
    const items = attentionItems([
      base({ invoice_number: "A-5", deposit_percent: 100 }),
      base({ invoice_number: "A-6", deposit_percent: 50, payments: [pay] }),
    ], [], TODAY);
    expect(items.map((i) => i.title)).toEqual([
      "A-5 payment before the shoot · $1,000.00",
      "A-6 balance on delivery · $500.00",
    ]);
  });

  it("flags unsigned rentals, even when paid", () => {
    const items = attentionItems([base({ invoice_number: "A-7", status: "paid", is_rental: true })], [], TODAY);
    expect(items[0].title).toBe("A-7 rental T&C not signed");
  });

  it("nudges quotes about to expire or recently expired, not accepted or old ones", () => {
    const q = (n: string, due: string, over: Partial<Invoice> = {}) =>
      base({ invoice_number: n, doc_type: "quote", due_date: due, ...over });
    const items = attentionItems([], [
      q("Q-1", "2026-11-11"),
      q("Q-2", "2026-11-05"),
      q("Q-3", "2026-10-01"),
      q("Q-4", "2026-11-05", { converted_invoice_id: "inv" }),
      q("Q-5", "2026-12-30"),
    ], TODAY);
    expect(items.map((i) => i.title)).toEqual(["Q-2 expired 5 Nov 2026. Follow up?", "Q-1 expires 11 Nov 2026"]);
  });

  it("ignores drafts", () => {
    expect(attentionItems([base({ status: "draft", due_date: "2026-01-01" })], [], TODAY)).toEqual([]);
  });
});
