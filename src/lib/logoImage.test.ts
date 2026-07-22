import { describe, expect, it } from "vitest";
import { fitWithin } from "./logoImage";

describe("fitWithin", () => {
  it("returns the source size unchanged when it already fits (never upscales)", () => {
    expect(fitWithin(400, 200)).toEqual({ width: 400, height: 200 });
    expect(fitWithin(10, 10)).toEqual({ width: 10, height: 10 });
  });

  it("downscales width-bound images to maxW, preserving aspect ratio", () => {
    expect(fitWithin(1800, 300)).toEqual({ width: 900, height: 150 });
  });

  it("downscales height-bound images to maxH, preserving aspect ratio", () => {
    // 4244x2298 is the real JJ Visuals logo: height is the binding constraint.
    expect(fitWithin(4244, 2298)).toEqual({ width: 554, height: 300 });
  });

  it("treats a source exactly at the box as fitting", () => {
    expect(fitWithin(900, 300)).toEqual({ width: 900, height: 300 });
  });

  it("respects custom bounds and never rounds to zero", () => {
    expect(fitWithin(1000, 1, 100, 100)).toEqual({ width: 100, height: 1 });
  });
});
