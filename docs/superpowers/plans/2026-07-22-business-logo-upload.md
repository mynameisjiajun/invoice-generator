# Business Logo Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user upload a per-business logo in Settings, stored as a base64 data URL on the `businesses` row, and used by invoice/receipt PDFs instead of the hardcoded `public/logo.png`.

**Architecture:** New nullable `businesses.logo_data_url` text column (no storage bucket — mirrors the PayNow-QR data-URL pattern). A small client-side helper decodes the picked image, downscales it into a 900×300 max box on a canvas (never upscaling), and re-encodes as a PNG data URL, which the existing Settings form/`updateBusiness` flow persists. `InvoiceDetail` stops fetching `/logo.png` and passes `business.logo_data_url` straight to `<InvoicePdf logo={…} />`.

**Tech Stack:** Next.js (App Router, client components), Supabase (Postgres via `@supabase/supabase-js`), vitest, `@react-pdf/renderer` (unchanged).

**Spec:** `docs/superpowers/specs/2026-07-22-business-logo-upload-design.md`

## Global Constraints

- Resize box: max **900×300 px**, preserve aspect ratio, **never upscale** smaller sources; output PNG data URL.
- Column is `logo_data_url text`, nullable; `null` means "no logo" and the PDF falls back to the business-name text header (already implemented in `InvoicePdf.tsx` — do not touch that file).
- Persistence goes through the **existing** "Save Settings" button / `updateBusiness` — picking a file must NOT save on its own.
- Errors surface through the settings page's existing `error` state banner — no new error UI.
- Schema change must be applied via the Supabase Management API query endpoint with **curl** (Python HTTP clients are WAF-blocked; the project's DB password is unknown). Project ref: `gjsiholuyrqrqgyrfewu`.
- User-facing copy, verbatim: helper caption "For a crisp PDF, upload an image at least 900px wide. Saved when you press Save Settings."; label "Logo (shown on invoice PDFs)"; decode-failure message "Couldn't read that image — try a PNG or JPG"; non-image message "Please choose an image file".
- Match existing code style: inline `style={{…}}` objects, existing `.btn`/`.input-label`/`icon-btn` classes, `IconAdd`/`IconTrash` from `@/components/icons`.

---

### Task 1: Schema migration + `Business` type

**Files:**
- Create: `supabase/migrations/012_business_logo.sql`
- Modify: `src/lib/types.ts:36-43` (the `Business` type)

**Interfaces:**
- Consumes: nothing.
- Produces: `businesses.logo_data_url` column (text, nullable) in the live DB; `Business.logo_data_url: string | null` used by Tasks 3 and 4. `getBusiness`/`listBusinesses`/`updateBusiness` in `src/lib/db.ts` use `select("*")` and `Partial<Business>` patches, so they pick the new field up with no changes.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/012_business_logo.sql
-- Per-business PDF logo, stored as a base64 data URL. No new RLS needed:
-- the businesses row policy (001_schema.sql) already covers this column.
alter table businesses add column if not exists logo_data_url text;
```

- [ ] **Step 2: Apply it to the live DB via the Management API**

The Supabase access token is in the macOS keychain item "Supabase CLI", prefixed `go-keyring-base64:`. Must use curl (Cloudflare 403s Python HTTP clients).

Run:
```bash
TOKEN=$(security find-generic-password -s "Supabase CLI" -w | sed 's/^go-keyring-base64://' | base64 -d)
curl -s -X POST "https://api.supabase.com/v1/projects/gjsiholuyrqrqgyrfewu/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"alter table businesses add column if not exists logo_data_url text;"}'
```
Expected: `[]` (empty result set, no error object).

- [ ] **Step 3: Verify the column exists**

Run:
```bash
curl -s -X POST "https://api.supabase.com/v1/projects/gjsiholuyrqrqgyrfewu/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select column_name, data_type, is_nullable from information_schema.columns where table_name = '"'"'businesses'"'"' and column_name = '"'"'logo_data_url'"'"';"}'
```
Expected: one row: `logo_data_url`, `text`, `YES`.

- [ ] **Step 4: Add the field to the `Business` type**

In `src/lib/types.ts`, the type currently reads:

```ts
export type Business = {
  id: string; name: string; slug: string; address: string; phone: string;
  email: string; paynow_number: string; payee_name: string;
  bank_details: string; payment_terms: string;
  invoice_prefix: string; next_invoice_seq: number;
  archived_at: string | null;
  email_template: string; whatsapp_template: string;
};
```

Change it to:

```ts
export type Business = {
  id: string; name: string; slug: string; address: string; phone: string;
  email: string; paynow_number: string; payee_name: string;
  bank_details: string; payment_terms: string;
  invoice_prefix: string; next_invoice_seq: number;
  archived_at: string | null;
  email_template: string; whatsapp_template: string;
  logo_data_url: string | null;
};
```

- [ ] **Step 5: Type-check and run the existing suite**

Run: `npx tsc --noEmit && npm test`
Expected: tsc silent; all existing vitest suites PASS. (Nothing constructs a full `Business` literal in tests today, so no fixtures need updating — if tsc disagrees, add `logo_data_url: null` to whatever literal it flags.)

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/012_business_logo.sql src/lib/types.ts
git commit -m "feat: add businesses.logo_data_url column for per-business PDF logo"
```

