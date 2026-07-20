# Multi-Business Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce "business" as a first-class concept in the invoice app, so the owner's photography, 3D printing, and gear rental businesses each get independent customers, invoices, presets, payment details, and invoice numbering under one login.

**Architecture:** A new `businesses` table becomes the scoping key for `customers`, `invoices`, and `presets` (each gains a `business_id` FK). The single-row `settings` table is retired — its columns move onto `businesses` rows. A client-side `BusinessProvider` React context tracks which business is "active" (persisted in `localStorage`, matching the existing `formStorage.ts`/`OnboardingBanner` pattern of client-only persistence — no server component in this app currently reads request state, so a cookie isn't needed). Every screen filters its Supabase queries by the active business's `id`, except `InvoiceDetail`, which resolves the business from the invoice's own `business_id` regardless of what's active in the nav.

**Tech Stack:** Next.js 16 (App Router), React 19, Supabase (Postgres + `@supabase/ssr` browser client), Vitest for unit tests. No new dependencies.

## Global Constraints

- RLS stays scoped to the single owner account (`auth.jwt()->>'email' = 'chuajiajun2705@gmail.com'`) on every table — `business_id` is a data filter, not a new authorization boundary.
- No hard delete of businesses. Only `archived_at` soft-delete (DB enforces this structurally: `business_id` FKs use the default `NO ACTION` behavior, which blocks deleting a referenced business).
- Follow existing code conventions exactly: lowercase SQL in migrations, the `ok()` result-unwrapping pattern in `src/lib/db.ts`, native `<select>` elements for pickers (no custom dropdown component), inline `style={{}}` objects (no CSS-in-JS library), plain `useState`/`useEffect` data fetching (no react-query/SWR).
- All existing data (current JJ Visuals customers/invoices/presets) must migrate with zero data loss and continue working identically after migration.

---

### Task 1: Database migration — `businesses` table and backfill

**Files:**
- Create: `supabase/migrations/003_businesses.sql`

**Interfaces:**
- Produces: `businesses` table (`id uuid`, `name text`, `slug text unique`, `address text`, `phone text`, `email text`, `paynow_number text`, `payee_name text`, `bank_details text`, `payment_terms text`, `invoice_prefix text`, `next_invoice_seq int`, `archived_at timestamptz | null`, `created_at timestamptz`). `customers.business_id`, `invoices.business_id`, `presets.business_id` (all `uuid not null references businesses(id)`). `finalize_invoice(inv_id)` and `delete_invoice_rewind(inv_id)` RPCs now scope to the invoice's own business instead of the retired `settings` table. `settings` table is dropped.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/003_businesses.sql
-- Multi-business foundation: a businesses table becomes the scoping key
-- for customers/invoices/presets. The single-row settings table (which
-- held nothing but business-specific fields) is retired in favor of it.

create table businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  address text not null default '',
  phone text not null default '',
  email text not null default '',
  paynow_number text not null default '',
  payee_name text not null default '',
  bank_details text not null default '',
  payment_terms text not null default 'paynow within 30 days of invoice',
  invoice_prefix text not null default 'A-',
  next_invoice_seq int not null default 1,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

alter table businesses enable row level security;
create policy owner_businesses on businesses for all to authenticated
  using ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com')
  with check ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com');

-- Seed the one existing business from the current settings row.
insert into businesses (name, slug, address, phone, email, paynow_number,
  payee_name, bank_details, payment_terms, invoice_prefix, next_invoice_seq)
select business_name, 'photography', address, phone, email, paynow_number,
  payee_name, bank_details, payment_terms, invoice_prefix, next_invoice_seq
from settings where id = 1;

-- Add business_id to every business-scoped table, backfill it to the one
-- business that exists at this point in the migration, then lock it down.
alter table customers add column business_id uuid references businesses(id);
alter table invoices add column business_id uuid references businesses(id);
alter table presets add column business_id uuid references businesses(id);

update customers set business_id = (select id from businesses limit 1);
update invoices set business_id = (select id from businesses limit 1);
update presets set business_id = (select id from businesses limit 1);

alter table customers alter column business_id set not null;
alter table invoices alter column business_id set not null;
alter table presets alter column business_id set not null;

drop table settings;

-- Re-point finalize_invoice at businesses instead of the retired settings
-- table, scoped by the invoice's own business rather than a single global row.
create or replace function finalize_invoice(inv_id uuid)
returns text
language plpgsql
security invoker
as $$
declare
  num text;
  biz_id uuid;
begin
  select business_id into biz_id from invoices where id = inv_id;
  if biz_id is null then
    raise exception 'invoice % not found', inv_id;
  end if;

  update businesses
     set next_invoice_seq = next_invoice_seq + 1
   where id = biz_id
  returning invoice_prefix || (next_invoice_seq - 1)::text into num;

  update invoices
     set invoice_number = num, status = 'unpaid', updated_at = now()
   where id = inv_id and status = 'draft';

  if not found then
    raise exception 'invoice % is not a draft', inv_id;
  end if;

  return num;
end;
$$;

-- Same re-pointing for the delete/rewind RPC.
create or replace function delete_invoice_rewind(inv_id uuid)
returns boolean
language plpgsql
security invoker
as $$
declare
  num text;
  biz_id uuid;
  pref text;
  seq int;
  rewound boolean := false;
begin
  select invoice_number, business_id into num, biz_id from invoices where id = inv_id for update;

  if not found then
    raise exception 'invoice % not found', inv_id;
  end if;

  delete from invoices where id = inv_id;

  if num is not null then
    select invoice_prefix, next_invoice_seq into pref, seq
      from businesses where id = biz_id for update;
    if num = pref || (seq - 1)::text then
      update businesses set next_invoice_seq = seq - 1 where id = biz_id;
      rewound := true;
    end if;
  end if;

  return rewound;
end;
$$;
```

- [ ] **Step 2: Apply the migration to the live Supabase project**

There is no linked `supabase` CLI project (`supabase/config.toml` doesn't exist — prior migrations were applied by hand). Apply this one the same way, via the Management API query endpoint. The access token lives in the macOS keychain item `"Supabase CLI"` (value is prefixed `go-keyring-base64:`, base64-decode after stripping that prefix):

```bash
TOKEN=$(security find-generic-password -s "Supabase CLI" -w | sed 's/^go-keyring-base64://' | base64 -d)
SQL=$(cat supabase/migrations/003_businesses.sql)
curl -s -X POST "https://api.supabase.com/v1/projects/gjsiholuyrqrqgyrfewu/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  --data-binary @<(python3 -c "import json,sys; print(json.dumps({'query': open('supabase/migrations/003_businesses.sql').read()}))")
```

Expected: `[]` (empty array — no error). If it returns an object with a `message` field instead, the migration failed; read the message, fix the SQL, and re-run from a clean project state (the migration is not written to be re-run partially — if it fails partway, check which statements succeeded before retrying).

- [ ] **Step 3: Verify the migration**

```bash
TOKEN=$(security find-generic-password -s "Supabase CLI" -w | sed 's/^go-keyring-base64://' | base64 -d)
curl -s -X POST "https://api.supabase.com/v1/projects/gjsiholuyrqrqgyrfewu/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select b.name, b.slug, b.next_invoice_seq, (select count(*) from customers c where c.business_id = b.id) as customers, (select count(*) from invoices i where i.business_id = b.id) as invoices from businesses b;"}'
```

Expected: one row, `name` "JJ Visuals" (or whatever `business_name` was), `slug` "photography", `customers`/`invoices` counts matching the pre-migration row counts (sanity-check against `select count(*) from customers` / `from invoices` if unsure).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/003_businesses.sql
git commit -m "feat: add businesses table, scope customers/invoices/presets to it"
```

