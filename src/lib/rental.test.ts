import { describe, expect, it } from "vitest";
import { daysLabel, formatRentalDateTime, rentalDays } from "./rental";
import { lineTotalCents, subtotalCents } from "./money";

describe("rentalDays", () => {
  it("counts each started 24h as a day", () => {
    expect(rentalDays("2026-11-14T10:00", "2026-11-15T10:00")).toBe(1);
    expect(rentalDays("2026-11-14T10:00", "2026-11-15T10:01")).toBe(2);
    expect(rentalDays("2026-11-14T10:00", "2026-11-14T18:00")).toBe(1);
    expect(rentalDays("2026-11-14T10:00", "2026-11-17T09:00")).toBe(3);
  });
  it("is null for missing, invalid or reversed periods", () => {
    expect(rentalDays("", "2026-11-15T10:00")).toBeNull();
    expect(rentalDays("2026-11-14T10:00", undefined)).toBeNull();
    expect(rentalDays("2026-11-15T10:00", "2026-11-14T10:00")).toBeNull();
    expect(rentalDays("2026-11-14T10:00", "2026-11-14T10:00")).toBeNull();
  });
});

describe("rental line totals", () => {
  it("multiplies qty x days x day rate", () => {
    expect(lineTotalCents({ description: "FX3", qty: 2, unitPriceCents: 8000, rental: { days: 3 } })).toBe(48000);
    expect(subtotalCents([
      { description: "FX3", qty: 1, unitPriceCents: 8000, rental: { days: 2 } },
      { description: "Delivery", qty: 1, unitPriceCents: 2000 },
    ])).toBe(18000);
  });
});

describe("formatting", () => {
  it("formats a datetime-local value", () => {
    const s = formatRentalDateTime("2026-11-14T10:00");
    expect(s).toContain("14 Nov 2026");
    expect(s).toMatch(/10:00/);
  });
  it("labels days", () => {
    expect(daysLabel(1)).toBe("1 day");
    expect(daysLabel(3)).toBe("3 days");
  });
});

import { fromRentalLines, newRentalLine, rentalPeriodError, syncRentalDays, toRentalLines } from "./rental";

describe("rentalPeriodError", () => {
  it("allows an unfinished period on a draft, not when finalizing", () => {
    expect(rentalPeriodError("", "")).toBeNull();
    expect(rentalPeriodError("", "", true)).toMatch(/collection and return/);
  });
  it("rejects a return before collection", () => {
    expect(rentalPeriodError("2026-11-15T10:00", "2026-11-14T10:00")).toMatch(/after the collection/);
    expect(rentalPeriodError("2026-11-14T10:00", "2026-11-15T10:00", true)).toBeNull();
  });
});

describe("switching lines to and from rental", () => {
  const lines = [
    { description: "FX3", qty: 1, unitPriceCents: 8000 },
    { description: "Part", qty: 1, unitPriceCents: 500, print: { material: "PLA" } as never },
  ];
  it("turns plain lines into rental lines and back, leaving print lines alone", () => {
    const r = toRentalLines(lines, 3);
    expect(r[0].rental).toEqual({ days: 3 });
    expect(r[1].rental).toBeUndefined();
    const back = fromRentalLines(r);
    expect(back[0]).toEqual(lines[0]);
    expect("rental" in back[0]).toBe(false);
  });
  it("starts a new line at the period's day count", () => {
    expect(newRentalLine(4)).toEqual({ description: "", qty: 1, unitPriceCents: 0, rental: { days: 4 } });
  });
});

describe("syncRentalDays", () => {
  it("moves lines on the old count and keeps hand-edited ones", () => {
    const lines = [
      { description: "FX3", qty: 1, unitPriceCents: 8000, rental: { days: 3, replacementCents: 550000 } },
      { description: "Lens", qty: 1, unitPriceCents: 4500, rental: { days: 1 } },
      { description: "Delivery", qty: 1, unitPriceCents: 4000 },
    ];
    const out = syncRentalDays(lines, 3, 5);
    expect(out[0].rental).toEqual({ days: 5, replacementCents: 550000 });
    expect(out[1].rental).toEqual({ days: 1 });
    expect(out[2]).toBe(lines[2]);
  });
});

import { attachesRentalTerms } from "./types";

describe("attachesRentalTerms", () => {
  it("attaches by default, including rows from before migration 021", () => {
    expect(attachesRentalTerms({ is_rental: true })).toBe(true);
    expect(attachesRentalTerms({ is_rental: true, rental_terms: true })).toBe(true);
  });
  it("leaves them off when sent separately, and never for non-rentals", () => {
    expect(attachesRentalTerms({ is_rental: true, rental_terms: false })).toBe(false);
    expect(attachesRentalTerms({ is_rental: false })).toBe(false);
  });
});
