import { describe, expect, test } from "vitest";
import {
  lineTotalCents, subtotalCents, discountCents, totalCents, formatSGD,
  type LineItem,
} from "./money";

const shoot: LineItem = { description: "Party Shoot", qty: 1, unitPriceCents: 50000 };
const hours: LineItem = { description: "Extra hours", qty: 2.5, unitPriceCents: 15000 };

describe("money", () => {
  test("line total multiplies qty and rounds to cents", () => {
    expect(lineTotalCents(shoot)).toBe(50000);
    expect(lineTotalCents(hours)).toBe(37500);
    expect(lineTotalCents({ description: "x", qty: 3, unitPriceCents: 3333 })).toBe(9999);
  });

  test("subtotal sums line totals", () => {
    expect(subtotalCents([shoot, hours])).toBe(87500);
    expect(subtotalCents([])).toBe(0);
  });

  test("discount none is zero", () => {
    expect(discountCents(50000, "none", 99)).toBe(0);
  });

  test("amount discount converts dollars to cents and clamps", () => {
    expect(discountCents(50000, "amount", 50)).toBe(5000);
    expect(discountCents(50000, "amount", 9999)).toBe(50000); // clamp to subtotal
    expect(discountCents(50000, "amount", -5)).toBe(0);
  });

  test("percent discount rounds to cents and clamps", () => {
    expect(discountCents(50000, "percent", 10)).toBe(5000);
    expect(discountCents(33333, "percent", 10)).toBe(3333);
    expect(discountCents(50000, "percent", 150)).toBe(50000);
  });

  test("total = subtotal - discount", () => {
    expect(totalCents([shoot], "percent", 10)).toBe(45000);
    expect(totalCents([shoot], "none", 0)).toBe(50000);
  });

  test("formatSGD", () => {
    expect(formatSGD(50000)).toBe("$500.00");
    expect(formatSGD(123456)).toBe("$1,234.56");
    expect(formatSGD(0)).toBe("$0.00");
  });
});