---

### Task 2: Types — `Business`, and `business_id` on scoped types

**Files:**
- Modify: `src/lib/types.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Business` type (replaces `Settings`). `Customer`, `Preset`, `Invoice` each gain `business_id: string`.

- [ ] **Step 1: Replace the `Settings` type with `Business`, and add `business_id` to the other types**

Replace the full contents of `src/lib/types.ts` with:

```typescript
import type { DiscountType, LineItem } from "./money";

export type Customer = {
  id: number; business_id: string; name: string; phone: string; email: string; address: string;
};

export type Preset = {
  id: string; business_id: string; name: string; description: string;
  unit_price_cents: number; default_qty: number;
};

export type InvoiceStatus = "draft" | "unpaid" | "paid";

export type Invoice = {
  id: string;
  business_id: string;
  invoice_number: string | null;
  status: InvoiceStatus;
  issue_date: string;            // ISO date
  customer_id: number | null;
  job_event: string;
  job_date: string;
  job_location: string;
  line_items: LineItem[];
  discount_type: DiscountType;
  discount_value: number;
  subtotal_cents: number;
  total_cents: number;
  paid_date: string | null;
  customers?: Customer | null;   // joined
};

export type Business = {
  id: string; name: string; slug: string; address: string; phone: string;
  email: string; paynow_number: string; payee_name: string;
  bank_details: string; payment_terms: string;
  invoice_prefix: string; next_invoice_seq: number;
  archived_at: string | null;
};

export function isOverdue(inv: Invoice, today = new Date()): boolean {
  if (inv.status !== "unpaid") return false;
  const due = new Date(inv.issue_date);
  due.setDate(due.getDate() + 30);
  return today > due;
}
```

- [ ] **Step 2: Confirm it compiles (errors expected — later tasks fix them)**

```bash
npx tsc --noEmit
```

Expected: errors in `src/lib/db.ts`, `src/app/settings/page.tsx`, `src/components/InvoiceDetail.tsx`, `src/components/InvoicePdf.tsx` referencing the removed `Settings`/`getSettings`/`saveSettings` names. This is expected — those are fixed in later tasks. Confirm there are no errors in `src/lib/types.ts` itself.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: replace Settings type with Business, add business_id to scoped types"
```

---

### Task 3: `slugify` helper (pure function, TDD)

**Files:**
- Create: `src/lib/slug.ts`
- Test: `src/lib/slug.test.ts`

**Interfaces:**
- Produces: `slugify(name: string): string` — used by Task 8 (Settings "Add business" form) to auto-derive a `slug` from the business name the owner types, so they never have to think about slugs directly.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/slug.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/slug.test.ts`
Expected: FAIL — `Cannot find module './slug'`

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/slug.ts
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/slug.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/slug.ts src/lib/slug.test.ts
git commit -m "feat: add slugify helper for auto-deriving business slugs"
```

---

### Task 4: `db.ts` — business-scoped queries and business CRUD

**Files:**
- Modify: `src/lib/db.ts`

**Interfaces:**
- Consumes: `Business` type from Task 2.
- Produces: `listBusinesses(): Promise<Business[]>`, `getBusiness(id: string): Promise<Business>`, `createBusiness(input: { name: string; slug: string }): Promise<Business>`, `updateBusiness(id: string, patch: Partial<Business>): Promise<void>`, `archiveBusiness(id: string): Promise<void>`. `listCustomers(businessId: string)`, `createCustomer(c, businessId: string)`, `listPresets(businessId: string)`, `createPreset(p, businessId: string)`, `listInvoices(businessId?: string)` (omit to get all businesses' invoices — used by the Stats "All businesses" view), `saveInvoiceDraft(draft, businessId: string)` (only used on create; `businessId` is ignored on update since it can't change).

- [ ] **Step 1: Replace `src/lib/db.ts` in full**

```typescript
import { createClient } from "@/lib/supabase/client";
import { subtotalCents, totalCents } from "@/lib/money";
import type { Business, Customer, Invoice, Preset } from "@/lib/types";

const db = () => createClient();

function ok<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export async function listBusinesses(): Promise<Business[]> {
  return ok(await db().from("businesses").select("*").order("created_at"));
}
export async function getBusiness(id: string): Promise<Business> {
  return ok(await db().from("businesses").select("*").eq("id", id).single());
}
export async function createBusiness(input: { name: string; slug: string }): Promise<Business> {
  return ok(await db().from("businesses").insert(input).select().single());
}
export async function updateBusiness(id: string, patch: Partial<Business>): Promise<void> {
  ok(await db().from("businesses").update(patch).eq("id", id).select().single());
}
export async function archiveBusiness(id: string): Promise<void> {
  ok(await db().from("businesses").update({ archived_at: new Date().toISOString() }).eq("id", id).select().single());
}

export async function listCustomers(businessId: string): Promise<Customer[]> {
  return ok(await db().from("customers").select("*").eq("business_id", businessId).order("name"));
}
export async function createCustomer(c: Omit<Customer, "id" | "business_id">, businessId: string): Promise<Customer> {
  return ok(await db().from("customers").insert({ ...c, business_id: businessId }).select().single());
}
export async function updateCustomer(id: number, patch: Partial<Customer>): Promise<void> {
  ok(await db().from("customers").update(patch).eq("id", id).select().single());
}

export async function listPresets(businessId: string): Promise<Preset[]> {
  return ok(await db().from("presets").select("*").eq("business_id", businessId).order("name"));
}
export async function createPreset(p: Omit<Preset, "id" | "business_id">, businessId: string): Promise<Preset> {
  return ok(await db().from("presets").insert({ ...p, business_id: businessId }).select().single());
}
export async function deletePreset(id: string): Promise<void> {
  ok(await db().from("presets").delete().eq("id", id).select());
}

const INVOICE_SELECT = "*, customers(*)";

/** Omit businessId to list invoices across every business (used by the
 *  Stats "All businesses" view). */