---

### Task 2: `logoImage` helper (TDD on the pure part)

**Files:**
- Create: `src/lib/logoImage.ts`
- Test: `src/lib/logoImage.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces:
  - `fitWithin(w: number, h: number, maxW?: number, maxH?: number): { width: number; height: number }` — pure, exported (defaults 900×300).
  - `fileToLogoDataUrl(file: File): Promise<string>` — browser-only; resolves to a `data:image/png;base64,…` string; rejects with `Error("Please choose an image file")` for non-image MIME types and `Error("Couldn't read that image — try a PNG or JPG")` when decoding fails. Task 3 calls this.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/logoImage.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/logoImage.test.ts`
Expected: FAIL — cannot resolve `./logoImage`.

- [ ] **Step 3: Implement the helper**

```ts
// src/lib/logoImage.ts
// Client-side logo processing for Settings: downscale into a bounded box so
// the stored data URL stays small and the PDF render stays predictable.
// The canvas path is browser-only; keep anything unit-testable pure.

const MAX_W = 900;
const MAX_H = 300;

export function fitWithin(
  w: number,
  h: number,
  maxW = MAX_W,
  maxH = MAX_H,
): { width: number; height: number } {
  if (w <= maxW && h <= maxH) return { width: w, height: h };
  const scale = Math.min(maxW / w, maxH / h);
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

export async function fileToLogoDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file");
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Couldn't read that image — try a PNG or JPG"));
      el.src = url;
    });
    const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't read that image — try a PNG or JPG");
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/logoImage.test.ts`
Expected: 5 tests PASS. Then `npm test` — full suite PASS (the `Image`/canvas code is never executed in node; only `fitWithin` is imported by the test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/logoImage.ts src/lib/logoImage.test.ts
git commit -m "feat: logo image resize helper (fitWithin + canvas data-URL encoder)"
```

---

### Task 3: Logo control in Settings

**Files:**
- Modify: `src/app/settings/page.tsx` (imports at top; state near line 40; new JSX inside the "Business Information" card, between the `FIELDS.map` block ending at line 233 and the invoice-prefix row starting at line 235)

**Interfaces:**
- Consumes: `fileToLogoDataUrl(file: File): Promise<string>` from `@/lib/logoImage` (Task 2); `Business.logo_data_url` (Task 1).
- Produces: `form.logo_data_url` round-trips through the existing `onSave` → `updateBusiness(form.id, form)` path — no new save code. Task 4 relies only on the column being populated, not on anything here.

- [ ] **Step 1: Add the import and ref/handler**

Add to the imports (`IconAdd`, `IconCheck`, etc. are already imported on line 14):

```ts
import { fileToLogoDataUrl } from "@/lib/logoImage";
```

Next to the existing `savedTimeoutRef` declaration (line 40), add:

```ts
const logoInputRef = useRef<HTMLInputElement | null>(null);
```

Below `onSave` (after line 80), add:

```ts
async function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  e.target.value = ""; // allow re-picking the same file
  if (!file || !form) return;
  try {
    const dataUrl = await fileToLogoDataUrl(file);
    setForm({ ...form, logo_data_url: dataUrl });
    setError(null);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Failed to read image");
  }
}
```

- [ ] **Step 2: Add the logo control JSX**

Inside the "Business Information" card, directly after the `{FIELDS.map(…)}` block (line 233) and before the invoice-prefix `<div style={{ display: "flex", gap: 10 }}>` row (line 235), insert:

```tsx
<div>
  <label className="input-label">Logo (shown on invoice PDFs)</label>
  {form.logo_data_url ? (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={form.logo_data_url}
        alt="Business logo"
        style={{
          height: 48, maxWidth: 150, objectFit: "contain",
          borderRadius: "var(--radius-sm)",
          // checkerboard so transparent logos stay visible on any theme
          background:
            "repeating-conic-gradient(var(--border-subtle) 0% 25%, transparent 0% 50%) 0 0 / 12px 12px",
        }}
      />
      <button onClick={() => logoInputRef.current?.click()} className="btn btn-ghost"
        style={{ padding: "4px 10px", fontSize: "0.78rem" }}>
        Change
      </button>
      <button onClick={() => setForm({ ...form, logo_data_url: null })}
        className="btn-danger icon-btn" aria-label="Remove logo">
        <IconTrash size={14} />
      </button>
    </div>
  ) : (
    <button onClick={() => logoInputRef.current?.click()} className="btn btn-secondary icon-btn">
      <IconAdd size={15} /> Upload logo
    </button>
  )}
  <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={onPickLogo} />
  <p style={{ color: "var(--text-tertiary)", fontSize: "0.78rem", marginTop: 6, marginBottom: 0 }}>
    For a crisp PDF, upload an image at least 900px wide. Saved when you press Save Settings.
  </p>
