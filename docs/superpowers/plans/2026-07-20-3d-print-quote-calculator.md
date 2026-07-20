# 3D-Print Quote Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public, unauthenticated `/quote/[slug]` page where visitors upload an STL and get an instant estimated 3D-print price, plus an admin-only pricing config section and a quotes inbox, without touching any existing invoice/business functionality.

**Architecture:** Two new Supabase tables (`print_pricing_settings`, `print_quotes`) and a private storage bucket, all RLS-scoped so `anon` can only read rates and insert quotes — never read anyone else's data. A pure-TypeScript STL parser + pricing engine runs entirely client-side. The public route bypasses the app's global login gate in `proxy.ts` the same way `/api` already does.

**Tech Stack:** Next.js 16 App Router (async `params`), React 19 client components, `@supabase/supabase-js` via the existing `src/lib/supabase/{client,server}.ts` wrappers, Vitest for unit tests, no new npm dependencies.

## Global Constraints

- RLS owner check is always `(select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com'` — copy this exact policy shape from `supabase/migrations/001_schema.sql` / `003_businesses.sql` for every new table.
- `anon` role gets the *minimum* possible grant per table: SELECT-only on `print_pricing_settings`, INSERT-only on `print_quotes`, SELECT-only (non-archived rows) on `businesses`, INSERT-only on the `print-quote-files` storage bucket. Never `for all to anon`.
- Max upload size: 25MB (`26214400` bytes), enforced both client-side and at the storage bucket level.
- File type: `.stl` only.
- Public price display must say the price is an **estimate**, confirmed by the owner after slicing — never imply this is a final/binding price.
- No in-app contact form fields (name/email/phone). Conversion path is a `t.me/<handle>` deep link with a pre-filled quote summary.
- Owner's default rates to seed in the settings UI (not the DB): PLA Basic $0.03/g, PETG $0.03/g, PLA+ (Tough) $0.04/g, PLA Matte $0.04/g, PLA Galaxy $0.05/g, TPU $0.06/g; cost/hour $2.00; multi-colour time surcharge 20%.
- Migrations in this project are applied via the Supabase Management API (the DB password is unknown) — see Task 1, Step 3 for the exact `curl` invocation. **Use `curl`, not Python** — Cloudflare's WAF blocks Python's default `requests`/`urllib` user-agent.

---

### Task 1: Database migration — tables, RLS, storage bucket

**Files:**
- Create: `supabase/migrations/004_print_quotes.sql`

**Interfaces:**
- Produces: tables `print_pricing_settings(business_id, materials, print_speed_cm3_per_hour, cost_per_hour_cents, waste_percent, multi_colour_time_surcharge_percent, multi_colour_waste_percent, minimum_price_cents, telegram_handle, updated_at)` and `print_quotes(id, business_id, material, volume_cm3, weight_g, estimated_hours, price_cents, file_path, multi_colour, notes, status, created_at)`; storage bucket `print-quote-files`; a new anon SELECT policy on `businesses`. All consumed by Tasks 4, 5, 7, 8.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/004_print_quotes.sql
-- 3D-print quote calculator: the app's first public, unauthenticated write
-- path. Two new tables plus a storage bucket, each opened to `anon` for
-- only the narrow operation the public quote page needs — never broad
-- access. Owner access follows the same email-locked pattern as every
-- other table in this project.

create table print_pricing_settings (
  business_id uuid primary key references businesses(id) on delete cascade,
  materials jsonb not null default '[]',
  print_speed_cm3_per_hour numeric not null,
  cost_per_hour_cents int not null default 200,
  waste_percent numeric not null default 0,
  multi_colour_time_surcharge_percent numeric not null default 20,
  multi_colour_waste_percent numeric not null default 0,
  minimum_price_cents int,
  telegram_handle text not null default '',
  updated_at timestamptz not null default now()
);

alter table print_pricing_settings enable row level security;

create policy owner_print_pricing_settings on print_pricing_settings for all to authenticated
  using ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com')
  with check ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com');

-- Public quote page needs to read rates to compute a price. No secrets in
-- this table, only pricing math. Scoped to non-archived businesses only.
create policy public_read_print_pricing_settings on print_pricing_settings for select to anon
  using (exists (
    select 1 from businesses b
    where b.id = print_pricing_settings.business_id and b.archived_at is null
  ));

create table print_quotes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  material text not null,
  volume_cm3 numeric not null,
  weight_g numeric not null,
  estimated_hours numeric not null,
  price_cents int not null,
  file_path text not null,
  multi_colour boolean not null default false,
  notes text not null default '',
  status text not null default 'new' check (status in ('new','contacted','archived')),
  created_at timestamptz not null default now()
);