export async function listInvoices(businessId?: string): Promise<Invoice[]> {
  let q = db().from("invoices").select(INVOICE_SELECT).order("created_at", { ascending: false });
  if (businessId) q = q.eq("business_id", businessId);
  return ok(await q);
}
export async function getInvoice(id: string): Promise<Invoice> {
  return ok(await db().from("invoices").select(INVOICE_SELECT).eq("id", id).single());
}

export type DraftInput = Pick<Invoice,
  "issue_date" | "customer_id" | "job_event" | "job_date" | "job_location" |
  "line_items" | "discount_type" | "discount_value"> & { id?: string };

/** businessId is required when creating a new draft (draft.id is unset);
 *  ignored when updating an existing one, since an invoice's business
 *  never changes after creation. */
export async function saveInvoiceDraft(draft: DraftInput, businessId: string): Promise<Invoice> {
  const computed = {
    ...draft,
    subtotal_cents: subtotalCents(draft.line_items),
    total_cents: totalCents(draft.line_items, draft.discount_type, draft.discount_value),
    updated_at: new Date().toISOString(),
  };
  if (draft.id) {
    return ok(await db().from("invoices").update(computed).eq("id", draft.id).select(INVOICE_SELECT).single());
  }
  return ok(await db().from("invoices").insert({ ...computed, business_id: businessId }).select(INVOICE_SELECT).single());
}

export async function finalizeInvoice(id: string): Promise<string> {
  return ok(await db().rpc("finalize_invoice", { inv_id: id }));
}

export async function setPaid(id: string, paid: boolean): Promise<void> {
  ok(await db().from("invoices").update({
    status: paid ? "paid" : "unpaid",
    paid_date: paid ? new Date().toISOString().slice(0, 10) : null,
  }).eq("id", id).select().single());
}

/** Deletes an invoice. If it held the most recently issued number, the
 *  sequence rewinds so that number is reused. Returns true when rewound. */
export async function deleteInvoice(id: string): Promise<boolean> {
  return ok(await db().rpc("delete_invoice_rewind", { inv_id: id }));
}
```

- [ ] **Step 2: Confirm `db.ts` itself compiles**

```bash
npx tsc --noEmit 2>&1 | grep "src/lib/db.ts"
```

Expected: no output (no errors in this file). Errors in *other* files that call these functions with the old signatures are expected — fixed in later tasks.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat: scope db.ts queries by business_id, add business CRUD"
```

---

### Task 5: Business switcher icon

**Files:**
- Modify: `src/components/icons.tsx`

**Interfaces:**
- Produces: `IconChevronDown({ size, className })` — used by Task 7 (NavBar switcher).

- [ ] **Step 1: Add the icon, following the file's existing pattern**

Append to `src/components/icons.tsx` (after the last icon, `IconSignOut`):

```typescript
export function IconChevronDown({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...base}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep "icons.tsx"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/icons.tsx
git commit -m "feat: add chevron-down icon for business switcher"
```

---

### Task 6: `BusinessProvider` context

**Files:**
- Create: `src/lib/businessContext.tsx`

**Interfaces:**
- Consumes: `listBusinesses` from `src/lib/db.ts` (Task 4), `Business` from `src/lib/types.ts` (Task 2).
- Produces: `BusinessProvider({ children })` component, `useBusiness(): { businesses: Business[]; activeBusiness: Business | null; setActiveBusinessId: (id: string) => void; reloadBusinesses: () => Promise<void> }` hook. Every later screen-level task (7, 8, 9, 10, 12) consumes `useBusiness()`.

- [ ] **Step 1: Write the provider**

```typescript
// src/lib/businessContext.tsx
"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { listBusinesses } from "@/lib/db";
import type { Business } from "@/lib/types";

const STORAGE_KEY = "jjv.activeBusinessId";

type BusinessContextValue = {
  businesses: Business[];
  activeBusiness: Business | null;
  setActiveBusinessId: (id: string) => void;
  reloadBusinesses: () => Promise<void>;
};

const BusinessContext = createContext<BusinessContextValue | null>(null);

export function BusinessProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBusinessId, setActiveBusinessIdState] = useState<string | null>(null);

  async function reloadBusinesses() {
    const list = await listBusinesses();
    setBusinesses(list);
    setActiveBusinessIdState((current) => {
      const active = list.filter((b) => !b.archived_at);
      if (current && active.some((b) => b.id === current)) return current;
      const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (stored && active.some((b) => b.id === stored)) return stored;
      return active[0]?.id ?? null;
    });
  }

  useEffect(() => {
    if (pathname.startsWith("/login")) return;
    reloadBusinesses().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname.startsWith("/login")]);

  function setActiveBusinessId(id: string) {
    setActiveBusinessIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }

  const activeBusiness = businesses.find((b) => b.id === activeBusinessId) ?? null;

  return (
    <BusinessContext.Provider value={{ businesses, activeBusiness, setActiveBusinessId, reloadBusinesses }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness(): BusinessContextValue {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error("useBusiness must be used within BusinessProvider");
  return ctx;
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep "businessContext.tsx"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/lib/businessContext.tsx
git commit -m "feat: add BusinessProvider context for active-business selection"
```

---

### Task 7: Wire `BusinessProvider` into the app + NavBar switcher

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/components/NavBar.tsx`

**Interfaces:**
- Consumes: `BusinessProvider`, `useBusiness` from Task 6; `IconChevronDown` from Task 5.

- [ ] **Step 1: Wrap the app in `BusinessProvider`**

In `src/app/layout.tsx`, add the import and wrap `<NavBar />` + `{children}`:

```typescript
import BusinessProvider from "@/lib/businessContext"; // WRONG — see note below
```

`businessContext.tsx` exports `BusinessProvider` as a named export, not default. Add:

```typescript
import { BusinessProvider } from "@/lib/businessContext";
```

to the top of `src/app/layout.tsx` alongside the existing imports, then change the `<body>` contents from:

```typescript
      <body className="min-h-full flex flex-col">
        <NavBar />
        {children}
      </body>
```

to:

```typescript
      <body className="min-h-full flex flex-col">
        <BusinessProvider>
          <NavBar />
          {children}
        </BusinessProvider>
      </body>
```

- [ ] **Step 2: Add the switcher to `NavBar`**

Replace the full contents of `src/components/NavBar.tsx`:

```typescript
"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useBusiness } from "@/lib/businessContext";
import { IconAdd, IconCamera, IconChart, IconSettings, IconSignOut } from "@/components/icons";

