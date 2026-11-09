import { describe, expect, it } from "vitest";
import { depositCents, dueNowCents, paidCents, paymentState } from "./payments";
import type { Invoice, Payment } from "./types";

const pay = (amount_cents: number, note = ""): Payment => ({
  id: String(amount_cents) + note, invoice_id: "i", business_id: "b",
  amount_cents, paid_on: "2026-11-09", note, created_at: "",
});
const inv = (over: Partial<Invoice> = {}): Invoice => ({
  id: "i", business_id: "b", invoice_number: "A-1", status: "unpaid",
  issue_date: "2026-11-01", due_date: null, customer_id: 1,
  job_event: "", job_date: "", job_location: "", line_items: [],
  discount_type: "none", discount_value: 0, subtotal_cents: 100000, total_cents: 100000,
  paid_date: null, sent_at: null, deposit_percent: 50, payments: [], ...over,
});

describe("payments", () => {
  it("asks for the deposit first", () => {
    const i = inv();
    expect(depositCents(i)).toBe(50000);
    expect(dueNowCents(i)).toBe(50000);
    expect(paymentState(i)).toBe("unpaid");
  });

  it("asks for the balance once the deposit is in", () => {
    const i = inv({ payments: [pay(50000, "Deposit")] });
    expect(paidCents(i)).toBe(50000);
    expect(paymentState(i)).toBe("deposit-paid");
    expect(dueNowCents(i)).toBe(50000);
  });

  it("asks for the rest of the deposit after a short payment", () => {
    const i = inv({ payments: [pay(30000)] });
    expect(paymentState(i)).toBe("part-paid");
    expect(dueNowCents(i)).toBe(20000);
  });

  it("treats an invoice marked paid without payment rows as fully paid", () => {
    const i = inv({ status: "paid" });
    expect(paidCents(i)).toBe(100000);
    expect(dueNowCents(i)).toBe(0);
    expect(paymentState(i)).toBe("paid");
  });

  it("handles overpayment", () => {
    const i = inv({ payments: [pay(120000)] });
    expect(paymentState(i)).toBe("paid");
    expect(dueNowCents(i)).toBe(0);
  });

  it("without a deposit, the whole remaining amount is due", () => {
    const i = inv({ deposit_percent: 0, payments: [pay(25000)] });
    expect(depositCents(i)).toBe(0);
    expect(dueNowCents(i)).toBe(75000);
    expect(paymentState(i)).toBe("part-paid");
  });

  it("never asks rentals for a deposit", () => {
    const i = inv({ is_rental: true });
    expect(depositCents(i)).toBe(0);
    expect(dueNowCents(i)).toBe(100000);
  });

  it("rounds an odd deposit to the cent", () => {
    expect(depositCents(inv({ total_cents: 33333, deposit_percent: 30 }))).toBe(10000);
  });
});

import { isFullUpfront } from "./payments";

describe("full payment before the shoot", () => {
  it("is one upfront payment of the whole total", () => {
    const i = inv({ deposit_percent: 100 });
    expect(isFullUpfront(i)).toBe(true);
    expect(dueNowCents(i)).toBe(100000);
    expect(paymentState(inv({ deposit_percent: 100, payments: [pay(100000)] }))).toBe("paid");
  });
  it("never applies to rentals", () => {
    expect(isFullUpfront(inv({ deposit_percent: 100, is_rental: true }))).toBe(false);
  });
});
