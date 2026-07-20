import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

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