alter table print_quotes enable row level security;

create policy owner_print_quotes on print_quotes for all to authenticated
  using ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com')
  with check ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com');

-- Visitors can submit a quote but can never read one back — no way to
-- enumerate other people's quote requests. The business_id check stops an
-- anon client from writing against an archived/nonexistent business.
create policy public_insert_print_quotes on print_quotes for insert to anon
  with check (exists (
    select 1 from businesses b
    where b.id = print_quotes.business_id and b.archived_at is null
  ));

-- The public quote page needs the business's name/slug; `businesses`
-- currently has no anon access at all. Scoped to non-archived rows — app
-- code must keep selecting only {id,name,slug} for anon callers, since RLS
-- controls row visibility, not column visibility.
create policy public_read_active_businesses on businesses for select to anon
  using (archived_at is null);

-- Storage bucket for uploaded STL files. Not public: anon can upload but
-- never list/read; only the owner can read (for the /quotes download link).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'print-quote-files', 'print-quote-files', false, 26214400,
  array['model/stl', 'application/sla', 'application/vnd.ms-pki.stl', 'application/octet-stream']
);

create policy anon_upload_print_quote_files on storage.objects for insert to anon
  with check (bucket_id = 'print-quote-files');

create policy owner_read_print_quote_files on storage.objects for select to authenticated
  using (
    bucket_id = 'print-quote-files'
    and (select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com'
  );
```

- [ ] **Step 2: Get the Management API token**

```bash
security find-generic-password -s "Supabase CLI" -w | base64 -d
```

This prints the access token used for the Management API (per this project's existing infra notes — DB password is unknown, so migrations go through `https://api.supabase.com`, not `psql`).

- [ ] **Step 3: Apply the migration via the Management API**

```bash
TOKEN=$(security find-generic-password -s "Supabase CLI" -w | base64 -d)
SQL=$(cat supabase/migrations/004_print_quotes.sql)
curl -s -X POST "https://api.supabase.com/v1/projects/gjsiholuyrqrqgyrfewu/database/query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg q "$SQL" '{query: $q}')"
```

Expected: a JSON response with no `error` field (an empty array `[]` or similar success payload — `CREATE TABLE`/`CREATE POLICY`/`INSERT` statements don't return rows).

- [ ] **Step 4: Verify the tables and policies exist**

```bash
TOKEN=$(security find-generic-password -s "Supabase CLI" -w | base64 -d)
curl -s -X POST "https://api.supabase.com/v1/projects/gjsiholuyrqrqgyrfewu/database/query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "select tablename, policyname, roles, cmd from pg_policies where tablename in ('"'"'print_pricing_settings'"'"','"'"'print_quotes'"'"','"'"'businesses'"'"') order by tablename, policyname;"}'
```

Expected: rows showing `owner_print_pricing_settings`/`public_read_print_pricing_settings` on `print_pricing_settings`, `owner_print_quotes`/`public_insert_print_quotes` on `print_quotes`, and `owner_businesses`/`public_read_active_businesses` on `businesses`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/004_print_quotes.sql
git commit -m "feat: add print_pricing_settings/print_quotes tables and storage bucket"
```

---

### Task 2: Types

**Files:**
- Modify: `src/lib/types.ts`

**Interfaces:**
- Consumes: nothing new (extends the existing types file).
- Produces: `PrintMaterial`, `PrintPricingSettings`, `PrintQuoteStatus`, `PrintQuote` — consumed by Tasks 3, 4, 5, 7, 8.

- [ ] **Step 1: Add the new types**

Append to the end of `src/lib/types.ts`:

```ts
export type PrintMaterial = {
  name: string;
  density_g_cm3: number;
  cost_per_gram_cents: number;
};

export type PrintPricingSettings = {
  business_id: string;
  materials: PrintMaterial[];
  print_speed_cm3_per_hour: number;
  cost_per_hour_cents: number;
  waste_percent: number;
  multi_colour_time_surcharge_percent: number;
  multi_colour_waste_percent: number;
  minimum_price_cents: number | null;
  telegram_handle: string;
};

export type PrintQuoteStatus = "new" | "contacted" | "archived";

export type PrintQuote = {
  id: string;
  business_id: string;
  material: string;
  volume_cm3: number;
  weight_g: number;
  estimated_hours: number;
  price_cents: number;
  file_path: string;
  multi_colour: boolean;
  notes: string;
  status: PrintQuoteStatus;
  created_at: string;
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add print quote types"
```

---

### Task 3: STL parser + pricing engine (TDD)

**Files:**
- Create: `src/lib/stlQuote.ts`
- Test: `src/lib/stlQuote.test.ts`

**Interfaces:**
- Consumes: `PrintMaterial`, `PrintPricingSettings` fields (`print_speed_cm3_per_hour`, `cost_per_hour_cents`, `waste_percent`, `multi_colour_time_surcharge_percent`, `multi_colour_waste_percent`, `minimum_price_cents`) from Task 2.
- Produces: `parseSTL(buffer: ArrayBuffer): { volumeCm3: number; boundingBoxMm: { min: [number,number,number]; max: [number,number,number] } }` and `estimateQuote(volumeCm3: number, material: Material, multiColour: boolean, settings: PricingSettings): QuoteEstimate` where `QuoteEstimate = { volumeCm3: number; weightG: number; hours: number; materialCostCents: number; timeCostCents: number; priceCents: number }`. Consumed by Task 7.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/stlQuote.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/stlQuote.test.ts`
Expected: FAIL — `Cannot find module './stlQuote'` (the file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/stlQuote.ts`. Note: the ASCII parser below reads all `vertex x y z` matches with `text.matchAll(vertexRe)` rather than looping a regex's match method directly — both work identically here, `matchAll` is just the more idiomatic modern form for "give me every match."

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/stlQuote.test.ts`
Expected: PASS, all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stlQuote.ts src/lib/stlQuote.test.ts
git commit -m "feat: add STL volume parser and print pricing engine"
```

---

### Task 4: `db.ts` data access functions

**Files:**
- Modify: `src/lib/db.ts`

**Interfaces:**
- Consumes: `PrintPricingSettings`, `PrintQuote`, `PrintQuoteStatus` from Task 2.
- Produces: `getPricingSettings`, `savePricingSettings`, `listPrintQuotes`, `updatePrintQuoteStatus`, `submitPrintQuote`, `uploadPrintQuoteFile`, `getPrintQuoteFileUrl` — consumed by Tasks 5, 7, 8. (`getBusinessBySlug` is deliberately *not* added here — Task 7's page is a server component and queries `businesses` directly via `createServerSupabase()`, matching how `invoices/[id]/page.tsx` already defers all data access to server/client Supabase clients rather than the browser-client-based `db.ts`.)

- [ ] **Step 1: Add the functions**

Update the type import line at the top of `src/lib/db.ts`:

```ts
import { createClient } from "@/lib/supabase/client";
import { subtotalCents, totalCents } from "@/lib/money";
import type { Business, Customer, Invoice, Preset, PrintPricingSettings, PrintQuote, PrintQuoteStatus } from "@/lib/types";
```

Append at the end of `src/lib/db.ts`:

```ts
export async function getPricingSettings(businessId: string): Promise<PrintPricingSettings | null> {
  const res = await db().from("print_pricing_settings").select("*").eq("business_id", businessId).maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export async function savePricingSettings(settings: PrintPricingSettings): Promise<PrintPricingSettings> {
  return ok(await db().from("print_pricing_settings")
    .upsert({ ...settings, updated_at: new Date().toISOString() })
    .select().single());
}

export async function listPrintQuotes(businessId: string): Promise<PrintQuote[]> {
  return ok(await db().from("print_quotes").select("*").eq("business_id", businessId).order("created_at", { ascending: false }));
}

export async function updatePrintQuoteStatus(id: string, status: PrintQuoteStatus): Promise<void> {
  ok(await db().from("print_quotes").update({ status }).eq("id", id).select().single());
}

export type SubmitQuoteInput = Omit<PrintQuote, "id" | "created_at" | "status">;

export async function submitPrintQuote(input: SubmitQuoteInput): Promise<PrintQuote> {
  return ok(await db().from("print_quotes").insert(input).select().single());
}

export async function uploadPrintQuoteFile(businessId: string, file: File): Promise<string> {
  const path = `${businessId}/${crypto.randomUUID()}-${file.name}`;
  const res = await db().storage.from("print-quote-files").upload(path, file);
  if (res.error) throw new Error(res.error.message);
  return path;
}

export async function getPrintQuoteFileUrl(path: string): Promise<string> {
  const res = await db().storage.from("print-quote-files").createSignedUrl(path, 3600);
  if (res.error) throw new Error(res.error.message);
  return res.data.signedUrl;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat: add print pricing/quotes data access functions"
```

---

### Task 5: Settings page — 3D Print Pricing section

**Files:**
- Create: `src/components/PrintPricingSettingsCard.tsx`
- Modify: `src/app/settings/page.tsx`

**Interfaces:**
- Consumes: `getPricingSettings`, `savePricingSettings` (Task 4); `PrintMaterial`, `PrintPricingSettings` (Task 2).
- Produces: `<PrintPricingSettingsCard businessId={string} />` — consumed by `src/app/settings/page.tsx`.

- [ ] **Step 1: Create the pricing settings card component**

Create `src/components/PrintPricingSettingsCard.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { getPricingSettings, savePricingSettings } from "@/lib/db";
import type { PrintMaterial, PrintPricingSettings } from "@/lib/types";
import { IconAdd, IconCheck, IconTrash } from "@/components/icons";

const DEFAULT_MATERIALS: PrintMaterial[] = [
  { name: "PLA Basic", density_g_cm3: 1.24, cost_per_gram_cents: 3 },
  { name: "PETG", density_g_cm3: 1.27, cost_per_gram_cents: 3 },
  { name: "PLA+ (Tough)", density_g_cm3: 1.24, cost_per_gram_cents: 4 },
  { name: "PLA Matte", density_g_cm3: 1.24, cost_per_gram_cents: 4 },
  { name: "PLA Galaxy", density_g_cm3: 1.24, cost_per_gram_cents: 5 },
  { name: "TPU", density_g_cm3: 1.21, cost_per_gram_cents: 6 },
];

function emptySettings(businessId: string): PrintPricingSettings {
  return {
    business_id: businessId,
    materials: DEFAULT_MATERIALS,
    print_speed_cm3_per_hour: 0,
    cost_per_hour_cents: 200,
    waste_percent: 0,
    multi_colour_time_surcharge_percent: 20,
    multi_colour_waste_percent: 0,
    minimum_price_cents: null,
    telegram_handle: "",
  };
}

export default function PrintPricingSettingsCard({ businessId }: { businessId: string }) {
  const [form, setForm] = useState<PrintPricingSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(null);
    getPricingSettings(businessId)
      .then((row) => setForm(row ?? emptySettings(businessId)))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load pricing settings"));
  }, [businessId]);

  if (!form) {
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-label">3D Print Pricing</div>
        <p style={{ color: "var(--text-tertiary)" }}>{error || "Loading…"}</p>
      </div>
    );
  }

  function updateMaterial(index: number, patch: Partial<PrintMaterial>) {
    setForm({ ...form!, materials: form!.materials.map((m, i) => (i === index ? { ...m, ...patch } : m)) });
  }

  function addMaterial() {
    setForm({ ...form!, materials: [...form!.materials, { name: "", density_g_cm3: 1.24, cost_per_gram_cents: 3 }] });
  }

  function removeMaterial(index: number) {
    setForm({ ...form!, materials: form!.materials.filter((_, i) => i !== index) });
  }

  async function onSave() {
    if (!form!.print_speed_cm3_per_hour || form!.print_speed_cm3_per_hour <= 0) {
      setError("Print speed (cm³/hour) is required — check a couple of real slices in Bambu Studio to calibrate this.");
      return;
    }
    if (form!.materials.length === 0 || form!.materials.some((m) => !m.name.trim())) {
      setError("Add at least one material, and give every material a name");
      return;
    }
    try {
      const result = await savePricingSettings(form!);
      setForm(result);
      setSaved(true);
      setError(null);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save pricing settings");
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="section-label">3D Print Pricing</div>

      {error && (
        <div style={{
          background: "var(--warning-bg)", color: "var(--warning)", padding: "10px 14px",
          borderRadius: "var(--radius-sm)", fontSize: "0.85rem", fontWeight: 600, marginBottom: 14,
        }}>{error}</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        {form.materials.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input className="input" placeholder="Material name" style={{ flex: 2 }}
              value={m.name} onChange={(e) => updateMaterial(i, { name: e.target.value })} />
            <input className="input" placeholder="Density g/cm³" inputMode="decimal" style={{ flex: 1 }}
              value={m.density_g_cm3} onChange={(e) => updateMaterial(i, { density_g_cm3: parseFloat(e.target.value) || 0 })} />
            <input className="input" placeholder="$/g" inputMode="decimal" style={{ flex: 1 }}
              value={(m.cost_per_gram_cents / 100).toFixed(2)}
              onChange={(e) => updateMaterial(i, { cost_per_gram_cents: Math.round((parseFloat(e.target.value) || 0) * 100) })} />
            <button onClick={() => removeMaterial(i)} className="btn-danger icon-btn" aria-label={`Remove ${m.name || "material"}`}>
              <IconTrash size={14} />
            </button>
          </div>
        ))}
        <button onClick={addMaterial} className="btn btn-secondary icon-btn" style={{ alignSelf: "flex-start" }}>
          <IconAdd size={15} /> Add Material
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div>
          <label className="input-label">Print speed (cm³/hour)</label>
          <input className="input" inputMode="decimal" value={form.print_speed_cm3_per_hour || ""}
            onChange={(e) => setForm({ ...form, print_speed_cm3_per_hour: parseFloat(e.target.value) || 0 })} />
        </div>
        <div>
          <label className="input-label">Cost per hour ($)</label>
          <input className="input" inputMode="decimal" value={(form.cost_per_hour_cents / 100).toFixed(2)}
            onChange={(e) => setForm({ ...form, cost_per_hour_cents: Math.round((parseFloat(e.target.value) || 0) * 100) })} />
        </div>
        <div>
          <label className="input-label">Waste % (all prints)</label>
          <input className="input" inputMode="decimal" value={form.waste_percent}
            onChange={(e) => setForm({ ...form, waste_percent: parseFloat(e.target.value) || 0 })} />
        </div>
        <div>
          <label className="input-label">Minimum price ($, optional)</label>
          <input className="input" inputMode="decimal" value={form.minimum_price_cents ? (form.minimum_price_cents / 100).toFixed(2) : ""}
            onChange={(e) => setForm({ ...form, minimum_price_cents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null })} />
        </div>
        <div>
          <label className="input-label">Multi-colour time surcharge %</label>
          <input className="input" inputMode="decimal" value={form.multi_colour_time_surcharge_percent}
            onChange={(e) => setForm({ ...form, multi_colour_time_surcharge_percent: parseFloat(e.target.value) || 0 })} />
        </div>
        <div>
          <label className="input-label">Multi-colour extra waste %</label>
          <input className="input" inputMode="decimal" value={form.multi_colour_waste_percent}
            onChange={(e) => setForm({ ...form, multi_colour_waste_percent: parseFloat(e.target.value) || 0 })} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="input-label">Telegram handle (for the &quot;Message me&quot; button)</label>
          <input className="input" placeholder="mynameisjiajun" value={form.telegram_handle}
            onChange={(e) => setForm({ ...form, telegram_handle: e.target.value.replace(/^@/, "") })} />
        </div>
      </div>

      <button onClick={onSave} className={`btn icon-btn ${saved ? "btn-accent" : "btn-primary"}`}>
        {saved && <IconCheck size={15} />} {saved ? "Saved" : "Save Pricing"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the settings page**

In `src/app/settings/page.tsx`, add the import near the top:

```ts
import PrintPricingSettingsCard from "@/components/PrintPricingSettingsCard";
```

Then render it right after the "Business info" `<div className="card" ...>` block (i.e. between that card's closing `</div>` and the "Service presets" card's opening `<div className="card">`):

```tsx
      <PrintPricingSettingsCard businessId={activeBusiness.id} />
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, sign in, go to `/settings`, confirm the "3D Print Pricing" card renders below Business Information, fill in a print speed (e.g. `15`), a Telegram handle, save, reload the page, and confirm the saved values persist.

- [ ] **Step 5: Commit**

```bash
git add src/components/PrintPricingSettingsCard.tsx src/app/settings/page.tsx
git commit -m "feat: add 3D print pricing settings UI"
```

---

### Task 6: Public route exclusion (proxy, business context, nav)

**Files:**
- Modify: `src/proxy.ts`
- Modify: `src/lib/businessContext.tsx`
- Modify: `src/components/NavBar.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `/quote/*` reachable without a session; no NavBar chrome or business-fetch side effects on that path. Required before Task 7's page is usable.

- [ ] **Step 1: Exclude `/quote` from the proxy's login gate**

In `src/proxy.ts`, change the matcher:

```ts
export const config = {
  // /api and /quote are excluded: API routes return their own status codes,
  // and /quote/[slug] is the public, unauthenticated 3D-print quote page.
  matcher: ["/((?!api|quote|_next/static|_next/image|favicon.ico|manifest|icons).*)"],
};
```

- [ ] **Step 2: Skip the business fetch on `/quote`**

In `src/lib/businessContext.tsx`, change:

```ts
  useEffect(() => {
    if (pathname.startsWith("/login")) return;
    reloadBusinesses().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname.startsWith("/login")]);
```

to:

```ts
  useEffect(() => {
    if (pathname.startsWith("/login") || pathname.startsWith("/quote")) return;
    reloadBusinesses().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname.startsWith("/login") || pathname.startsWith("/quote")]);
```

- [ ] **Step 3: Hide NavBar on `/quote`**

In `src/components/NavBar.tsx`, change:

```ts
  if (pathname.startsWith("/login")) return null;
```

to:

```ts
  if (pathname.startsWith("/login") || pathname.startsWith("/quote")) return null;
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`. In an incognito/private window (no session cookie), visit `http://localhost:3000/quote/anything` — expect it to render (a 404 page, since the route doesn't exist yet, is fine at this stage) rather than redirecting to `/login`. Visit any other route (e.g. `/`) in the same incognito window and confirm it still redirects to `/login` as before.

- [ ] **Step 6: Commit**

```bash
git add src/proxy.ts src/lib/businessContext.tsx src/components/NavBar.tsx
git commit -m "feat: exclude /quote from the login gate"
```

---

### Task 7: Public quote page

**Files:**
- Create: `src/app/quote/[slug]/page.tsx`
- Create: `src/components/QuoteCalculator.tsx`
- Modify: `src/components/icons.tsx`

**Interfaces:**
- Consumes: `parseSTL`, `estimateQuote` (Task 3); `getBusinessBySlug`, `submitPrintQuote`, `uploadPrintQuoteFile` (Task 4); `PrintPricingSettings` (Task 2); `createServerSupabase` (existing, `src/lib/supabase/server.ts`).
- Produces: the `/quote/[slug]` route.

- [ ] **Step 1: Add a paper-plane icon for the Telegram button**

Append to `src/components/icons.tsx`:

```tsx
export function IconSend({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4Z" />
    </svg>
  );
}
```

- [ ] **Step 2: Create the quote calculator client component**

Create `src/components/QuoteCalculator.tsx`:

```tsx
"use client";
import { useState } from "react";
import { parseSTL, estimateQuote, type QuoteEstimate } from "@/lib/stlQuote";
import { submitPrintQuote, uploadPrintQuoteFile } from "@/lib/db";
import { formatSGD } from "@/lib/money";
import type { PrintPricingSettings } from "@/lib/types";
import { IconSend, IconWarning } from "@/components/icons";

const MAX_FILE_BYTES = 25 * 1024 * 1024;

type BusinessSummary = { id: string; name: string; slug: string };

export default function QuoteCalculator({ business, settings }: { business: BusinessSummary; settings: PrintPricingSettings }) {
  const [file, setFile] = useState<File | null>(null);
  const [volumeCm3, setVolumeCm3] = useState<number | null>(null);
  const [materialName, setMaterialName] = useState(settings.materials[0]?.name ?? "");
  const [multiColour, setMultiColour] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const material = settings.materials.find((m) => m.name === materialName) ?? null;
  const estimate: QuoteEstimate | null =
    volumeCm3 !== null && material ? estimateQuote(volumeCm3, material, multiColour, settings) : null;

  async function onFileChange(f: File | null) {
    setFile(f);
    setVolumeCm3(null);
    setSubmitted(false);
    setError(null);
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".stl")) {
      setError("Please upload a .stl file");
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setError("File is too large (max 25MB)");
      return;
    }
    setParsing(true);
    try {
      const buffer = await f.arrayBuffer();
      const { volumeCm3: v } = parseSTL(buffer);
      setVolumeCm3(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that STL file");
    } finally {
      setParsing(false);
    }
  }

  async function onMessageOnTelegram() {
    if (!file || !material || !estimate) return;
    try {
      const filePath = await uploadPrintQuoteFile(business.id, file);
      await submitPrintQuote({
        business_id: business.id,
        material: material.name,
        volume_cm3: estimate.volumeCm3,
        weight_g: estimate.weightG,
        estimated_hours: estimate.hours,
        price_cents: estimate.priceCents,
        file_path: filePath,
        multi_colour: multiColour,
        notes,
      });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your quote — you can still message us directly");
    }
    const summary =
      `Hi! I'd like a quote for a 3D print.\n` +
      `File: ${file.name}\n` +
      `Material: ${material.name}${multiColour ? " (multi-colour/AMS)" : ""}\n` +
      `Estimated weight: ${estimate.weightG.toFixed(1)}g, ~${estimate.hours.toFixed(1)}h\n` +
      `Estimated price: ${formatSGD(estimate.priceCents)}` +
      (notes ? `\nNotes: ${notes}` : "");
    const handle = settings.telegram_handle.replace(/^@/, "");
    window.open(`https://t.me/${handle}?text=${encodeURIComponent(summary)}`, "_blank");
  }

  return (
    <main className="page-container animate-fade-in">
      <h1 className="page-title">{business.name} — 3D Print Quote</h1>
      <p className="page-subtitle">Upload an STL to get an instant estimated price</p>

      <div className="card" style={{ marginBottom: 16 }}>
        <label className="input-label">STL file</label>
        <input className="input" type="file" accept=".stl"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)} />

        {error && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginTop: 12,
            background: "var(--warning-bg)", color: "var(--warning)", padding: "10px 14px",
            borderRadius: "var(--radius-sm)", fontSize: "0.85rem", fontWeight: 600,
          }}>
            <IconWarning size={15} /> {error}
          </div>
        )}

        {parsing && <p style={{ marginTop: 12, color: "var(--text-tertiary)" }}>Reading file…</p>}

        {volumeCm3 !== null && (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label className="input-label">Material</label>
              <select className="input" value={materialName} onChange={(e) => setMaterialName(e.target.value)}>
                {settings.materials.map((m) => (
                  <option key={m.name} value={m.name}>{m.name} — {formatSGD(m.cost_per_gram_cents)}/g</option>
                ))}
              </select>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem" }}>
              <input type="checkbox" checked={multiColour} onChange={(e) => setMultiColour(e.target.checked)} />
              Multi-colour print (AMS)
            </label>

            <div>
              <label className="input-label">Notes (optional — colour, quantity, etc.)</label>
              <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {estimate && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-label">Estimated Price</div>
          <div className="money" style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 8 }}>
            {formatSGD(estimate.priceCents)}
          </div>
          <p style={{ color: "var(--text-tertiary)", fontSize: "0.82rem", marginBottom: 14 }}>
            ~{estimate.weightG.toFixed(1)}g · ~{estimate.hours.toFixed(1)}h print time.
            This is an estimate only — {business.name} confirms the final price after actually slicing your file.
          </p>
          {submitted ? (
            <p style={{ color: "var(--success)", fontWeight: 600, fontSize: "0.85rem" }}>
              Saved! Continue the conversation on Telegram.
            </p>
          ) : (
            <button onClick={onMessageOnTelegram} className="btn btn-primary icon-btn" disabled={!settings.telegram_handle}>
              <IconSend size={15} /> Message on Telegram to Order
            </button>
          )}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Create the route**

Create `src/app/quote/[slug]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import QuoteCalculator from "@/components/QuoteCalculator";

export default async function QuotePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createServerSupabase();

  const { data: business } = await supabase
    .from("businesses")
    .select("id,name,slug")
    .eq("slug", slug)
    .is("archived_at", null)
    .maybeSingle();
  if (!business) notFound();

  const { data: settings } = await supabase
    .from("print_pricing_settings")
    .select("*")
    .eq("business_id", business.id)
    .maybeSingle();
  if (!settings) notFound();

  return <QuoteCalculator business={business} settings={settings} />;
}
```

Note: this codebase doesn't generate typed Supabase `Database` types (`src/lib/supabase/client.ts`/`server.ts` create untyped clients), so `business`/`settings` here are loosely typed — same as every other `.select()` call in the codebase (see `src/lib/db.ts`'s `ok<T>()` helper, which casts rather than relying on inference). No cast is needed here since the values just flow straight into `QuoteCalculator`'s props.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`. In `/settings`, note the slug of the business you configured pricing for in Task 5 (visible as the business name; slugs are set when the business is created — check `listBusinesses()` output or the DB directly if unsure). In an incognito window, visit `/quote/<that-slug>`. Confirm: no NavBar, upload an `.stl` file (any real one from your printer library works), confirm a material list and price appear, check the multi-colour checkbox and confirm the price updates, click "Message on Telegram to Order" and confirm it opens a Telegram chat with the pre-filled summary text.

- [ ] **Step 6: Commit**

```bash
git add src/components/icons.tsx src/components/QuoteCalculator.tsx "src/app/quote/[slug]/page.tsx"
git commit -m "feat: add public 3D print quote calculator page"
```

---

### Task 8: Admin quotes inbox

**Files:**
- Create: `src/app/quotes/page.tsx`
- Modify: `src/components/NavBar.tsx`

**Interfaces:**
- Consumes: `listPrintQuotes`, `updatePrintQuoteStatus`, `getPrintQuoteFileUrl` (Task 4); `useBusiness` (existing); `PrintQuote`, `PrintQuoteStatus` (Task 2).
- Produces: the `/quotes` route, reachable from NavBar.

- [ ] **Step 1: Create the quotes page**

Create `src/app/quotes/page.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { useBusiness } from "@/lib/businessContext";
import { listPrintQuotes, updatePrintQuoteStatus, getPrintQuoteFileUrl } from "@/lib/db";
import { formatSGD } from "@/lib/money";
import type { PrintQuote, PrintQuoteStatus } from "@/lib/types";
import { IconDownload } from "@/components/icons";

const STATUSES: PrintQuoteStatus[] = ["new", "contacted", "archived"];

export default function QuotesPage() {
  const { activeBusiness } = useBusiness();
  const [quotes, setQuotes] = useState<PrintQuote[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeBusiness) return;
    listPrintQuotes(activeBusiness.id)
      .then(setQuotes)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load quotes"));
  }, [activeBusiness]);

  async function onStatusChange(q: PrintQuote, status: PrintQuoteStatus) {
    try {
      await updatePrintQuoteStatus(q.id, status);
      setQuotes(quotes.map((x) => (x.id === q.id ? { ...x, status } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    }
  }

  async function onDownload(q: PrintQuote) {
    try {
      const url = await getPrintQuoteFileUrl(q.file_path);
      window.open(url, "_blank");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get download link");
    }
  }

  if (!activeBusiness) {
    return <div className="page-container"><p style={{ color: "var(--text-tertiary)" }}>Loading…</p></div>;
  }

  return (
    <main className="page-container animate-fade-in">
      <h1 className="page-title">3D Print Quotes</h1>
      <p className="page-subtitle">Quote requests submitted for {activeBusiness.name}</p>

      {error && (
        <div style={{
          background: "var(--warning-bg)", color: "var(--warning)", padding: "10px 14px",
          borderRadius: "var(--radius-sm)", fontSize: "0.85rem", fontWeight: 600, marginBottom: 16,
        }}>{error}</div>
      )}

      {quotes.length === 0 && <p style={{ color: "var(--text-tertiary)" }}>No quote requests yet.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {quotes.map((q) => (
          <div key={q.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{q.material}{q.multi_colour ? " (multi-colour)" : ""}</div>
                <div style={{ color: "var(--text-tertiary)", fontSize: "0.8rem" }}>
                  {q.weight_g.toFixed(1)}g · {q.estimated_hours.toFixed(1)}h · {new Date(q.created_at).toLocaleString("en-SG")}
                </div>
                {q.notes && <div style={{ fontSize: "0.82rem", marginTop: 4 }}>{q.notes}</div>}
              </div>
              <div className="money" style={{ fontWeight: 700 }}>{formatSGD(q.price_cents)}</div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => onDownload(q)} className="btn btn-secondary icon-btn">
                <IconDownload size={14} /> Download File
              </button>
              <select className="input" value={q.status}
                onChange={(e) => onStatusChange(q, e.target.value as PrintQuoteStatus)} style={{ width: 140 }}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Add a nav link**

In `src/components/NavBar.tsx`, add `IconReceipt` to the icon import and add a link:

```ts
import { IconAdd, IconCamera, IconChart, IconReceipt, IconSettings, IconSignOut } from "@/components/icons";

const links = [
  { href: "/", label: "Invoices", Icon: IconCamera },
  { href: "/invoices/new", label: "New", Icon: IconAdd },
  { href: "/quotes", label: "Quotes", Icon: IconReceipt },
  { href: "/stats", label: "Stats", Icon: IconChart },
  { href: "/settings", label: "Settings", Icon: IconSettings },
];
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual verification**

With the quote submitted in Task 7's verification step still in the database, sign in, click "Quotes" in the nav, confirm the submitted quote appears with the correct material/price/weight/hours, click "Download File" and confirm the STL downloads, change its status to "contacted" and reload the page to confirm the status persisted.

- [ ] **Step 5: Commit**

```bash
git add "src/app/quotes/page.tsx" src/components/NavBar.tsx
git commit -m "feat: add admin quotes inbox page"
```

---

### Task 9: Full test suite + lint pass

**Files:** none new — verification only.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the new `stlQuote.test.ts` and every pre-existing test (`money`, `paynow`, `phone`, `slug`, `stats`, `formStorage`).

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Full type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit any fixes**

If lint/type-check produced changes:

```bash
git add -A
git commit -m "fix: address lint/type-check issues from 3D print quote feature"
```

---

## Post-Plan Follow-Up (not part of this plan)

The user explicitly asked for a security and performance review after this feature ships. That review should specifically check: rate limiting/abuse protection on the new public upload endpoint (this plan only adds file-size/extension checks, no IP throttling or CAPTCHA), the new anon RLS policies for over-broad access, and whether the STL parser has any pathological-input performance issues (e.g. a malformed `triangleCount` in a binary STL causing an out-of-bounds read attempt — verify `parseBinarySTL` fails safely rather than looping unbounded).