const links = [
  { href: "/", label: "Invoices", Icon: IconCamera },
  { href: "/invoices/new", label: "New", Icon: IconAdd },
  { href: "/stats", label: "Stats", Icon: IconChart },
  { href: "/settings", label: "Settings", Icon: IconSettings },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { businesses, activeBusiness, setActiveBusinessId } = useBusiness();
  if (pathname.startsWith("/login")) return null;

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const activeBusinesses = businesses.filter((b) => !b.archived_at);

  return (
    <nav className="nav">
      <span className="nav-brand">
        <IconCamera size={18} />
        {activeBusinesses.length > 1 ? (
          <select
            className="nav-business-switcher"
            aria-label="Active business"
            value={activeBusiness?.id ?? ""}
            onChange={(e) => {
              if (e.target.value === "__add__") router.push("/settings");
              else setActiveBusinessId(e.target.value);
            }}
          >
            {activeBusinesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            <option value="__add__">+ Add business…</option>
          </select>
        ) : (
          <span className="hidden sm:inline">{activeBusiness?.name ?? "…"}</span>
        )}
      </span>
      {links.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} aria-label={l.label}
            className={`nav-link icon-btn ${active ? "nav-link-active" : ""}`}>
            <l.Icon size={15} />
            <span className="hidden sm:inline">{l.label}</span>
          </Link>
        );
      })}
      <button onClick={signOut} className="btn-ghost icon-btn ml-auto" aria-label="Sign out">
        <IconSignOut size={16} />
        <span className="hidden sm:inline">Sign out</span>
      </button>
    </nav>
  );
}
```

Note: `IconChevronDown` (Task 5) turned out not to be needed here — a native `<select>` renders its own dropdown arrow. Skip importing it in `NavBar.tsx`; it stays available in `icons.tsx` for use in Task 8's business list if a visual affordance is wanted there. If Task 8 ends up not using it either, that's fine — it's a small, self-contained icon following the file's existing pattern, not dead-code risk worth reverting Task 5 over.

- [ ] **Step 3: Add a minimal style for the switcher**

In `src/app/globals.css`, find the `.nav-brand` rule (search for it) and add immediately after it:

```css
.nav-business-switcher {
  background: transparent;
  border: none;
  color: inherit;
  font: inherit;
  font-weight: inherit;
  padding: 2px 4px;
  cursor: pointer;
}
.nav-business-switcher:focus-visible {
  outline: 2px solid var(--accent);
  border-radius: var(--radius-sm);
}
```

- [ ] **Step 4: Verify it compiles and run the dev server for a manual check**

```bash
npx tsc --noEmit 2>&1 | grep -E "layout.tsx|NavBar.tsx"
```

Expected: no output.

```bash
npm run dev &
sleep 3 && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
```

Expected: `200` (or a redirect to `/login`, both fine — confirms the server boots without a crash from the provider wiring). Stop the dev server afterward: `pkill -f "next dev"`.

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/components/NavBar.tsx src/app/globals.css
git commit -m "feat: wire BusinessProvider into layout, add nav business switcher"
```

---

### Task 8: Settings — business management + scope existing form to active business

**Files:**
- Modify: `src/app/settings/page.tsx`

**Interfaces:**
- Consumes: `useBusiness` (Task 6/7), `updateBusiness`, `createBusiness`, `archiveBusiness` (Task 4), `listPresets`/`createPreset`/`deletePreset` now require `businessId` (Task 4), `slugify` (Task 3).

- [ ] **Step 1: Replace the full contents of `src/app/settings/page.tsx`**