</div>
```

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit && npx next build`
Expected: both succeed. (`useRef` is already imported on line 2.)

- [ ] **Step 4: Manual verification in the dev app**

`pkill -f "next dev"` first (stale dev servers squat on port 3000), then `npm run dev`, sign in, open Settings and verify:
1. "Upload logo" appears in Business Information when no logo is set.
2. Picking `JJ Visuals Logo.png` (repo root) shows a ~150px preview on a checkerboard; nothing is saved yet (reload → control is empty again).
3. Pick again, press **Save Settings** → "Saved"; reload → preview persists.
4. Trash button clears the preview; Save; reload → "Upload logo" is back.
5. Picking a non-image (e.g. a `.json` backup) shows "Please choose an image file" in the red banner.
Re-upload and save the logo before moving on (Task 4's manual check needs it), and confirm the stored value is bounded: in the browser console, `(await (await fetch("...")).text)` is not needed — just check the preview loaded and move on; the 900×300 cap was unit-tested.

- [ ] **Step 5: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat: per-business logo upload in Settings"
```

---

### Task 4: PDFs use the stored logo; retire `public/logo.png`

**Files:**
- Modify: `src/components/InvoiceDetail.tsx:57-90` (delete `fetchLogo`, simplify `generatePdfBlob`)
- Delete: `public/logo.png`

**Interfaces:**
- Consumes: `Business.logo_data_url` (Task 1; populated via Task 3's UI).
- Produces: nothing downstream. `InvoicePdf`'s `logo?: string | null` prop and its text-name fallback are unchanged.

- [ ] **Step 1: Remove `fetchLogo` and use the stored value**

In `src/components/InvoiceDetail.tsx`, delete the whole `fetchLogo` function (lines 57–72):

```ts
async function fetchLogo(): Promise<string | null> {
  try {
    const res = await fetch("/logo.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
```

Then in `generatePdfBlob`, replace:

```ts
    const [qr, logo] = await Promise.all([qrPromise, fetchLogo()]);
    const { pdf } = await import("@react-pdf/renderer");
    const { default: InvoicePdf } = await import("@/components/InvoicePdf");
    const blob = await pdf(
      <InvoicePdf invoice={inv} business={st} qr={qr} logo={logo} variant={variant} />
    ).toBlob();
```

with:

```ts
    const qr = await qrPromise;
    const { pdf } = await import("@react-pdf/renderer");
    const { default: InvoicePdf } = await import("@/components/InvoicePdf");
    const blob = await pdf(
      <InvoicePdf invoice={inv} business={st} qr={qr} logo={st.logo_data_url} variant={variant} />
    ).toBlob();
```

- [ ] **Step 2: Delete the now-unused static logo**

Run: `git rm public/logo.png`
(`grep -rn "logo.png" src` must come back empty afterwards — if anything else references it, stop and reassess.)

- [ ] **Step 3: Type-check, test, build**

Run: `npx tsc --noEmit && npm test && npx next build`
Expected: all pass.

- [ ] **Step 4: Manual verification**

In the dev app (logo saved in Task 3 Step 4): open an invoice → Download PDF → header shows the uploaded logo, sharp. Then in Settings remove the logo, Save, download the same invoice again → header falls back to the business name in text. Re-upload + Save after.

- [ ] **Step 5: Commit**

```bash
git add src/components/InvoiceDetail.tsx public/logo.png
git commit -m "feat: invoice PDFs use the per-business uploaded logo"
```

---

### Task 5: Ship

**Files:** none new.

**Interfaces:** n/a.

- [ ] **Step 1: Push to production**

Run: `git push origin main`
Expected: Vercel auto-deploys `main`.

- [ ] **Step 2: Post-deploy hand-off (tell the user)**

Production has no logo until one is uploaded: on the deployed app, Settings → Business Information → Upload logo → pick the high-res `JJ Visuals Logo.png` (repo root) → Save Settings → download any invoice PDF to confirm. Mention that the repo-root `JJ Visuals Logo.png` can be deleted afterwards if they're done with it.
