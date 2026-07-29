import { describe, expect, it } from "vitest";
import { invoicePrefix, slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(slugify("3D Printing")).toBe("3d-printing");
  });
  it("strips non-alphanumeric characters", () => {
    expect(slugify("JJ Visuals!")).toBe("jj-visuals");
  });
  it("collapses repeated separators", () => {
    expect(slugify("Gear   Rental --- Co")).toBe("gear-rental-co");
  });
  it("trims leading/trailing hyphens", () => {
    expect(slugify("  -Photography-  ")).toBe("photography");
  });
});

describe("invoicePrefix", () => {
  it("uses initials of up to three words", () => {
    expect(invoicePrefix("3D Printing", [])).toBe("3P-");
    expect(invoicePrefix("JJ Visuals", [])).toBe("JV-");
    expect(invoicePrefix("Gear Rental Co Extra", [])).toBe("GRC-");
  });
  it("falls back to INV- for names with no letters/digits", () => {
    expect(invoicePrefix("!!!", [])).toBe("INV-");
  });
  it("appends a digit to avoid colliding with an existing prefix", () => {
    expect(invoicePrefix("JJ Visuals", ["JV-"])).toBe("JV2-");
    expect(invoicePrefix("JJ Visuals", ["JV-", "JV2-"])).toBe("JV3-");
  });
});
