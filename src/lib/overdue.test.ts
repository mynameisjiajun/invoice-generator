import { describe, expect, it } from "vitest";
import { isOverdue, type Invoice } from "./types";

const base = { status: "unpaid", issue_date: "2026-01-01", due_date: null } as Invoice;

describe("isOverdue", () => {
  it("uses due_date when set", () => {
    const inv = { ...base, due_date: "2026-07-01" } as Invoice;
    expect(isOverdue(inv, new Date("2026-07-02"))).toBe(true);
    expect(isOverdue(inv, new Date("2026-06-30"))).toBe(false);
  });
  it("falls back to issue_date + 30 when due_date is null", () => {
    expect(isOverdue(base, new Date("2026-02-05"))).toBe(true);
    expect(isOverdue(base, new Date("2026-01-15"))).toBe(false);
  });
  it("only unpaid invoices can be overdue", () => {
    expect(isOverdue({ ...base, status: "paid" } as Invoice, new Date("2027-01-01"))).toBe(false);
  });
});
