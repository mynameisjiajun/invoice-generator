import { describe, expect, it } from "vitest";
import {
  emptyPrintSpec, formatHandover, formatJobDate, parseHandover, printBreakdown, printSpecLine, type PrintSpec,
} from "./printRates";

const spec = (p: Partial<PrintSpec>): PrintSpec => ({ ...emptyPrintSpec(), ...p });

describe("printBreakdown", () => {
  it("matches the rate card's worked example: 40g PLA Basic, 2h = $5.20", () => {
    expect(printBreakdown(spec({ material: "PLA Basic", grams: 40, hours: 2 })))
      .toEqual({ materialCents: 120, timeCents: 400, totalCents: 520 });
  });

  it("applies the multi-colour surcharge to the time fee only", () => {
    expect(printBreakdown(spec({ material: "PLA Basic", grams: 40, hours: 2, multiColour: true })))
      .toEqual({ materialCents: 120, timeCents: 480, totalCents: 600 });
  });

  it("uses each material's own rate", () => {
    expect(printBreakdown(spec({ material: "TPU", grams: 100, hours: 0 }))?.totalCents).toBe(600);
    expect(printBreakdown(spec({ material: "PLA Galaxy", grams: 10, hours: 0 }))?.totalCents).toBe(50);
  });

  it("rounds fractional grams and hours to whole cents", () => {
    expect(printBreakdown(spec({ material: "PLA+", grams: 12.3, hours: 1.25 })))
      .toEqual({ materialCents: 49, timeCents: 250, totalCents: 299 });
  });

  it("returns null when nothing can be calculated", () => {
    expect(printBreakdown(spec({ material: "Nylon", grams: 40, hours: 2 }))).toBeNull();
    expect(printBreakdown(spec({ material: "PLA Basic" }))).toBeNull();
  });
});

describe("printSpecLine", () => {
  it("joins the filled-in specs", () => {
    expect(printSpecLine(spec({ material: "PLA Basic", colour: "Black", grams: 40, hours: 2 })))
      .toBe("PLA Basic, Black · 40g · 2h");
    expect(printSpecLine(spec({ material: "PETG", multiColour: true }))).toBe("PETG · Multi-colour");
  });
});

describe("handover", () => {
  it("round-trips collection and delivery", () => {
    for (const h of [
      { mode: "collection", address: "" },
      { mode: "delivery", address: "12 Example Rd, S123456" },
      { mode: "delivery", address: "" },
    ] as const) {
      expect(parseHandover(formatHandover(h))).toEqual(h);
    }
  });

  it("treats anything unrecognised as collection", () => {
    expect(parseHandover("")).toEqual({ mode: "collection", address: "" });
  });
});

describe("formatJobDate", () => {
  it("formats ISO dates and passes free text through", () => {
    expect(formatJobDate("2026-10-10")).toMatch(/10 Oct 2026/);
    expect(formatJobDate("20 June 2026, 7-9PM")).toBe("20 June 2026, 7-9PM");
  });
});
