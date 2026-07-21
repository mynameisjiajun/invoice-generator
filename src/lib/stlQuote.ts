export type Vec3 = [number, number, number];

export type ParsedSTL = {
  volumeCm3: number;
  boundingBoxMm: { min: Vec3; max: Vec3 };
};

export function parseSTL(buffer: ArrayBuffer): ParsedSTL {
  const triangles = isBinarySTL(buffer) ? parseBinarySTL(buffer) : parseAsciiSTL(buffer);
  if (triangles.length === 0) throw new Error("STL file has no triangles");
  return { volumeCm3: volumeFromTriangles(triangles), boundingBoxMm: boundingBox(triangles) };
}

function isBinarySTL(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 84) return false;
  const view = new DataView(buffer);
  const triangleCount = view.getUint32(80, true);
  return 84 + triangleCount * 50 === buffer.byteLength;
}

function parseBinarySTL(buffer: ArrayBuffer): Vec3[][] {
  const view = new DataView(buffer);
  const triangleCount = view.getUint32(80, true);
  const triangles: Vec3[][] = [];
  let offset = 84;
  for (let i = 0; i < triangleCount; i++) {
    offset += 12; // skip normal
    const verts: Vec3[] = [];
    for (let v = 0; v < 3; v++) {
      verts.push([
        view.getFloat32(offset, true),
        view.getFloat32(offset + 4, true),
        view.getFloat32(offset + 8, true),
      ]);
      offset += 12;
    }
    offset += 2; // attribute byte count
    triangles.push(verts);
  }
  return triangles;
}

function parseAsciiSTL(buffer: ArrayBuffer): Vec3[][] {
  const text = new TextDecoder().decode(buffer);
  const vertexRe = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
  const verts: Vec3[] = [];
  for (const match of text.matchAll(vertexRe)) {
    verts.push([parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])]);
  }
  const triangles: Vec3[][] = [];
  for (let i = 0; i + 2 < verts.length; i += 3) {
    triangles.push([verts[i], verts[i + 1], verts[i + 2]]);
  }
  return triangles;
}

function volumeFromTriangles(triangles: Vec3[][]): number {
  // Signed tetrahedron volume sum (divergence theorem), using the origin
  // as the implicit 4th vertex of each tetrahedron. Works for any
  // consistently outward-wound closed mesh. STL files are conventionally
  // in millimetres, so the result (mm^3) is converted to cm^3.
  let volumeMm3 = 0;
  for (const [a, b, c] of triangles) {
    volumeMm3 += signedTetrahedronVolume(a, b, c);
  }
  return Math.abs(volumeMm3) / 1000;
}

function signedTetrahedronVolume(a: Vec3, b: Vec3, c: Vec3): number {
  return (
    a[0] * (b[1] * c[2] - b[2] * c[1]) -
    a[1] * (b[0] * c[2] - b[2] * c[0]) +
    a[2] * (b[0] * c[1] - b[1] * c[0])
  ) / 6;
}

function boundingBox(triangles: Vec3[][]): { min: Vec3; max: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const tri of triangles) {
    for (const v of tri) {
      for (let axis = 0; axis < 3; axis++) {
        if (v[axis] < min[axis]) min[axis] = v[axis];
        if (v[axis] > max[axis]) max[axis] = v[axis];
      }
    }
  }
  return { min, max };
}

export type Material = { name: string; density_g_cm3: number; cost_per_gram_cents: number };

export type PricingSettings = {
  print_speed_cm3_per_hour: number;
  cost_per_hour_cents: number;
  waste_percent: number;
  multi_colour_time_surcharge_percent: number;
  multi_colour_waste_percent: number;
  minimum_price_cents: number | null;
};

export type QuoteEstimate = {
  volumeCm3: number;
  weightG: number;
  hours: number;
  materialCostCents: number;
  timeCostCents: number;
  priceCents: number;
};

export function estimateQuote(
  volumeCm3: number,
  material: Material,
  multiColour: boolean,
  settings: PricingSettings
): QuoteEstimate {
  const rawWeightG = volumeCm3 * material.density_g_cm3;
  const wastePercent = settings.waste_percent + (multiColour ? settings.multi_colour_waste_percent : 0);
  const weightG = rawWeightG * (1 + wastePercent / 100);
  const hours = volumeCm3 / settings.print_speed_cm3_per_hour;
  const timeSurcharge = multiColour ? 1 + settings.multi_colour_time_surcharge_percent / 100 : 1;
  const timeCostCents = hours * settings.cost_per_hour_cents * timeSurcharge;
  const materialCostCents = weightG * material.cost_per_gram_cents;
  const priceCents = Math.max(materialCostCents + timeCostCents, settings.minimum_price_cents ?? 0);
  return { volumeCm3, weightG, hours, materialCostCents, timeCostCents, priceCents: Math.round(priceCents) };
}
