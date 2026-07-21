import { describe, expect, test } from "vitest";
import { parseSTL, estimateQuote, type Material, type PricingSettings } from "./stlQuote";

// A tetrahedron with vertices O=(0,0,0), A=(s,0,0), B=(0,s,0), C=(0,0,s) has
// volume s^3/6. Faces below are wound so every face's normal points away
// from the solid (verified by hand: any face containing O contributes 0 to
// the signed-volume sum since O=(0,0,0), leaving only face (A,B,C), whose
// scalar triple product works out to s^3 — see the design spec for the
// derivation).
function tetrahedronVertices(s: number) {
  const O: [number, number, number] = [0, 0, 0];
  const A: [number, number, number] = [s, 0, 0];
  const B: [number, number, number] = [0, s, 0];
  const C: [number, number, number] = [0, 0, s];
  return { O, A, B, C, faces: [[O, B, A], [O, A, C], [O, C, B], [A, B, C]] as [number, number, number][][] };
}

function tetrahedronAsciiSTL(s: number): ArrayBuffer {
  const { faces } = tetrahedronVertices(s);
  const facets = faces
    .map(
      ([v0, v1, v2]) => `
    facet normal 0 0 0
      outer loop
        vertex ${v0[0]} ${v0[1]} ${v0[2]}
        vertex ${v1[0]} ${v1[1]} ${v1[2]}
        vertex ${v2[0]} ${v2[1]} ${v2[2]}
      endloop
    endfacet`
    )
    .join("\n");
  return new TextEncoder().encode(`solid test\n${facets}\nendsolid test\n`).buffer as ArrayBuffer;
}

function tetrahedronBinarySTL(s: number): ArrayBuffer {
  const { faces } = tetrahedronVertices(s);
  const buffer = new ArrayBuffer(84 + faces.length * 50);
  const view = new DataView(buffer);
  view.setUint32(80, faces.length, true);
  let offset = 84;
  for (const face of faces) {
    offset += 12; // normal, left as zeros — parser doesn't use it
    for (const v of face) {
      view.setFloat32(offset, v[0], true);
      view.setFloat32(offset + 4, v[1], true);
      view.setFloat32(offset + 8, v[2], true);
      offset += 12;
    }
    offset += 2; // attribute byte count
  }
  return buffer;
}

describe("parseSTL", () => {
  test("computes volume of a known tetrahedron from an ASCII STL", () => {
    const { volumeCm3 } = parseSTL(tetrahedronAsciiSTL(6));
    expect(volumeCm3).toBeCloseTo(0.036, 6); // 6^3 / 6 = 36 mm^3 = 0.036 cm^3
  });

  test("computes volume of a known tetrahedron from a binary STL", () => {
    const { volumeCm3 } = parseSTL(tetrahedronBinarySTL(6));
    expect(volumeCm3).toBeCloseTo(0.036, 6);
  });

  test("computes a bounding box in mm", () => {
    const { boundingBoxMm } = parseSTL(tetrahedronBinarySTL(6));
    expect(boundingBoxMm.min).toEqual([0, 0, 0]);
    expect(boundingBoxMm.max).toEqual([6, 6, 6]);
  });

  test("throws on an STL with no triangles", () => {
    const empty = new TextEncoder().encode("solid empty\nendsolid empty\n").buffer as ArrayBuffer;
    expect(() => parseSTL(empty)).toThrow();
  });
});

describe("estimateQuote", () => {
  const plaBasic: Material = { name: "PLA Basic", density_g_cm3: 4, cost_per_gram_cents: 3 };
  const baseSettings: PricingSettings = {
    print_speed_cm3_per_hour: 5,
    cost_per_hour_cents: 200,
    waste_percent: 0,
    multi_colour_time_surcharge_percent: 20,
    multi_colour_waste_percent: 10,
    minimum_price_cents: null,
  };

  test("reproduces the owner's worked example: 40g/2hr PLA Basic = $5.20", () => {
    // volume=10cm3 -> weight = 10*4 = 40g, hours = 10/5 = 2
    const result = estimateQuote(10, plaBasic, false, baseSettings);
    expect(result.weightG).toBeCloseTo(40);
    expect(result.hours).toBeCloseTo(2);
    expect(result.priceCents).toBe(520);
  });

  test("waste_percent inflates billed weight and material cost", () => {
    const result = estimateQuote(10, plaBasic, false, { ...baseSettings, waste_percent: 10 });
    expect(result.weightG).toBeCloseTo(44); // 40 * 1.10
    expect(result.materialCostCents).toBeCloseTo(132); // 44 * 3
  });

  test("multi-colour adds a time surcharge and extra waste", () => {
    const result = estimateQuote(10, plaBasic, true, baseSettings);
    // weight: 40 * 1.10 (10% multi-colour waste) = 44g -> material 132c
    // time: 2h * $2.00 * 1.20 (20% surcharge) = $4.80 = 480c
    expect(result.materialCostCents).toBeCloseTo(132);
    expect(result.timeCostCents).toBeCloseTo(480);
    expect(result.priceCents).toBe(612);
  });

  test("minimum_price_cents floors a cheap quote", () => {
    const tinyPart: Material = { name: "PLA Basic", density_g_cm3: 1, cost_per_gram_cents: 3 };
    const result = estimateQuote(0.1, tinyPart, false, { ...baseSettings, minimum_price_cents: 1000 });
    expect(result.priceCents).toBe(1000);
  });
});
