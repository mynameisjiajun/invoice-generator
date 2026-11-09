import { describe, expect, it } from "vitest";
import { incomeTax, medisaveEstimate, yearCsv, yearSummary } from "./tax";
import type { Expense, Invoice } from "./types";

describe("MediSave estimate", () => {
  it("is nothing up to $6,000", () => expect(medisaveEstimate(6000, "under35")).toBe(0));
  it("uses the top rate above $18,000", () => expect(medisaveEstimate(50_000, "under35")).toBe(4000));
  it("is capped at rate x $96,000 (CPF's 2026 caps)", () => {
    expect(medisaveEstimate(200_000, "under35")).toBe(7680);
    expect(medisaveEstimate(200_000, "35to44")).toBe(8640);
    expect(medisaveEstimate(200_000, "45to49")).toBe(9600);
    expect(medisaveEstimate(200_000, "50plus")).toBe(10080);
  });
  it("phases in between $6,000 and $18,000", () => {
    expect(medisaveEstimate(10_000, "under35")).toBe(400);
    expect(medisaveEstimate(15_000, "under35")).toBe(900);
    expect(medisaveEstimate(18_000, "under35")).toBe(1440);
  });
});

describe("income tax", () => {
  it("follows resident rates", () => {
    expect(incomeTax(20_000)).toBe(0);
    expect(incomeTax(30_000)).toBe(200);
    expect(incomeTax(40_000)).toBe(550);
    expect(incomeTax(80_000)).toBe(3350);
  });
});

describe("year summary", () => {
  const inv = (o: Partial<Invoice>) => ({ status: "paid", issue_date: "2026-03-01", total_cents: 0, payments: [], ...o }) as Invoice;
  const exp = (o: Partial<Expense>) => ({ spent_on: "2026-04-01", category: "other", amount_cents: 0, note: "", ...o }) as Expense;
  const invoices = [
    inv({ total_cents: 4_000_000, invoice_number: "A-1", customers: { name: "Jordan" } as Invoice["customers"] }),
    inv({ total_cents: 1_000_000, status: "unpaid" }),
    inv({ total_cents: 999_900, doc_type: "quote" }),
    inv({ total_cents: 500_000, issue_date: "2025-12-01" }),
  ];
  const expenses = [exp({ amount_cents: 300_000, category: "software", note: "Adobe, \"CC\"" }), exp({ amount_cents: 700_000, category: "gear" })];
  const s = yearSummary(invoices, expenses, 2026, "under35");

  it("adds up revenue, expenses, profit and the set-aside", () => {
    expect(s.revenueCents).toBe(5_000_000);
    expect(s.collectedCents).toBe(4_000_000);
    expect(s.expensesCents).toBe(300_000);
    expect(s.gearCents).toBe(700_000);
    expect(s.profitCents).toBe(4_700_000);
    expect(s.ntiCents).toBe(4_000_000);
    expect(s.medisaveCents).toBe(320_000);           // 8% of $40,000
    expect(s.taxCents).toBe(incomeTax(40_000 - 3_200 - 1_000) * 100);
    expect(s.setAsideCents).toBe(s.medisaveCents + s.taxCents);
  });

  it("exports the 4 lines and every item as CSV", () => {
    const csv = yearCsv(s, invoices, expenses);
    expect(csv).toContain("Revenue,50000.00");
    expect(csv).toContain("Adjusted profit,47000.00");
    expect(csv).toContain('Expense,2026-04-01,software,"Adobe, ""CC""",-3000.00,');
    expect(csv).toContain('Invoice,2026-03-01,"A-1","Jordan",40000.00,40000.00');
  });
});
