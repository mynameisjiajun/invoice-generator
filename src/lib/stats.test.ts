import { describe, expect, test } from "vitest";
import { clientStats, monthlyStats, yearlyStats } from "./stats";
import type { Invoice } from "./types";

const BIZ = "biz-1";

function inv(over: Partial<Invoice>): Invoice {
  return {
    id: "x", business_id: BIZ, invoice_number: "A-1", status: "unpaid", issue_date: "2026-06-23",
    due_date: null,
    customer_id: 1, job_event: "", job_date: "", job_location: "",
    line_items: [], discount_type: "none", discount_value: 0,
    subtotal_cents: 0, total_cents: 50000, paid_date: null, sent_at: null,
    customers: { id: 1, business_id: BIZ, name: "Jordan", company: "", phone: "", email: "", uen: "", address: "" },
    ...over,
  };
}

const data = [
  inv({ status: "paid", total_cents: 50000 }),                       // 2026-06, paid
  inv({ status: "unpaid", total_cents: 30000, issue_date: "2026-01-10" }),
  inv({ status: "paid", total_cents: 20000, issue_date: "2025-12-01",
        customers: { id: 2, business_id: BIZ, name: "Acme", company: "", phone: "", email: "", uen: "", address: "" } }),
  inv({ status: "draft", total_cents: 99900 }),                      // excluded everywhere
];

describe("stats", () => {
  test("yearlyStats groups by year, excludes drafts", () => {
    expect(yearlyStats(data)).toEqual([
      { year: 2026, invoicedCents: 80000, collectedCents: 50000 },
      { year: 2025, invoicedCents: 20000, collectedCents: 20000 },
    ]);
  });

  test("monthlyStats returns 12 months for a year", () => {
    const m = monthlyStats(data, 2026);
    expect(m).toHaveLength(12);
    expect(m[0]).toEqual({ month: 1, invoicedCents: 30000, collectedCents: 0 });
    expect(m[5]).toEqual({ month: 6, invoicedCents: 50000, collectedCents: 50000 });
  });

  test("clientStats sorts by total desc, excludes drafts", () => {
    expect(clientStats(data)).toEqual([
      { name: "Jordan", invoicedCents: 80000 },
      { name: "Acme", invoicedCents: 20000 },
    ]);
  });
});