```typescript
"use client";
import { useEffect, useRef, useState } from "react";
import { createBusiness, archiveBusiness, updateBusiness, listPresets, createPreset, deletePreset } from "@/lib/db";
import { useBusiness } from "@/lib/businessContext";
import { slugify } from "@/lib/slug";
import { formatSGD } from "@/lib/money";
import type { Business, Preset } from "@/lib/types";
import { IconAdd, IconCheck, IconTrash } from "@/components/icons";

const FIELDS: Array<{ key: keyof Business; label: string }> = [
  { key: "name", label: "Business name" },
  { key: "address", label: "Address" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "paynow_number", label: "PayNow number" },
  { key: "payee_name", label: "Payee name (for cheques)" },
  { key: "bank_details", label: "Bank details" },
];

export default function SettingsPage() {
  const { businesses, activeBusiness, setActiveBusinessId, reloadBusinesses } = useBusiness();
  const [form, setForm] = useState<Business | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [saved, setSaved] = useState(false);
  const [np, setNp] = useState({ name: "", description: "", price: "", qty: "1" });
  const [newBizName, setNewBizName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setForm(activeBusiness);
    if (activeBusiness) {
      listPresets(activeBusiness.id).then(setPresets).catch((e) => setError(e instanceof Error ? e.message : "Failed to load presets"));
    }
  }, [activeBusiness]);

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  if (!activeBusiness || !form) return (
    <div className="page-container">
      <p style={{ color: error ? "var(--warning)" : "var(--text-tertiary)" }}>
        {error || "Loading…"}
      </p>
    </div>
  );

  async function onSave() {
    try {
      await updateBusiness(form!.id, form!);
      await reloadBusinesses();
      setSaved(true);
      setError(null);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings");
    }
  }

  async function onAddBusiness() {
    if (!newBizName.trim()) return;
    try {
      const b = await createBusiness({ name: newBizName.trim(), slug: slugify(newBizName) });
      setNewBizName("");
      await reloadBusinesses();
      setActiveBusinessId(b.id);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add business");
    }
  }

  async function onArchiveBusiness(b: Business) {
    if (!confirm(`Archive "${b.name}"? Its invoices stay accessible, but it'll drop out of the switcher.`)) return;
    try {
      await archiveBusiness(b.id);
      await reloadBusinesses();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to archive business");
    }
  }

  async function onAddPreset() {
    const price = parseFloat(np.price || "0");
    const qty = parseFloat(np.qty || "1");
    if (Number.isNaN(price) || price < 0) {
      setError("Unit price must be a valid non-negative number");
      return;
    }
    if (Number.isNaN(qty) || qty <= 0) {
      setError("Quantity must be a valid positive number");
      return;
    }
    try {
      const p = await createPreset({
        name: np.name, description: np.description,
        unit_price_cents: Math.round(price * 100),
        default_qty: qty,
      }, activeBusiness.id);
      setPresets([...presets, p]);
      setNp({ name: "", description: "", price: "", qty: "1" });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add preset");
    }
  }

  async function onDeletePreset(p: Preset) {
    if (!confirm(`Delete preset "${p.name}"?`)) return;
    try {
      await deletePreset(p.id);
      setPresets(presets.filter((x) => x.id !== p.id));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete preset");
    }
  }

  return (
    <main className="page-container animate-fade-in">
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">Manage your businesses, profile, and service presets</p>

      {error && (
        <div style={{
          background: "var(--warning-bg)",
          color: "var(--warning)",
          padding: "10px 14px",
          borderRadius: "var(--radius-sm)",
          fontSize: "0.85rem",
          fontWeight: 600,
          marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {/* Businesses */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-label">Businesses</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {businesses.filter((b) => !b.archived_at).map((b) => (
            <div key={b.id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: "var(--radius-md)",
              background: b.id === activeBusiness.id ? "var(--accent-bg)" : "var(--bg-primary)",
              border: "1px solid var(--border-subtle)",
            }}>
              <span style={{ flex: 1, fontWeight: 600, fontSize: "0.9rem" }}>{b.name}</span>
              {b.id !== activeBusiness.id && (
                <button onClick={() => setActiveBusinessId(b.id)} className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: "0.78rem" }}>
                  Switch to
                </button>
              )}
              {businesses.filter((x) => !x.archived_at).length > 1 && (
                <button onClick={() => onArchiveBusiness(b)} className="btn-danger icon-btn" aria-label={`Archive ${b.name}`}>
                  <IconTrash size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="input" placeholder="New business name (e.g. 3D Printing)"
            value={newBizName} onChange={(e) => setNewBizName(e.target.value)} />
          <button onClick={onAddBusiness} disabled={!newBizName.trim()} className="btn btn-secondary icon-btn">
            <IconAdd size={15} /> Add
          </button>
        </div>
      </div>

      {/* Business info */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-label">Business Information — {activeBusiness.name}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label className="input-label">{label}</label>
              <input className="input"
                value={String(form[key] ?? "")}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            </div>
          ))}
        </div>
        <button onClick={onSave} className={`btn icon-btn ${saved ? "btn-accent" : "btn-primary"}`}
          style={{ marginTop: 16 }}>
          {saved && <IconCheck size={15} />} {saved ? "Saved" : "Save Settings"}
        </button>
      </div>

      {/* Service presets */}
      <div className="card">
        <div className="section-label">Service Presets — {activeBusiness.name}</div>

        {presets.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {presets.map((p) => (
              <div key={p.id} style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                borderRadius: "var(--radius-md)",
                background: "var(--bg-primary)",
                border: "1px solid var(--border-subtle)",
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{p.name}</div>
                  {p.description && (
                    <div style={{ color: "var(--text-tertiary)", fontSize: "0.8rem", marginTop: 2 }}>
                      {p.description}
                    </div>
                  )}
                </div>
                <div className="money" style={{ fontWeight: 700, fontSize: "0.9rem", whiteSpace: "nowrap" }}>
                  {formatSGD(p.unit_price_cents)}
                </div>
                <button onClick={() => onDeletePreset(p)} className="btn-danger icon-btn" aria-label={`Delete preset ${p.name}`}>
                  <IconTrash size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* New preset form */}
        <div style={{
          background: "var(--bg-primary)",
          border: "1px dashed var(--border-default)",
          borderRadius: "var(--radius-md)",
          padding: 16,
        }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12 }}>
            Add new preset
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input className="input" placeholder="Name (e.g. Photo & Video, no edit)"
              value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} />
            <input className="input" placeholder="Description (optional)"
              value={np.description} onChange={(e) => setNp({ ...np, description: e.target.value })} />
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label className="input-label">Unit price ($)</label>
                <input className="input" placeholder="0.00" inputMode="decimal"
                  value={np.price} onChange={(e) => setNp({ ...np, price: e.target.value })} />
              </div>
              <div style={{ width: 100 }}>
                <label className="input-label">Default qty</label>
                <input className="input" placeholder="1" inputMode="decimal"
                  value={np.qty} onChange={(e) => setNp({ ...np, qty: e.target.value })} />
              </div>
            </div>
            <button onClick={onAddPreset} disabled={!np.name || !np.price}
              className="btn btn-secondary icon-btn" style={{ alignSelf: "flex-start" }}>
              <IconAdd size={15} /> Add Preset
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
```

Note: `var(--accent-bg)` is used above for the active-business row highlight — check `src/app/globals.css` for whether this token already exists (`grep -n "\-\-accent-bg" src/app/globals.css`). If it doesn't, substitute `var(--bg-primary)` with a `border: 1px solid var(--accent)` instead, to avoid introducing an undefined CSS variable.

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep "settings/page.tsx"
```

Expected: no output.

- [ ] **Step 3: Manual check with the dev server**

```bash
npm run dev &
sleep 3
```

Open `http://localhost:3000/settings` in a browser (or use the `webapp-testing` skill's Playwright tooling if available). Confirm: existing business info loads and pre-fills correctly under "JJ Visuals", existing presets still list, adding a new business works and switches the active business, the newly added business's Settings shows empty fields ready to fill in. Then:

```bash
pkill -f "next dev"
```

- [ ] **Step 4: Commit**

```bash
git add src/app/settings/page.tsx src/app/globals.css
git commit -m "feat: business management + active-business scoping in Settings"
```

---

### Task 9: Dashboard — scope to active business

**Files:**
- Modify: `src/components/Dashboard.tsx`

**Interfaces:**
- Consumes: `useBusiness` (Task 6/7); `listInvoices(businessId)` (Task 4) now takes the active business's `id`.

- [ ] **Step 1: Scope the invoice fetch to the active business**

In `src/components/Dashboard.tsx`, add the import and use the hook. Change:

```typescript
import { deleteInvoice, listInvoices, setPaid } from "@/lib/db";
```

to:

```typescript
import { deleteInvoice, listInvoices, setPaid } from "@/lib/db";
import { useBusiness } from "@/lib/businessContext";
```

Change the component body's opening (lines 11-22 currently):

```typescript
export default function Dashboard() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    listInvoices()
      .then(setInvoices)
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Something went wrong");
      });
  }, []);
```

to:

```typescript
export default function Dashboard() {
  const { activeBusiness } = useBusiness();
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!activeBusiness) return;
    setInvoices(null);
    listInvoices(activeBusiness.id)
      .then(setInvoices)
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Something went wrong");
      });
  }, [activeBusiness]);
```

(`setInvoices(null)` on business change re-shows the loading state while the new business's invoices load, instead of flashing the old business's list.)

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep "Dashboard.tsx"
```

Expected: no output.

- [ ] **Step 3: Manual check**

```bash
npm run dev &
sleep 3
```

Open `http://localhost:3000/`, confirm existing invoices still list under JJ Visuals. Switch business in the nav (if a second business exists from Task 8's manual check) and confirm the dashboard shows an empty state for it, not JJ Visuals' invoices.

```bash
pkill -f "next dev"
```

- [ ] **Step 4: Commit**

```bash
git add src/components/Dashboard.tsx
git commit -m "feat: scope Dashboard invoice list to active business"
```

---

### Task 10: InvoiceForm — resolve business, scope customers/presets

**Files:**
- Modify: `src/components/InvoiceForm.tsx`

**Interfaces:**
- Consumes: `useBusiness` (Task 6/7). `listCustomers`/`listPresets` now require a `businessId` (Task 4). `saveInvoiceDraft` now requires a `businessId` (Task 4).
- Decision: when editing an existing draft/duplicating an invoice, the form uses **that invoice's own `business_id`** (fetched via `getInvoice`), not whatever is currently active in the nav — matching the design principle that an invoice already knows its business. For a brand-new invoice (`!draftId && !duplicateId`), the form uses whichever business was active **when the page was opened**, and does not silently follow later nav switches — per the design spec's "warn before discarding" edge case, the safest and simplest way to never corrupt an in-progress draft is to not let the business under it change at all while it's open. If the owner switches business in the nav mid-draft, that only takes effect the next time they open `/invoices/new` fresh; this page's in-progress draft keeps its original business until saved or abandoned.

- [ ] **Step 1: Add business resolution state and scope the customer/preset fetch**

In `src/components/InvoiceForm.tsx`, add the import:

```typescript
import { useBusiness } from "@/lib/businessContext";
```

Change the top of the component (currently lines 12-48) from:

```typescript
export default function InvoiceForm({ duplicateId, draftId }: { duplicateId?: string; draftId?: string }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [busy, setBusy] = useState<"" | "draft" | "final">("");
  const [error, setError] = useState<string | null>(null);
  const [loadedStatus, setLoadedStatus] = useState<"draft" | "unpaid" | "paid">("draft");
  const [loadedNumber, setLoadedNumber] = useState<string | null>(null);

  useEffect(() => {
    listCustomers().then(setCustomers).catch((e) => setError(e instanceof Error ? e.message : "Failed to load customers"));
    listPresets().then(setPresets).catch((e) => setError(e instanceof Error ? e.message : "Failed to load presets"));
    (async () => {
      if (draftId) {
        const inv = await getInvoice(draftId);
        setLoadedStatus(inv.status);
        setLoadedNumber(inv.invoice_number);
        setForm({
          invoiceId: inv.id, issueDate: inv.issue_date, customerId: inv.customer_id,
          newCustomer: null, jobEvent: inv.job_event, jobDate: inv.job_date,
          jobLocation: inv.job_location, lineItems: inv.line_items,
          discountType: inv.discount_type, discountValue: inv.discount_value,
        });
      } else if (duplicateId) {
        const inv = await getInvoice(duplicateId);
        setForm({
          ...emptyForm(), customerId: inv.customer_id, jobEvent: inv.job_event,
          jobDate: inv.job_date, jobLocation: inv.job_location,
          lineItems: inv.line_items, discountType: inv.discount_type,
          discountValue: inv.discount_value,
        });
      } else {
        setForm(loadForm() ?? emptyForm());
      }
    })().catch((e) => setError(e instanceof Error ? e.message : "Failed to load invoice"));
  }, [draftId, duplicateId]);
```

to:

```typescript
export default function InvoiceForm({ duplicateId, draftId }: { duplicateId?: string; draftId?: string }) {
  const router = useRouter();
  const { activeBusiness } = useBusiness();
  const [form, setForm] = useState<FormState | null>(null);
  const [formBusinessId, setFormBusinessId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [busy, setBusy] = useState<"" | "draft" | "final">("");
  const [error, setError] = useState<string | null>(null);
  const [loadedStatus, setLoadedStatus] = useState<"draft" | "unpaid" | "paid">("draft");
  const [loadedNumber, setLoadedNumber] = useState<string | null>(null);

  // Resolves which business this form belongs to and loads its initial
  // content. For a brand-new invoice, this intentionally does NOT list
  // `activeBusiness` in its dependency array — it captures whichever
  // business is active at the moment this effect first runs (component
  // mount, or draftId/duplicateId changing to load a *different* existing
  // invoice) and then ignores later nav switches, so an in-progress draft's
  // business can never change out from under the owner mid-edit. See the
  // Task 10 header note above for the reasoning.
  useEffect(() => {
    (async () => {
      if (draftId) {
        const inv = await getInvoice(draftId);
        setFormBusinessId(inv.business_id);
        setLoadedStatus(inv.status);
        setLoadedNumber(inv.invoice_number);
        setForm({
          invoiceId: inv.id, issueDate: inv.issue_date, customerId: inv.customer_id,
          newCustomer: null, jobEvent: inv.job_event, jobDate: inv.job_date,
          jobLocation: inv.job_location, lineItems: inv.line_items,
          discountType: inv.discount_type, discountValue: inv.discount_value,
        });
      } else if (duplicateId) {
        const inv = await getInvoice(duplicateId);
        setFormBusinessId(inv.business_id);
        setForm({
          ...emptyForm(), customerId: inv.customer_id, jobEvent: inv.job_event,
          jobDate: inv.job_date, jobLocation: inv.job_location,
          lineItems: inv.line_items, discountType: inv.discount_type,
          discountValue: inv.discount_value,
        });
      } else {
        if (!activeBusiness) return;
        setFormBusinessId(activeBusiness.id);
        setForm(loadForm() ?? emptyForm());
      }
    })().catch((e) => setError(e instanceof Error ? e.message : "Failed to load invoice"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, duplicateId]);

  // If activeBusiness wasn't ready yet on first mount (still loading from
  // BusinessProvider), pick it up once it arrives — but only for a
  // brand-new invoice that hasn't resolved a business yet at all.
  useEffect(() => {
    if (draftId || duplicateId) return;
    if (formBusinessId || !activeBusiness) return;
    setFormBusinessId(activeBusiness.id);
    setForm((prev) => prev ?? loadForm() ?? emptyForm());
  }, [draftId, duplicateId, formBusinessId, activeBusiness]);

  useEffect(() => {
    if (!formBusinessId) return;
    listCustomers(formBusinessId).then(setCustomers).catch((e) => setError(e instanceof Error ? e.message : "Failed to load customers"));
    listPresets(formBusinessId).then(setPresets).catch((e) => setError(e instanceof Error ? e.message : "Failed to load presets"));
  }, [formBusinessId]);
```

- [ ] **Step 2: Pass `formBusinessId` into the customer/draft creation calls**

Change `persistDraft` (currently lines 75-91) from:

```typescript
  async function persistDraft(): Promise<string> {
    let customerId = f.customerId;
    if (f.newCustomer && f.newCustomer.name.trim()) {
      const c = await createCustomer(f.newCustomer);
      customerId = c.id;
      setCustomers([...customers, c]);
      set({ customerId: c.id, newCustomer: null });
    }
    const inv = await saveInvoiceDraft({
      id: f.invoiceId, issue_date: f.issueDate, customer_id: customerId,
      job_event: f.jobEvent, job_date: f.jobDate, job_location: f.jobLocation,
      line_items: f.lineItems.filter((li) => li.description.trim() !== ""),
      discount_type: f.discountType, discount_value: f.discountValue,
    });
    if (!f.invoiceId) set({ invoiceId: inv.id });
    return inv.id;
  }
```

to:

```typescript
  async function persistDraft(): Promise<string> {
    if (!formBusinessId) throw new Error("No business selected");
    let customerId = f.customerId;
    if (f.newCustomer && f.newCustomer.name.trim()) {
      const c = await createCustomer(f.newCustomer, formBusinessId);
      customerId = c.id;
      setCustomers([...customers, c]);
      set({ customerId: c.id, newCustomer: null });
    }
    const inv = await saveInvoiceDraft({
      id: f.invoiceId, issue_date: f.issueDate, customer_id: customerId,
      job_event: f.jobEvent, job_date: f.jobDate, job_location: f.jobLocation,
      line_items: f.lineItems.filter((li) => li.description.trim() !== ""),
      discount_type: f.discountType, discount_value: f.discountValue,
    }, formBusinessId);
    if (!f.invoiceId) set({ invoiceId: inv.id });
    return inv.id;
  }
```

- [ ] **Step 3: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep "InvoiceForm.tsx"
```

Expected: no output.

- [ ] **Step 4: Manual check**

```bash
npm run dev &
sleep 3
```

Open `http://localhost:3000/invoices/new`, confirm the customer dropdown and "+ Add preset" list show JJ Visuals' existing customers/presets, and creating a draft works end-to-end (Save Draft, then Finalize). If a second business exists from earlier manual checks, switch to it in the nav and confirm `/invoices/new` shows an empty customer list (no JJ Visuals customers bleeding through).

```bash
pkill -f "next dev"
```

- [ ] **Step 5: Commit**

```bash
git add src/components/InvoiceForm.tsx
git commit -m "feat: resolve invoice form's business from the invoice itself or active business"
```

---

### Task 11: InvoiceDetail + InvoicePdf — use the invoice's own business

**Files:**
- Modify: `src/components/InvoiceDetail.tsx`
- Modify: `src/components/InvoicePdf.tsx`

**Interfaces:**
- Consumes: `getBusiness(id)` (Task 4), `Business` type (Task 2).

- [ ] **Step 1: Swap `getSettings()` for `getBusiness(invoice.business_id)` in `InvoiceDetail.tsx`**

Change the imports (currently line 5 and 10):

```typescript
import { deleteInvoice, getInvoice, getSettings, setPaid } from "@/lib/db";
```
```typescript
import type { Invoice, Settings } from "@/lib/types";
```

to:

```typescript
import { deleteInvoice, getBusiness, getInvoice, setPaid } from "@/lib/db";
```
```typescript
import type { Business, Invoice } from "@/lib/types";
```

Change the state and fetch (currently lines 19-27):

```typescript
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getInvoice(id).then(setInvoice).catch((e) => setError(e.message));
    getSettings().then(setSettings).catch((e) => setError(e.message));
  }, [id]);
```

to:

```typescript
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getInvoice(id)
      .then((inv) => {
        setInvoice(inv);
        return getBusiness(inv.business_id);
      })
      .then(setBusiness)
      .catch((e) => setError(e.message));
  }, [id]);
```

Then update every remaining reference to `settings` in the file to `business`:
- Line 37: `if (!invoice || !settings) return (` → `if (!invoice || !business) return (`
- Line 63: `const inv = invoice!; const st = settings!;` → `const inv = invoice!; const st = business!;`
- Line 74: `<InvoicePdf invoice={inv} settings={st} qr={qr} logo={logo} variant={variant} />` → `<InvoicePdf invoice={inv} business={st} qr={qr} logo={logo} variant={variant} />`
- Line 122: `` `You can PayNow via the QR in the PDF (sending it right after this) or to ${settings!.paynow_number}. Thank you!` `` → `` `You can PayNow via the QR in the PDF (sending it right after this) or to ${business!.paynow_number}. Thank you!` ``

- [ ] **Step 2: Rename the `settings` prop to `business` in `InvoicePdf.tsx`**

Change the import (currently line 10 area — check with `grep -n "^import" src/components/InvoicePdf.tsx`):

```typescript
import type { Invoice, Settings } from "@/lib/types";
```

to:

```typescript
import type { Business, Invoice } from "@/lib/types";
```

Change the props destructuring and type (currently around lines 324-330 — check with `grep -n "settings" src/components/InvoicePdf.tsx`):

```typescript
  settings,
```
```typescript
  settings: Settings;
```

to:

```typescript
  business,
```
```typescript
  business: Business;
```

Then update the 6 remaining `settings.` references in the file's JSX (lines ~366, 369, 371, 425, 509, 517, 519 per the earlier grep) to `business.` — e.g. `settings.business_name.toUpperCase()` becomes `business.name.toUpperCase()` (the field is `name` on `Business`, not `business_name` — every other field name is unchanged: `address`, `phone`, `email`, `payment_terms`, `paynow_number`, `payee_name`, `bank_details`).

- [ ] **Step 3: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep -E "InvoiceDetail.tsx|InvoicePdf.tsx"
```

Expected: no output.

- [ ] **Step 4: Manual check**

```bash
npm run dev &
sleep 3
```

Open an existing finalized invoice's detail page, confirm it loads (no "settings" errors), download the PDF and confirm the business name/address/PayNow details render correctly.

```bash
pkill -f "next dev"
```

- [ ] **Step 5: Commit**

```bash
git add src/components/InvoiceDetail.tsx src/components/InvoicePdf.tsx
git commit -m "feat: resolve InvoiceDetail/InvoicePdf business from the invoice's own business_id"
```

---

### Task 12: Stats — active business + "All businesses" toggle

**Files:**
- Modify: `src/app/stats/page.tsx`

**Interfaces:**
- Consumes: `useBusiness` (Task 6/7). `listInvoices(businessId?)` (Task 4) — omit the argument for the "All businesses" view.

- [ ] **Step 1: Add the scope toggle and wire it into the invoice fetch**

Add the import:

```typescript
import { useBusiness } from "@/lib/businessContext";
```

Change the component's opening (currently lines 11-15):

```typescript
export default function StatsPage() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => { listInvoices().then(setInvoices); }, []);
```

to:

```typescript
export default function StatsPage() {
  const { activeBusiness } = useBusiness();
  const [scope, setScope] = useState<"active" | "all">("active");
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (scope === "active" && !activeBusiness) return;
    setInvoices(null);
    listInvoices(scope === "active" ? activeBusiness!.id : undefined).then(setInvoices);
  }, [scope, activeBusiness]);
```

- [ ] **Step 2: Add the toggle UI**

In the header block (currently lines 60-69), change:

```typescript
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 className="page-title">Stats</h1>
          <p className="page-subtitle">Revenue overview and analytics</p>
        </div>
        <button onClick={exportCsv} className="btn btn-secondary icon-btn" style={{ padding: "8px 14px", fontSize: "0.8rem" }}>
          <IconFileExport size={15} /> Export CSV
        </button>
      </div>
```

to:

```typescript
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 className="page-title">Stats</h1>
          <p className="page-subtitle">Revenue overview and analytics</p>
        </div>
        <button onClick={exportCsv} className="btn btn-secondary icon-btn" style={{ padding: "8px 14px", fontSize: "0.8rem" }}>
          <IconFileExport size={15} /> Export CSV
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setScope("active")}
          className={`btn ${scope === "active" ? "btn-primary" : "btn-secondary"}`}
          style={{ padding: "6px 14px", fontSize: "0.8rem" }}>
          {activeBusiness?.name ?? "Active business"}
        </button>
        <button onClick={() => setScope("all")}
          className={`btn ${scope === "all" ? "btn-primary" : "btn-secondary"}`}
          style={{ padding: "6px 14px", fontSize: "0.8rem" }}>
          All businesses
        </button>
      </div>
```

- [ ] **Step 3: Guard the loading state against the new `null` reset**

The existing loading check (`if (!invoices) return (...)`) already handles `invoices === null`, which now also covers the moment the scope switches — no further change needed there.

- [ ] **Step 4: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep "stats/page.tsx"
```

Expected: no output.

- [ ] **Step 5: Manual check**

```bash
npm run dev &
sleep 3
```

Open `http://localhost:3000/stats`, confirm "Active business" is selected by default and shows the same numbers as before this change. If a second business with data exists, confirm "All businesses" shows the combined total and "Active business" still shows just one business's numbers.

```bash
pkill -f "next dev"
```

- [ ] **Step 6: Commit**

```bash
git add src/app/stats/page.tsx
git commit -m "feat: add active/all-businesses scope toggle to Stats"
```

---

### Task 13: OnboardingBanner — fix default-detection for new businesses

**Files:**
- Modify: `src/components/OnboardingBanner.tsx`

**Interfaces:**
- Consumes: `useBusiness` (Task 6/7). No longer calls `getSettings` (removed in Task 4).

**Why this needs to change:** the banner currently nudges the owner to fill in Settings by comparing `address` against one hardcoded default string (the JJ Visuals seed address). A newly created business (Task 8's "Add business" flow) starts with `address: ""`, not that string, so the banner would silently never show for a genuinely unconfigured new business. Check for an empty address instead.

- [ ] **Step 1: Replace the full contents of `src/components/OnboardingBanner.tsx`**

```typescript
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useBusiness } from "@/lib/businessContext";
import { IconClose, IconSettings } from "@/components/icons";

const DISMISS_KEY = "jjv.onboarding.dismissed";

export default function OnboardingBanner() {
  const { activeBusiness } = useBusiness();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(!!localStorage.getItem(DISMISS_KEY));
  }, []);

  // Only nudge if the active business's details are still blank — i.e. the
  // owner hasn't reviewed Settings for it yet (true for every newly created
  // business, and for the original one before it's ever been configured).
  const show = !dismissed && !!activeBusiness && activeBusiness.address.trim() === "";

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  if (!show) return null;

  return (
    <div className="onboarding-banner">
      <IconSettings size={20} />
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: 2 }}>Set up your business details</p>
        <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: 8 }}>
          Add your address, PayNow number, and bank details so every invoice is ready to send.
        </p>
        <Link href="/settings" onClick={dismiss} className="btn btn-secondary" style={{ padding: "6px 14px", fontSize: "0.8rem" }}>
          Go to Settings
        </Link>
      </div>
      <button onClick={dismiss} className="onboarding-dismiss" aria-label="Dismiss">
        <IconClose size={14} />
      </button>
    </div>
  );
}
```

Note: this changes the dismiss behavior slightly — dismissing now suppresses the banner globally (matching the old behavior) rather than per-business. That's an acceptable simplification for this foundation pass (per-business dismissal would need a `Set` of dismissed IDs in `localStorage`); flag it as a possible follow-up if the owner finds it annoying once they have 3 businesses, but don't build it now — YAGNI until it's an actual problem.

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep "OnboardingBanner.tsx"
```

Expected: no output.

- [ ] **Step 3: Manual check**

```bash
npm run dev &
sleep 3
```

Open `http://localhost:3000/`, confirm the banner does *not* show for JJ Visuals (it has a real address already). Switch to a freshly created business (Task 8) and confirm the banner *does* show, and that "Go to Settings" navigates correctly.

```bash
pkill -f "next dev"
```

- [ ] **Step 4: Commit**

```bash
git add src/components/OnboardingBanner.tsx
git commit -m "fix: detect unconfigured business by blank address, not a hardcoded string"
```

---

### Task 14: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit test suite**

```bash
npm test
```

Expected: all tests pass, including the new `slug.test.ts` from Task 3. No test file references the removed `Settings` type or the old unscoped `db.ts` signatures — if any does, fix it before proceeding (none should, per the file list in Task 3-4, but confirm with `grep -rn "Settings\b" src/**/*.test.ts` returning nothing).

- [ ] **Step 2: Run a full production build**

```bash
npm run build
```

Expected: builds successfully with no TypeScript errors. This is the strongest signal that every call site across the app was updated consistently (a build catches type mismatches that `grep`-driven spot checks might miss).

- [ ] **Step 3: Full manual QA pass on the dev server**

```bash
npm run dev &
sleep 3
```

Walk through, in order:
1. Dashboard loads JJ Visuals' existing invoices correctly (no data loss from migration).
2. Create a second business via Settings (if not already done in earlier tasks), confirm it appears in the nav switcher.
3. Switch to the second business: Dashboard, Stats, and the customer/preset pickers in a new invoice all show empty/blank — no bleed-through from JJ Visuals.
4. Create a customer, a preset, and finalize an invoice under the second business. Confirm its invoice number starts fresh (not continuing JJ Visuals' sequence).
5. Switch back to JJ Visuals, confirm its data and invoice numbering are unaffected.
6. Open a JJ Visuals invoice's detail page, download its PDF, confirm business name/PayNow/bank details are correct (this is the one screen that doesn't follow the nav's active business — confirm it's still correct regardless of which business is currently active in the switcher).
7. Archive the second business from Settings, confirm it drops out of the nav switcher but its invoice is still reachable from Dashboard search or the URL directly.

```bash
pkill -f "next dev"
```

- [ ] **Step 4: Update project memory** (not a commit — informational)

If any deviations from this plan were made during execution (e.g. the `--accent-bg` CSS variable substitution noted in Task 8), leave a brief note in the final task's commit message or a follow-up commit describing what changed and why, so the next phase (Telegram integration) starts from an accurate picture of the schema.

---

## Notes for the next phases

- **Telegram integration** (next phase) will likely want a `businesses.telegram_chat_id` column or a separate `business_telegram_links` table — decide when that spec is written, informed by whether notifications are per-business or account-wide.
- **STL quoting** and **gear rental tracking** will each need their own tables that reference `businesses(id)`, following the same pattern established here.
