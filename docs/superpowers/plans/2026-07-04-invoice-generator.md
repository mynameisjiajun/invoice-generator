# JJ Visuals Invoice Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single-user PWA that creates, tracks, and PDFs Singapore invoices with dynamic PayNow QR codes, synced via Supabase, deployed on Vercel.

**Architecture:** Next.js App Router (client-heavy; Supabase is the only backend). Pure business logic (money math, PayNow EMV payload) lives in `src/lib` with unit tests. All data access goes through typed helpers in `src/lib/db.ts`. PDF is rendered client-side with `@react-pdf/renderer`; the QR is generated as a data URL and embedded.

**Tech Stack:** Next.js (App Router, TypeScript, Tailwind), Supabase (`@supabase/supabase-js`, `@supabase/ssr`), `@react-pdf/renderer`, `qrcode`, Vitest.

## Global Constraints

- Money is stored and computed in **integer cents** everywhere; format only at display time as `$1,234.56`.
- Owner email is exactly `chuajiajun2705@gmail.com` — RLS policies and any client-side checks use this literal.
- PayNow mobile proxy: `+6596561716`. Payment terms copy: `paynow within 30 days of invoice`.
- Invoice numbers: `A-<n>` (prefix stored in settings, next sequence starts at **30**). Drafts have `invoice_number = null`.
- Customer IDs continue existing numbering: identity column **starting at 9**.
- Invoice status is one of `draft | unpaid | paid`. "Overdue" is derived: `status = 'unpaid' AND issue_date < today - 30 days` — never stored.
- All commits: `git commit -m "..." ` with trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Tests run with `npx vitest run`; dev server with `npm run dev` on port 3000.

---

### Task 1: Scaffold project + test tooling

**Files:**
- Create: Next.js scaffold at repo root, `vitest.config.ts`, `.env.local` (placeholder)

**Interfaces:**
- Produces: a running Next.js TypeScript app with Tailwind, Vitest wired for `src/lib/**/*.test.ts`.

- [ ] **Step 1: Scaffold Next.js in the existing repo**

The repo root already contains `docs/` and `.git`. Run:

```bash
cd "/Users/mynameisjiajun/Documents/Coding projects/invoice generator"
npx --yes create-next-app@latest . --typescript --tailwind --app --no-src-dir=false --src-dir --eslint --no-turbopack --import-alias "@/*" --yes
```

If `create-next-app` refuses because the directory is non-empty, scaffold into a temp dir and move everything except `docs/` and `.git` back:

```bash
npx --yes create-next-app@latest /tmp/jjv-scaffold --typescript --tailwind --app --src-dir --eslint --import-alias "@/*" --yes
rsync -a --exclude .git /tmp/jjv-scaffold/ "/Users/mynameisjiajun/Documents/Coding projects/invoice generator/"
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr @react-pdf/renderer qrcode
npm install -D vitest @types/qrcode
```

- [ ] **Step 3: Add Vitest config and script**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { include: ["src/**/*.test.ts"] },
});
```

Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 4: Verify the app boots**

Run: `npm run dev` — expect `Ready` on http://localhost:3000, then stop it.
Run: `npx vitest run` — expect "no test files found" exit 0 (or add `--passWithNoTests`).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Tailwind, Supabase deps, vitest"
```

---

### Task 2: Money math library (TDD)

**Files:**
- Create: `src/lib/money.ts`
- Test: `src/lib/money.test.ts`

**Interfaces:**
- Produces:
  - `type LineItem = { description: string; qty: number; unitPriceCents: number }`
  - `type DiscountType = "none" | "amount" | "percent"`
  - `lineTotalCents(item: LineItem): number`
  - `subtotalCents(items: LineItem[]): number`
  - `discountCents(subtotal: number, type: DiscountType, value: number): number` — `value` is dollars for `amount`, percent (0–100) for `percent`; clamped to `[0, subtotal]`
  - `totalCents(items: LineItem[], type: DiscountType, value: number): number`
  - `formatSGD(cents: number): string` → `"$1,234.56"`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/money.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/money.test.ts`
Expected: FAIL — cannot resolve `./money`.

- [ ] **Step 3: Implement**

Create `src/lib/money.ts`:

```ts
export type LineItem = { description: string; qty: number; unitPriceCents: number };
export type DiscountType = "none" | "amount" | "percent";

export function lineTotalCents(item: LineItem): number {
  return Math.round(item.qty * item.unitPriceCents);
}

export function subtotalCents(items: LineItem[]): number {
  return items.reduce((sum, item) => sum + lineTotalCents(item), 0);
}

export function discountCents(subtotal: number, type: DiscountType, value: number): number {
  let cents = 0;
  if (type === "amount") cents = Math.round(value * 100);
  if (type === "percent") cents = Math.round((subtotal * value) / 100);
  return Math.min(Math.max(cents, 0), subtotal);
}

export function totalCents(items: LineItem[], type: DiscountType, value: number): number {
  const sub = subtotalCents(items);
  return sub - discountCents(sub, type, value);
}

export function formatSGD(cents: number): string {
  return (cents / 100).toLocaleString("en-SG", {
    style: "currency", currency: "SGD", currencyDisplay: "symbol",
  }).replace("SGD", "$").replace("S$", "$");
}
```

Note: if `formatSGD` tests fail on locale symbol quirks, implement manually:

```ts
export function formatSGD(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100).toLocaleString("en-US");
  return `${sign}$${dollars}.${String(abs % 100).padStart(2, "0")}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/money.test.ts` — Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/money.ts src/lib/money.test.ts
git commit -m "feat: money math library (line totals, discounts, SGD formatting)"
```

---

### Task 3: PayNow QR payload library (TDD)

**Files:**
- Create: `src/lib/paynow.ts`
- Test: `src/lib/paynow.test.ts`

**Interfaces:**
- Produces:
  - `crc16ccitt(input: string): string` — CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), returns 4 uppercase hex chars
  - `paynowPayload(opts: { mobile: string; amountCents: number; reference: string; merchantName?: string }): string` — full EMVCo SGQR string, amount non-editable

- [ ] **Step 1: Write the failing tests**

Create `src/lib/paynow.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { crc16ccitt, paynowPayload } from "./paynow";

describe("crc16ccitt", () => {
  test("known vector: '123456789' -> 29B1 (CRC-16/CCITT-FALSE)", () => {
    expect(crc16ccitt("123456789")).toBe("29B1");
  });
});

describe("paynowPayload", () => {
  const payload = paynowPayload({
    mobile: "+6596561716",
    amountCents: 50000,
    reference: "A-30",
    merchantName: "CHUA JIA JUN",
  });

  test("starts with EMV header, dynamic point of initiation", () => {
    expect(payload.startsWith("000201")).toBe(true); // 00 02 "01"
    expect(payload).toContain("010212"); // 01 02 "12" = dynamic
  });

  test("merchant account info template is exact", () => {
    // 0009SG.PAYNOW | 01 01 "0" (mobile proxy) | 02 11 "+6596561716" | 03 01 "0" (not editable)
    const inner = "0009SG.PAYNOW" + "01010" + "0211+6596561716" + "03010";
    expect(payload).toContain("26" + String(inner.length).padStart(2, "0") + inner);
  });

  test("contains currency 702, country SG, amount 500.00", () => {
    expect(payload).toContain("5303702");
    expect(payload).toContain("5802SG");
    expect(payload).toContain("5406500.00");
  });

  test("contains invoice reference", () => {
    expect(payload).toContain("A-30");
  });

  test("ends with valid CRC over itself", () => {
    const body = payload.slice(0, -4);
    expect(payload.slice(-4)).toBe(crc16ccitt(body));
    expect(body.endsWith("6304")).toBe(true);
  });

  test("amounts format without thousands separators", () => {
    const p = paynowPayload({ mobile: "+6596561716", amountCents: 123456, reference: "A-31" });
    expect(p).toContain("54071234.56");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/paynow.test.ts` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

Create `src/lib/paynow.ts`:

```ts
function tlv(id: string, value: string): string {
  return id + String(value.length).padStart(2, "0") + value;
}

export function crc16ccitt(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function paynowPayload(opts: {
  mobile: string;
  amountCents: number;
  reference: string;
  merchantName?: string;
}): string {
  const amount = (opts.amountCents / 100).toFixed(2);
  const merchantAccountInfo =
    tlv("00", "SG.PAYNOW") +
    tlv("01", "0") +            // proxy type: mobile
    tlv("02", opts.mobile) +    // proxy value
    tlv("03", "0");             // amount not editable
  const body =
    tlv("00", "01") +           // payload format
    tlv("01", "12") +           // dynamic QR
    tlv("26", merchantAccountInfo) +
    tlv("52", "0000") +         // MCC
    tlv("53", "702") +          // SGD
    tlv("54", amount) +
    tlv("58", "SG") +
    tlv("59", (opts.merchantName ?? "NA").slice(0, 25)) +
    tlv("60", "Singapore") +
    tlv("62", tlv("01", opts.reference.slice(0, 25))) + // bill/reference number
    "6304";                     // CRC id+len, value appended below
  return body + crc16ccitt(body);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/paynow.test.ts` — Expected: PASS.

- [ ] **Step 5: Sanity-check with a real banking app**

Generate a QR manually (one-off script or via the app later) for $0.01 to your own number and scan it with your bank app to confirm it resolves to PayNow with amount locked. Record the result in the commit message. (If it fails, the likely culprits are the editable flag or reference field id — PayNow uses `62`→`01` bill number.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/paynow.ts src/lib/paynow.test.ts
git commit -m "feat: PayNow EMVCo dynamic QR payload with CRC16"
```

---

### Task 4: Supabase project, schema, RLS, and clients

**Files:**
- Create: `supabase/migrations/001_schema.sql`, `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/middleware.ts`, `.env.local`
- Create: `src/lib/types.ts`

**Interfaces:**
- Produces:
  - `createClient()` (browser) from `src/lib/supabase/client.ts`
  - `createServerSupabase()` from `src/lib/supabase/server.ts` (async, cookie-aware)
  - Route protection: unauthenticated requests to anything but `/login` redirect to `/login`
  - DB tables `settings, customers, presets, invoices` with RLS locked to owner email
  - `finalize_invoice(inv_id uuid) returns text` Postgres function
  - Types in `src/lib/types.ts`: `Customer`, `Preset`, `Invoice`, `Settings`

- [ ] **Step 1: Create the Supabase project**

Via https://supabase.com dashboard (user action) or `npx supabase` CLI if logged in. Needed outputs: project URL + anon key. In Authentication → Providers: enable **Email** with password; in Authentication → Settings: **disable new user signups**. Create the single user `chuajiajun2705@gmail.com` with a strong password (Authentication → Users → Add user, auto-confirm).

Write `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Confirm `.env.local` is in `.gitignore` (create-next-app adds `.env*` by default — verify).

- [ ] **Step 2: Write the schema migration**

Create `supabase/migrations/001_schema.sql`:

```sql
create table settings (
  id int primary key default 1 check (id = 1),
  business_name text not null default 'JJ Visuals',
  address text not null default 'Blk 296A Compassvale Crescent #10-293, S541296',
  phone text not null default '+65 9656 1716',
  email text not null default 'chuajiajun2705@gmail.com',
  paynow_number text not null default '+6596561716',
  payee_name text not null default 'Chua Jia Jun',
  bank_details text not null default 'Bank Name: DBS',
  payment_terms text not null default 'paynow within 30 days of invoice',
  invoice_prefix text not null default 'A-',
  next_invoice_seq int not null default 30
);
insert into settings (id) values (1);

create table customers (
  id int generated by default as identity (start with 9) primary key,
  name text not null,
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  created_at timestamptz not null default now()
);

create table presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  unit_price_cents int not null,
  default_qty numeric not null default 1,
  created_at timestamptz not null default now()
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique,
  status text not null default 'draft' check (status in ('draft','unpaid','paid')),
  issue_date date not null default current_date,
  customer_id int references customers(id),
  job_event text not null default '',
  job_date text not null default '',
  job_location text not null default '',
  line_items jsonb not null default '[]',
  discount_type text not null default 'none' check (discount_type in ('none','amount','percent')),
  discount_value numeric not null default 0,
  subtotal_cents int not null default 0,
  total_cents int not null default 0,
  paid_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS: owner-only on every table
alter table settings enable row level security;
alter table customers enable row level security;
alter table presets enable row level security;
alter table invoices enable row level security;

create policy owner_settings on settings for all to authenticated
  using ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com')
  with check ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com');
create policy owner_customers on customers for all to authenticated
  using ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com')
  with check ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com');
create policy owner_presets on presets for all to authenticated
  using ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com')
  with check ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com');
create policy owner_invoices on invoices for all to authenticated
  using ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com')
  with check ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com');

-- Atomically claim the next invoice number and finalize a draft
create or replace function finalize_invoice(inv_id uuid)
returns text
language plpgsql
security invoker
as $$
declare
  num text;
begin
  update settings
     set next_invoice_seq = next_invoice_seq + 1
   where id = 1
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
```

Apply it in the Supabase SQL editor (paste + run) or `npx supabase db push` if the CLI is linked.

- [ ] **Step 3: Write shared types**

Create `src/lib/types.ts`:

```ts
import type { DiscountType, LineItem } from "./money";

export type Customer = {
  id: number; name: string; phone: string; email: string; address: string;
};

export type Preset = {
  id: string; name: string; description: string;
  unit_price_cents: number; default_qty: number;
};

export type InvoiceStatus = "draft" | "unpaid" | "paid";

export type Invoice = {
  id: string;
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

export type Settings = {
  id: number; business_name: string; address: string; phone: string;
  email: string; paynow_number: string; payee_name: string;
  bank_details: string; payment_terms: string;
  invoice_prefix: string; next_invoice_seq: number;
};

export function isOverdue(inv: Invoice, today = new Date()): boolean {
  if (inv.status !== "unpaid") return false;
  const due = new Date(inv.issue_date);
  due.setDate(due.getDate() + 30);
  return today > due;
}
```

- [ ] **Step 4: Supabase browser + server clients and middleware**

Create `src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

Create `src/lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {}
        },
      },
    }
  );
}
```

Create `src/middleware.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();

  const isLogin = request.nextUrl.pathname.startsWith("/login");
  if (!user && !isLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (user && isLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest|icons).*)"],
};
```

- [ ] **Step 5: Verify**

Run: `npm run dev`, open http://localhost:3000 — expect redirect to `/login` (404 until Task 5 builds the page; the redirect itself is the pass signal).

- [ ] **Step 6: Commit**

```bash
git add supabase src/lib/types.ts src/lib/supabase src/middleware.ts
git commit -m "feat: supabase schema with owner-only RLS, clients, auth middleware"
```

---

### Task 5: Login page + app shell

**Files:**
- Create: `src/app/login/page.tsx`, `src/components/NavBar.tsx`
- Modify: `src/app/layout.tsx`, `src/app/globals.css` (only if scaffold defaults conflict)

**Interfaces:**
- Consumes: `createClient()` from Task 4.
- Produces: working email+password login at `/login`; `<NavBar />` with links Dashboard `/`, New Invoice `/invoices/new`, Stats `/stats`, Settings `/settings`, and a Sign out button.

- [ ] **Step 1: Login page**

Create `src/app/login/page.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setError(error.message); return; }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">JJ Visuals Invoices</h1>
        <input className="w-full border rounded-lg p-3" type="email" placeholder="Email"
               value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        <input className="w-full border rounded-lg p-3" type="password" placeholder="Password"
               value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button className="w-full rounded-lg bg-black text-white p-3 disabled:opacity-50" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: NavBar + layout**

Create `src/components/NavBar.tsx`:

```tsx
"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/", label: "Invoices" },
  { href: "/invoices/new", label: "New" },
  { href: "/stats", label: "Stats" },
  { href: "/settings", label: "Settings" },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname.startsWith("/login")) return null;

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="sticky top-0 z-10 bg-white border-b flex items-center gap-1 px-3 py-2 text-sm">
      {links.map((l) => (
        <Link key={l.href} href={l.href}
          className={`px-3 py-2 rounded-lg ${pathname === l.href ? "bg-black text-white" : "hover:bg-gray-100"}`}>
          {l.label}
        </Link>
      ))}
      <button onClick={signOut} className="ml-auto px-3 py-2 rounded-lg text-gray-500 hover:bg-gray-100">
        Sign out
      </button>
    </nav>
  );
}
```

Modify `src/app/layout.tsx` to render `<NavBar />` above `{children}` (keep scaffold fonts/styles):

```tsx
import NavBar from "@/components/NavBar";
// inside <body>:
//   <NavBar />
//   {children}
```

- [ ] **Step 3: Verify manually**

`npm run dev` → `/login` shows the form; wrong password shows error; correct login lands on `/` (scaffold home for now) with nav; Sign out returns to `/login`; visiting `/settings` logged-out redirects to `/login`.

- [ ] **Step 4: Commit**

```bash
git add src/app/login src/components/NavBar.tsx src/app/layout.tsx
git commit -m "feat: login page, nav shell, sign out"
```

---

### Task 6: Data access layer

**Files:**
- Create: `src/lib/db.ts`

**Interfaces:**
- Consumes: `createClient()` (browser), types from `src/lib/types.ts`.
- Produces (all browser-side, all throw on Supabase error):
  - `getSettings(): Promise<Settings>` / `saveSettings(patch: Partial<Settings>): Promise<void>`
  - `listCustomers(): Promise<Customer[]>` / `createCustomer(c: Omit<Customer,"id">): Promise<Customer>` / `updateCustomer(id, patch): Promise<void>`
  - `listPresets(): Promise<Preset[]>` / `createPreset(p: Omit<Preset,"id">): Promise<Preset>` / `deletePreset(id: string): Promise<void>`
  - `listInvoices(): Promise<Invoice[]>` (joined with customer, ordered `created_at desc`)
  - `getInvoice(id: string): Promise<Invoice>`
  - `saveInvoiceDraft(draft): Promise<Invoice>` (insert or update by id, recomputes `subtotal_cents`/`total_cents` via money lib)
  - `finalizeInvoice(id: string): Promise<string>` (RPC `finalize_invoice`, returns the assigned number)
  - `setPaid(id: string, paid: boolean): Promise<void>` (sets status + `paid_date`)
  - `deleteInvoice(id: string): Promise<void>`

- [ ] **Step 1: Implement**

Create `src/lib/db.ts`:

```ts
import { createClient } from "@/lib/supabase/client";
import { subtotalCents, totalCents } from "@/lib/money";
import type { Customer, Invoice, Preset, Settings } from "@/lib/types";

const db = () => createClient();

function ok<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export async function getSettings(): Promise<Settings> {
  return ok(await db().from("settings").select("*").eq("id", 1).single());
}
export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  ok(await db().from("settings").update(patch).eq("id", 1).select().single());
}

export async function listCustomers(): Promise<Customer[]> {
  return ok(await db().from("customers").select("*").order("name"));
}
export async function createCustomer(c: Omit<Customer, "id">): Promise<Customer> {
  return ok(await db().from("customers").insert(c).select().single());
}
export async function updateCustomer(id: number, patch: Partial<Customer>): Promise<void> {
  ok(await db().from("customers").update(patch).eq("id", id).select().single());
}

export async function listPresets(): Promise<Preset[]> {
  return ok(await db().from("presets").select("*").order("name"));
}
export async function createPreset(p: Omit<Preset, "id">): Promise<Preset> {
  return ok(await db().from("presets").insert(p).select().single());
}
export async function deletePreset(id: string): Promise<void> {
  ok(await db().from("presets").delete().eq("id", id).select());
}

const INVOICE_SELECT = "*, customers(*)";

export async function listInvoices(): Promise<Invoice[]> {
  return ok(await db().from("invoices").select(INVOICE_SELECT).order("created_at", { ascending: false }));
}
export async function getInvoice(id: string): Promise<Invoice> {
  return ok(await db().from("invoices").select(INVOICE_SELECT).eq("id", id).single());
}

export type DraftInput = Pick<Invoice,
  "issue_date" | "customer_id" | "job_event" | "job_date" | "job_location" |
  "line_items" | "discount_type" | "discount_value"> & { id?: string };

export async function saveInvoiceDraft(draft: DraftInput): Promise<Invoice> {
  const computed = {
    ...draft,
    subtotal_cents: subtotalCents(draft.line_items),
    total_cents: totalCents(draft.line_items, draft.discount_type, draft.discount_value),
    updated_at: new Date().toISOString(),
  };
  if (draft.id) {
    return ok(await db().from("invoices").update(computed).eq("id", draft.id).select(INVOICE_SELECT).single());
  }
  return ok(await db().from("invoices").insert(computed).select(INVOICE_SELECT).single());
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

export async function deleteInvoice(id: string): Promise<void> {
  ok(await db().from("invoices").delete().eq("id", id).select());
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit` — Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat: typed data access layer over supabase"
```

---

### Task 7: Settings page (business info + preset management)

**Files:**
- Create: `src/app/settings/page.tsx`

**Interfaces:**
- Consumes: `getSettings, saveSettings, listPresets, createPreset, deletePreset` from Task 6.

- [ ] **Step 1: Implement the page**

Create `src/app/settings/page.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { getSettings, saveSettings, listPresets, createPreset, deletePreset } from "@/lib/db";
import { formatSGD } from "@/lib/money";
import type { Preset, Settings } from "@/lib/types";

const FIELDS: Array<{ key: keyof Settings; label: string }> = [
  { key: "business_name", label: "Business name" },
  { key: "address", label: "Address" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "paynow_number", label: "PayNow number (e.g. +6596561716)" },
  { key: "payee_name", label: "Payee name (for cheques)" },
  { key: "bank_details", label: "Bank details" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [saved, setSaved] = useState(false);
  const [np, setNp] = useState({ name: "", description: "", price: "", qty: "1" });

  useEffect(() => {
    getSettings().then(setSettings);
    listPresets().then(setPresets);
  }, []);

  if (!settings) return <p className="p-6">Loading…</p>;

  async function onSave() {
    await saveSettings(settings!);
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  async function onAddPreset() {
    const p = await createPreset({
      name: np.name, description: np.description,
      unit_price_cents: Math.round(parseFloat(np.price || "0") * 100),
      default_qty: parseFloat(np.qty || "1"),
    });
    setPresets([...presets, p]);
    setNp({ name: "", description: "", price: "", qty: "1" });
  }

  return (
    <main className="max-w-xl mx-auto p-4 space-y-6">
      <h1 className="text-xl font-bold">Settings</h1>
      <section className="space-y-3">
        {FIELDS.map(({ key, label }) => (
          <label key={key} className="block text-sm">
            <span className="text-gray-500">{label}</span>
            <input className="mt-1 w-full border rounded-lg p-2"
              value={String(settings[key] ?? "")}
              onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} />
          </label>
        ))}
        <button onClick={onSave} className="rounded-lg bg-black text-white px-4 py-2">
          {saved ? "Saved ✓" : "Save settings"}
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Service presets</h2>
        {presets.map((p) => (
          <div key={p.id} className="flex items-center gap-2 border rounded-lg p-3 text-sm">
            <div className="flex-1">
              <div className="font-medium">{p.name}</div>
              <div className="text-gray-500">{p.description}</div>
            </div>
            <div>{formatSGD(p.unit_price_cents)}</div>
            <button onClick={async () => { await deletePreset(p.id); setPresets(presets.filter(x => x.id !== p.id)); }}
              className="text-red-600 px-2">Delete</button>
          </div>
        ))}
        <div className="border rounded-lg p-3 space-y-2 text-sm">
          <input className="w-full border rounded p-2" placeholder="Name (e.g. Photo & Video, no edit)"
            value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} />
          <input className="w-full border rounded p-2" placeholder="Description"
            value={np.description} onChange={(e) => setNp({ ...np, description: e.target.value })} />
          <div className="flex gap-2">
            <input className="flex-1 border rounded p-2" placeholder="Unit price ($)" inputMode="decimal"
              value={np.price} onChange={(e) => setNp({ ...np, price: e.target.value })} />
            <input className="w-24 border rounded p-2" placeholder="Qty" inputMode="decimal"
              value={np.qty} onChange={(e) => setNp({ ...np, qty: e.target.value })} />
          </div>
          <button onClick={onAddPreset} disabled={!np.name || !np.price}
            className="rounded-lg bg-black text-white px-4 py-2 disabled:opacity-50">Add preset</button>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Verify manually**

Login → `/settings`: fields prefilled from seeded defaults; edit + Save shows "Saved ✓" and survives reload; add preset "Photo & Video Shoot without Edit / $250 / qty 1", appears in list and survives reload; delete works.

- [ ] **Step 3: Commit**

```bash
git add src/app/settings
git commit -m "feat: settings page with business info and service presets"
```

---

### Task 8: Invoice form (new / edit / duplicate) with autosave

**Files:**
- Create: `src/app/invoices/new/page.tsx`, `src/components/InvoiceForm.tsx`, `src/lib/formStorage.ts`
- Test: `src/lib/formStorage.test.ts`

**Interfaces:**
- Consumes: `db.ts` functions, money lib, types.
- Produces:
  - `/invoices/new` — blank form; `/invoices/new?duplicate=<id>` — pre-filled from that invoice; `/invoices/new?draft=<id>` — resumes a DB draft.
  - `formStorage.ts`: `loadForm(): FormState | null`, `storeForm(s: FormState): void`, `clearForm(): void` (localStorage key `jjv.invoice.form.v1`)
  - `FormState = { invoiceId?: string; issueDate: string; customerId: number | null; newCustomer: { name: string; phone: string; email: string; address: string } | null; jobEvent: string; jobDate: string; jobLocation: string; lineItems: LineItem[]; discountType: DiscountType; discountValue: number }`
  - On **Save draft**: persists via `saveInvoiceDraft`, keeps localStorage.
  - On **Finalize**: creates customer if new → saves draft → `finalizeInvoice` → `clearForm()` → routes to `/invoices/<id>`.

- [ ] **Step 1: Write failing tests for formStorage**

Create `src/lib/formStorage.test.ts`:

```ts
// @vitest-environment jsdom  — if jsdom isn't installed, use the in-memory stub below instead
import { beforeEach, describe, expect, test, vi } from "vitest";
import { loadForm, storeForm, clearForm, emptyForm } from "./formStorage";

const mem = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
});

describe("formStorage", () => {
  beforeEach(() => mem.clear());

  test("round-trips a form", () => {
    const f = { ...emptyForm(), jobEvent: "Birthday Shoot" };
    storeForm(f);
    expect(loadForm()).toEqual(f);
  });

  test("returns null when empty or corrupt", () => {
    expect(loadForm()).toBeNull();
    mem.set("jjv.invoice.form.v1", "{not json");
    expect(loadForm()).toBeNull();
  });

  test("clearForm removes", () => {
    storeForm(emptyForm());
    clearForm();
    expect(loadForm()).toBeNull();
  });

  test("emptyForm defaults issueDate to today", () => {
    expect(emptyForm().issueDate).toBe(new Date().toISOString().slice(0, 10));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/formStorage.test.ts` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement formStorage**

Create `src/lib/formStorage.ts`:

```ts
import type { DiscountType, LineItem } from "./money";

export type FormState = {
  invoiceId?: string;
  issueDate: string;
  customerId: number | null;
  newCustomer: { name: string; phone: string; email: string; address: string } | null;
  jobEvent: string;
  jobDate: string;
  jobLocation: string;
  lineItems: LineItem[];
  discountType: DiscountType;
  discountValue: number;
};

const KEY = "jjv.invoice.form.v1";

export function emptyForm(): FormState {
  return {
    issueDate: new Date().toISOString().slice(0, 10),
    customerId: null,
    newCustomer: null,
    jobEvent: "",
    jobDate: "",
    jobLocation: "",
    lineItems: [{ description: "", qty: 1, unitPriceCents: 0 }],
    discountType: "none",
    discountValue: 0,
  };
}

export function storeForm(s: FormState): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function loadForm(): FormState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && "lineItems" in parsed
      ? (parsed as FormState) : null;
  } catch {
    return null;
  }
}

export function clearForm(): void {
  localStorage.removeItem(KEY);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/formStorage.test.ts` — Expected: PASS.

- [ ] **Step 5: Implement the form component**

Create `src/components/InvoiceForm.tsx`:

```tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCustomer, finalizeInvoice, getInvoice, listCustomers, listPresets, saveInvoiceDraft,
} from "@/lib/db";
import { clearForm, emptyForm, loadForm, storeForm, type FormState } from "@/lib/formStorage";
import { discountCents, formatSGD, subtotalCents, totalCents } from "@/lib/money";
import type { Customer, Preset } from "@/lib/types";

export default function InvoiceForm({ duplicateId, draftId }: { duplicateId?: string; draftId?: string }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [busy, setBusy] = useState<"" | "draft" | "final">("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCustomers().then(setCustomers);
    listPresets().then(setPresets);
    (async () => {
      if (draftId) {
        const inv = await getInvoice(draftId);
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
    })().catch((e) => setError(String(e.message ?? e)));
  }, [draftId, duplicateId]);

  // autosave locally on every change (not for DB drafts being resumed — those too, harmless)
  useEffect(() => { if (form) storeForm(form); }, [form]);

  const totals = useMemo(() => {
    if (!form) return { sub: 0, disc: 0, total: 0 };
    const sub = subtotalCents(form.lineItems);
    return {
      sub,
      disc: discountCents(sub, form.discountType, form.discountValue),
      total: totalCents(form.lineItems, form.discountType, form.discountValue),
    };
  }, [form]);

  if (!form) return <p className="p-6">{error ?? "Loading…"}</p>;
  const f = form;
  const set = (patch: Partial<FormState>) => setForm({ ...f, ...patch });

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

  async function onSaveDraft() {
    setBusy("draft"); setError(null);
    try { await persistDraft(); } catch (e) { setError(String((e as Error).message)); }
    setBusy("");
  }

  async function onFinalize() {
    setBusy("final"); setError(null);
    try {
      const id = await persistDraft();
      await finalizeInvoice(id);
      clearForm();
      router.push(`/invoices/${id}`);
    } catch (e) {
      setError(String((e as Error).message));
      setBusy("");
    }
  }

  const inputCls = "w-full border rounded-lg p-2";
  return (
    <main className="max-w-xl mx-auto p-4 space-y-5 text-sm">
      <h1 className="text-xl font-bold">{f.invoiceId ? "Edit draft" : "New invoice"}</h1>

      <section className="space-y-2">
        <h2 className="font-semibold">Customer</h2>
        <select className={inputCls} value={f.newCustomer ? "new" : f.customerId ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "new") set({ newCustomer: { name: "", phone: "", email: "", address: "" }, customerId: null });
            else set({ customerId: v ? Number(v) : null, newCustomer: null });
          }}>
          <option value="">— pick customer —</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name} (#{c.id})</option>)}
          <option value="new">+ New customer</option>
        </select>
        {f.newCustomer && (
          <div className="space-y-2 border rounded-lg p-3">
            {(["name", "phone", "email", "address"] as const).map((k) => (
              <input key={k} className={inputCls} placeholder={k[0].toUpperCase() + k.slice(1)}
                value={f.newCustomer![k]}
                onChange={(e) => set({ newCustomer: { ...f.newCustomer!, [k]: e.target.value } })} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Job</h2>
        <input className={inputCls} placeholder="Event name (e.g. Jordan Birthday Party Shoot)"
          value={f.jobEvent} onChange={(e) => set({ jobEvent: e.target.value })} />
        <input className={inputCls} placeholder="Event date & time (e.g. 20 June 2026, 7-9PM)"
          value={f.jobDate} onChange={(e) => set({ jobDate: e.target.value })} />
        <input className={inputCls} placeholder="Location"
          value={f.jobLocation} onChange={(e) => set({ jobLocation: e.target.value })} />
        <label className="block">
          <span className="text-gray-500">Invoice date</span>
          <input type="date" className={inputCls} value={f.issueDate}
            onChange={(e) => set({ issueDate: e.target.value })} />
        </label>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Line items</h2>
          {presets.length > 0 && (
            <select className="border rounded-lg p-2" value=""
              onChange={(e) => {
                const p = presets.find((x) => x.id === e.target.value);
                if (p) set({
                  lineItems: [...f.lineItems.filter((li) => li.description || li.unitPriceCents),
                    { description: `${p.name}${p.description ? `\n${p.description}` : ""}`,
                      qty: p.default_qty, unitPriceCents: p.unit_price_cents }],
                });
              }}>
              <option value="">+ preset</option>
              {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>
        {f.lineItems.map((li, i) => (
          <div key={i} className="border rounded-lg p-3 space-y-2">
            <textarea className={inputCls} rows={3} placeholder="Description (event, time, shoot type, location)"
              value={li.description}
              onChange={(e) => set({ lineItems: f.lineItems.map((x, j) => j === i ? { ...x, description: e.target.value } : x) })} />
            <div className="flex gap-2 items-center">
              <input className="w-20 border rounded p-2" inputMode="decimal" placeholder="Qty"
                value={li.qty}
                onChange={(e) => set({ lineItems: f.lineItems.map((x, j) => j === i ? { ...x, qty: parseFloat(e.target.value) || 0 } : x) })} />
              <input className="flex-1 border rounded p-2" inputMode="decimal" placeholder="Unit price ($)"
                value={li.unitPriceCents ? li.unitPriceCents / 100 : ""}
                onChange={(e) => set({ lineItems: f.lineItems.map((x, j) => j === i ? { ...x, unitPriceCents: Math.round((parseFloat(e.target.value) || 0) * 100) } : x) })} />
              <span className="w-20 text-right">{formatSGD(Math.round(li.qty * li.unitPriceCents))}</span>
              <button className="text-red-600 px-1" onClick={() => set({ lineItems: f.lineItems.filter((_, j) => j !== i) })}>✕</button>
            </div>
          </div>
        ))}
        <button className="border rounded-lg px-3 py-2"
          onClick={() => set({ lineItems: [...f.lineItems, { description: "", qty: 1, unitPriceCents: 0 }] })}>
          + Add line
        </button>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Discount</h2>
        <div className="flex gap-2">
          <select className="border rounded-lg p-2" value={f.discountType}
            onChange={(e) => set({ discountType: e.target.value as FormState["discountType"] })}>
            <option value="none">None</option>
            <option value="amount">Amount ($)</option>
            <option value="percent">Percent (%)</option>
          </select>
          {f.discountType !== "none" && (
            <input className="flex-1 border rounded-lg p-2" inputMode="decimal"
              value={f.discountValue || ""}
              onChange={(e) => set({ discountValue: parseFloat(e.target.value) || 0 })} />
          )}
        </div>
      </section>

      <section className="border-t pt-3 space-y-1 text-right">
        <p>Subtotal: {formatSGD(totals.sub)}</p>
        {totals.disc > 0 && <p>Discount: −{formatSGD(totals.disc)}</p>}
        <p className="text-lg font-bold">Total due: {formatSGD(totals.total)}</p>
      </section>

      {error && <p className="text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onSaveDraft} disabled={busy !== ""} className="flex-1 border rounded-lg p-3 disabled:opacity-50">
          {busy === "draft" ? "Saving…" : "Save draft"}
        </button>
        <button onClick={onFinalize} disabled={busy !== "" || totals.total <= 0 || (!f.customerId && !f.newCustomer?.name)}
          className="flex-1 rounded-lg bg-black text-white p-3 disabled:opacity-50">
          {busy === "final" ? "Finalizing…" : "Finalize invoice"}
        </button>
      </div>
    </main>
  );
}
```

Create `src/app/invoices/new/page.tsx`:

```tsx
import InvoiceForm from "@/components/InvoiceForm";

export default async function NewInvoicePage({ searchParams }: {
  searchParams: Promise<{ duplicate?: string; draft?: string }>;
}) {
  const { duplicate, draft } = await searchParams;
  return <InvoiceForm duplicateId={duplicate} draftId={draft} />;
}
```

- [ ] **Step 6: Verify manually**

- Fill half the form, hard-reload → fields restored (localStorage autosave).
- Add a new customer inline, Save draft → row appears in Supabase table editor with `status='draft'`, `invoice_number` null.
- Finalize → invoice gets `A-30`, settings `next_invoice_seq` becomes 31, redirected to `/invoices/<id>` (404 until Task 10 — the redirect + DB state is the pass signal).
- Preset picker inserts a line with the preset's description and price.

- [ ] **Step 7: Commit**

```bash
git add src/lib/formStorage.ts src/lib/formStorage.test.ts src/components/InvoiceForm.tsx src/app/invoices/new
git commit -m "feat: invoice form with autosave, presets, discounts, draft/finalize"
```

---

### Task 9: Dashboard (list, overdue, paid toggle, duplicate)

**Files:**
- Create: `src/components/Dashboard.tsx`
- Modify: `src/app/page.tsx` (replace scaffold home)

**Interfaces:**
- Consumes: `listInvoices, setPaid, deleteInvoice` (Task 6), `isOverdue` (Task 4), `formatSGD` (Task 2).

- [ ] **Step 1: Implement**

Replace `src/app/page.tsx`:

```tsx
import Dashboard from "@/components/Dashboard";
export default function Home() { return <Dashboard />; }
```

Create `src/components/Dashboard.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { deleteInvoice, listInvoices, setPaid } from "@/lib/db";
import { formatSGD } from "@/lib/money";
import { isOverdue, type Invoice } from "@/lib/types";

export default function Dashboard() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);

  useEffect(() => { listInvoices().then(setInvoices); }, []);
  if (!invoices) return <p className="p-6">Loading…</p>;

  const outstanding = invoices
    .filter((i) => i.status === "unpaid")
    .reduce((s, i) => s + i.total_cents, 0);

  async function togglePaid(inv: Invoice) {
    const paid = inv.status !== "paid";
    await setPaid(inv.id, paid);
    setInvoices(invoices!.map((i) => i.id === inv.id
      ? { ...i, status: paid ? "paid" : "unpaid", paid_date: paid ? new Date().toISOString().slice(0, 10) : null }
      : i));
  }

  async function removeDraft(inv: Invoice) {
    if (!confirm("Delete this draft?")) return;
    await deleteInvoice(inv.id);
    setInvoices(invoices!.filter((i) => i.id !== inv.id));
  }

  function badge(inv: Invoice) {
    if (inv.status === "draft") return <span className="text-xs rounded-full bg-gray-200 px-2 py-1">Draft</span>;
    if (inv.status === "paid") return <span className="text-xs rounded-full bg-green-100 text-green-700 px-2 py-1">Paid</span>;
    if (isOverdue(inv)) return <span className="text-xs rounded-full bg-red-100 text-red-700 px-2 py-1">Overdue</span>;
    return <span className="text-xs rounded-full bg-amber-100 text-amber-700 px-2 py-1">Unpaid</span>;
  }

  return (
    <main className="max-w-xl mx-auto p-4 space-y-4 text-sm">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">Invoices</h1>
        <p className="text-gray-500">Outstanding: <span className="font-semibold text-black">{formatSGD(outstanding)}</span></p>
      </div>

      {invoices.length === 0 && (
        <p className="text-gray-500">No invoices yet. <Link className="underline" href="/invoices/new">Create your first one.</Link></p>
      )}

      {invoices.map((inv) => (
        <div key={inv.id} className="border rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Link href={inv.status === "draft" ? `/invoices/new?draft=${inv.id}` : `/invoices/${inv.id}`}
              className="flex-1 min-w-0">
              <div className="font-semibold truncate">
                {inv.invoice_number ?? "Draft"} · {inv.customers?.name ?? "—"}
              </div>
              <div className="text-gray-500 truncate">{inv.job_event || "No event"} · {inv.issue_date}</div>
            </Link>
            <div className="font-semibold">{formatSGD(inv.total_cents)}</div>
            {badge(inv)}
          </div>
          <div className="flex gap-3 text-xs text-gray-600">
            {inv.status !== "draft" && (
              <button onClick={() => togglePaid(inv)} className="underline">
                {inv.status === "paid" ? "Mark unpaid" : "Mark paid"}
              </button>
            )}
            <Link href={`/invoices/new?duplicate=${inv.id}`} className="underline">Duplicate</Link>
            {inv.status === "draft" && (
              <button onClick={() => removeDraft(inv)} className="underline text-red-600">Delete</button>
            )}
          </div>
        </div>
      ))}
    </main>
  );
}
```

- [ ] **Step 2: Verify manually**

Dashboard lists the Task 8 invoice; Mark paid flips badge and drops outstanding to $0; Mark unpaid restores; Duplicate opens a pre-filled form with today's date; to see Overdue, temporarily set an invoice's `issue_date` two months back in Supabase table editor and reload.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx src/components/Dashboard.tsx
git commit -m "feat: dashboard with overdue flags, paid toggle, duplicate"
```

---

### Task 10: Invoice detail + PDF with PayNow QR

**Files:**
- Create: `src/app/invoices/[id]/page.tsx`, `src/components/InvoiceDetail.tsx`, `src/components/InvoicePdf.tsx`, `src/lib/qr.ts`

**Interfaces:**
- Consumes: `getInvoice, getSettings` (Task 6), `paynowPayload` (Task 3), money lib, types.
- Produces:
  - `qrDataUrl(payload: string): Promise<string>` in `src/lib/qr.ts`
  - `<InvoicePdf invoice settings qrDataUrl />` — a `@react-pdf/renderer` `<Document>`
  - `/invoices/<id>` — detail page with a **Download PDF / Share** button that generates the PDF blob client-side and hands it to `navigator.share` (files) when available, else downloads.

- [ ] **Step 1: QR helper**

Create `src/lib/qr.ts`:

```ts
import QRCode from "qrcode";

export function qrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 1, width: 512 });
}
```

- [ ] **Step 2: PDF document**

Create `src/components/InvoicePdf.tsx` — clean modern layout, all data driven:

```tsx
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { discountCents, formatSGD, lineTotalCents } from "@/lib/money";
import type { Invoice, Settings } from "@/lib/types";

const s = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: "Helvetica", color: "#111" },
  row: { flexDirection: "row" },
  h1: { fontSize: 28, fontFamily: "Helvetica-Bold", letterSpacing: 2 },
  label: { color: "#777", fontSize: 8, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 },
  block: { marginBottom: 16 },
  tableHead: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#111", paddingBottom: 4, marginBottom: 6 },
  cellDesc: { flex: 5 }, cellQty: { flex: 1, textAlign: "right" },
  cellAmt: { flex: 1.5, textAlign: "right" }, cellTot: { flex: 1.5, textAlign: "right" },
  bold: { fontFamily: "Helvetica-Bold" },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", gap: 24, marginTop: 4 },
  qr: { width: 110, height: 110 },
  footer: { position: "absolute", bottom: 40, left: 48, right: 48, textAlign: "center", color: "#999", fontSize: 8 },
});

export default function InvoicePdf({ invoice, settings, qr }: {
  invoice: Invoice; settings: Settings; qr: string;
}) {
  const sub = invoice.subtotal_cents;
  const disc = discountCents(sub, invoice.discount_type, invoice.discount_value);
  return (
    <Document title={`Invoice ${invoice.invoice_number}`}>
      <Page size="A4" style={s.page}>
        <View style={[s.row, { justifyContent: "space-between", marginBottom: 24 }]}>
          <View>
            <Text style={s.h1}>{settings.business_name.toUpperCase()}</Text>
            <Text>{settings.address}</Text>
            <Text>{settings.phone} · {settings.email}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[s.bold, { fontSize: 16 }]}>INVOICE</Text>
            <Text>No. {invoice.invoice_number}</Text>
            <Text>Date: {invoice.issue_date}</Text>
            {invoice.customer_id != null && <Text>Customer ID: {invoice.customer_id}</Text>}
          </View>
        </View>

        <View style={[s.row, { gap: 32 }, s.block]}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Bill to</Text>
            <Text style={s.bold}>{invoice.customers?.name}</Text>
            {invoice.customers?.address ? <Text>{invoice.customers.address}</Text> : null}
            {invoice.customers?.phone ? <Text>{invoice.customers.phone}</Text> : null}
            {invoice.customers?.email ? <Text>{invoice.customers.email}</Text> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Job</Text>
            <Text style={s.bold}>{invoice.job_event}</Text>
            {invoice.job_date ? <Text>{invoice.job_date}</Text> : null}
            {invoice.job_location ? <Text>{invoice.job_location}</Text> : null}
            <Text style={[s.label, { marginTop: 8 }]}>Payment terms</Text>
            <Text>{settings.payment_terms}</Text>
          </View>
        </View>

        <View style={s.tableHead}>
          <Text style={[s.cellDesc, s.bold]}>DESCRIPTION</Text>
          <Text style={[s.cellQty, s.bold]}>QTY</Text>
          <Text style={[s.cellAmt, s.bold]}>UNIT</Text>
          <Text style={[s.cellTot, s.bold]}>TOTAL</Text>
        </View>
        {invoice.line_items.map((li, i) => (
          <View key={i} style={[s.row, { marginBottom: 6 }]}>
            <Text style={s.cellDesc}>{li.description}</Text>
            <Text style={s.cellQty}>{li.qty}</Text>
            <Text style={s.cellAmt}>{formatSGD(li.unitPriceCents)}</Text>
            <Text style={s.cellTot}>{formatSGD(lineTotalCents(li))}</Text>
          </View>
        ))}

        <View style={{ borderTopWidth: 1, borderColor: "#111", marginTop: 8, paddingTop: 8 }}>
          {disc > 0 && (
            <>
              <View style={s.totalRow}><Text>Subtotal</Text><Text>{formatSGD(sub)}</Text></View>
              <View style={s.totalRow}>
                <Text>Discount{invoice.discount_type === "percent" ? ` (${invoice.discount_value}%)` : ""}</Text>
                <Text>−{formatSGD(disc)}</Text>
              </View>
            </>
          )}
          <View style={s.totalRow}>
            <Text style={[s.bold, { fontSize: 13 }]}>TOTAL DUE</Text>
            <Text style={[s.bold, { fontSize: 13 }]}>{formatSGD(invoice.total_cents)}</Text>
          </View>
        </View>

        <View style={[s.row, { marginTop: 32, gap: 24 }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Payment</Text>
            <Text>Scan the QR to PayNow the exact amount, or PayNow to "{settings.paynow_number}".</Text>
            <Text>Reference: {invoice.invoice_number}</Text>
            <Text style={{ marginTop: 6 }}>Cheques crossed, payable to "{settings.payee_name}".</Text>
            <Text>{settings.bank_details}</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Image style={s.qr} src={qr} />
            <Text style={{ fontSize: 8, marginTop: 4 }}>PayNow · {formatSGD(invoice.total_cents)}</Text>
          </View>
        </View>

        <Text style={s.footer}>THANK YOU FOR YOUR BUSINESS!</Text>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 3: Detail page with share/download**

Create `src/app/invoices/[id]/page.tsx`:

```tsx
import InvoiceDetail from "@/components/InvoiceDetail";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvoiceDetail id={id} />;
}
```

Create `src/components/InvoiceDetail.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getInvoice, getSettings } from "@/lib/db";
import { formatSGD } from "@/lib/money";
import { paynowPayload } from "@/lib/paynow";
import { qrDataUrl } from "@/lib/qr";
import type { Invoice, Settings } from "@/lib/types";

export default function InvoiceDetail({ id }: { id: string }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getInvoice(id).then(setInvoice).catch((e) => setError(e.message));
    getSettings().then(setSettings);
  }, [id]);

  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (!invoice || !settings) return <p className="p-6">Loading…</p>;

  async function sharePdf() {
    setBusy(true);
    try {
      const inv = invoice!; const st = settings!;
      const payload = paynowPayload({
        mobile: st.paynow_number,
        amountCents: inv.total_cents,
        reference: inv.invoice_number ?? "",
        merchantName: st.payee_name.toUpperCase(),
      });
      const qr = await qrDataUrl(payload);
      const { pdf } = await import("@react-pdf/renderer");
      const { default: InvoicePdf } = await import("@/components/InvoicePdf");
      const blob = await pdf(<InvoicePdf invoice={inv} settings={st} qr={qr} />).toBlob();
      const file = new File([blob], `Invoice ${inv.invoice_number}.pdf`, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Invoice ${inv.invoice_number}` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement("a"), { href: url, download: file.name });
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <main className="max-w-xl mx-auto p-4 space-y-4 text-sm">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{invoice.invoice_number}</h1>
        <span className="text-gray-500">{invoice.status.toUpperCase()}</span>
      </div>
      <div className="border rounded-xl p-4 space-y-1">
        <p className="font-semibold">{invoice.customers?.name}</p>
        <p>{invoice.job_event}</p>
        <p className="text-gray-500">{invoice.job_date} · {invoice.job_location}</p>
        <p className="text-lg font-bold pt-2">{formatSGD(invoice.total_cents)}</p>
      </div>
      <button onClick={sharePdf} disabled={busy}
        className="w-full rounded-lg bg-black text-white p-3 disabled:opacity-50">
        {busy ? "Generating…" : "Download / Share PDF"}
      </button>
      <Link href={`/invoices/new?duplicate=${invoice.id}`} className="block text-center underline">
        Duplicate this invoice
      </Link>
    </main>
  );
}
```

- [ ] **Step 4: Verify manually**

Open the finalized invoice from Task 8 → detail shows; Download/Share produces a PDF that (a) matches the data, (b) shows subtotal/discount lines when a discount exists, (c) has a scannable QR — scan with a Singapore banking app against a $0.01 test invoice to confirm amount + reference prefill. On Mac Safari/Chrome it downloads; on iPhone it opens the share sheet.

- [ ] **Step 5: Commit**

```bash
git add src/lib/qr.ts src/components/InvoicePdf.tsx src/components/InvoiceDetail.tsx src/app/invoices/[id]
git commit -m "feat: invoice detail with client-side PDF and dynamic PayNow QR"
```

---

### Task 11: Stats page

**Files:**
- Create: `src/app/stats/page.tsx`, `src/lib/stats.ts`
- Test: `src/lib/stats.test.ts`

**Interfaces:**
- Consumes: `listInvoices` (Task 6), `formatSGD`.
- Produces:
  - `yearlyStats(invoices: Invoice[]): Array<{ year: number; invoicedCents: number; collectedCents: number }>` (excludes drafts; `collected` = paid invoices only; sorted desc)
  - `monthlyStats(invoices: Invoice[], year: number): Array<{ month: number; invoicedCents: number; collectedCents: number }>` (12 entries, month 1–12)
  - `clientStats(invoices: Invoice[]): Array<{ name: string; invoicedCents: number }>` (sorted desc)

- [ ] **Step 1: Write failing tests**

Create `src/lib/stats.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { clientStats, monthlyStats, yearlyStats } from "./stats";
import type { Invoice } from "./types";

function inv(over: Partial<Invoice>): Invoice {
  return {
    id: "x", invoice_number: "A-1", status: "unpaid", issue_date: "2026-06-23",
    customer_id: 1, job_event: "", job_date: "", job_location: "",
    line_items: [], discount_type: "none", discount_value: 0,
    subtotal_cents: 0, total_cents: 50000, paid_date: null,
    customers: { id: 1, name: "Jordan", phone: "", email: "", address: "" },
    ...over,
  };
}

const data = [
  inv({ status: "paid", total_cents: 50000 }),                       // 2026-06, paid
  inv({ status: "unpaid", total_cents: 30000, issue_date: "2026-01-10" }),
  inv({ status: "paid", total_cents: 20000, issue_date: "2025-12-01",
        customers: { id: 2, name: "Acme", phone: "", email: "", address: "" } }),
  inv({ status: "draft", total_cents: 99900 }),                      // excluded everywhere
];

describe("stats", () => {
  test("yearlyStats groups by year, excludes drafts", () => {
    expect(yearlyStats(data)).toEqual([
      { year: 2026, invoicedCents: 80000, collectedCents: 50000 },
      { year: 2025, invoicedCents: 20000, collectedCents: 20000 },
    ]);
  });

  test("monthlyStats returns 12 months for a year", () => {
    const m = monthlyStats(data, 2026);
    expect(m).toHaveLength(12);
    expect(m[0]).toEqual({ month: 1, invoicedCents: 30000, collectedCents: 0 });
    expect(m[5]).toEqual({ month: 6, invoicedCents: 50000, collectedCents: 50000 });
  });

  test("clientStats sorts by total desc, excludes drafts", () => {
    expect(clientStats(data)).toEqual([
      { name: "Jordan", invoicedCents: 80000 },
      { name: "Acme", invoicedCents: 20000 },
    ]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/stats.test.ts` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

Create `src/lib/stats.ts`:

```ts
import type { Invoice } from "./types";

const real = (invoices: Invoice[]) => invoices.filter((i) => i.status !== "draft");

export function yearlyStats(invoices: Invoice[]) {
  const map = new Map<number, { invoicedCents: number; collectedCents: number }>();
  for (const i of real(invoices)) {
    const year = Number(i.issue_date.slice(0, 4));
    const e = map.get(year) ?? { invoicedCents: 0, collectedCents: 0 };
    e.invoicedCents += i.total_cents;
    if (i.status === "paid") e.collectedCents += i.total_cents;
    map.set(year, e);
  }
  return [...map.entries()]
    .map(([year, e]) => ({ year, ...e }))
    .sort((a, b) => b.year - a.year);
}

export function monthlyStats(invoices: Invoice[], year: number) {
  const months = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1, invoicedCents: 0, collectedCents: 0,
  }));
  for (const i of real(invoices)) {
    if (Number(i.issue_date.slice(0, 4)) !== year) continue;
    const m = months[Number(i.issue_date.slice(5, 7)) - 1];
    m.invoicedCents += i.total_cents;
    if (i.status === "paid") m.collectedCents += i.total_cents;
  }
  return months;
}

export function clientStats(invoices: Invoice[]) {
  const map = new Map<string, number>();
  for (const i of real(invoices)) {
    const name = i.customers?.name ?? "Unknown";
    map.set(name, (map.get(name) ?? 0) + i.total_cents);
  }
  return [...map.entries()]
    .map(([name, invoicedCents]) => ({ name, invoicedCents }))
    .sort((a, b) => b.invoicedCents - a.invoicedCents);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/stats.test.ts` — Expected: PASS.

- [ ] **Step 5: Stats page**

Create `src/app/stats/page.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { listInvoices } from "@/lib/db";
import { formatSGD } from "@/lib/money";
import { clientStats, monthlyStats, yearlyStats } from "@/lib/stats";
import type { Invoice } from "@/lib/types";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export default function StatsPage() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => { listInvoices().then(setInvoices); }, []);
  if (!invoices) return <p className="p-6">Loading…</p>;

  const years = yearlyStats(invoices);
  const months = monthlyStats(invoices, year);
  const clients = clientStats(invoices);
  const max = Math.max(...months.map((m) => m.invoicedCents), 1);
  const outstanding = invoices.filter((i) => i.status === "unpaid").reduce((s, i) => s + i.total_cents, 0);

  return (
    <main className="max-w-xl mx-auto p-4 space-y-6 text-sm">
      <h1 className="text-xl font-bold">Stats</h1>
      <p>Outstanding (unpaid): <span className="font-bold">{formatSGD(outstanding)}</span></p>

      <section>
        <h2 className="font-semibold mb-2">By year</h2>
        {years.map((y) => (
          <button key={y.year} onClick={() => setYear(y.year)}
            className={`w-full flex justify-between border rounded-lg p-3 mb-2 ${y.year === year ? "border-black" : ""}`}>
            <span>{y.year}</span>
            <span>Invoiced {formatSGD(y.invoicedCents)} · Collected {formatSGD(y.collectedCents)}</span>
          </button>
        ))}
        {years.length === 0 && <p className="text-gray-500">No finalized invoices yet.</p>}
      </section>

      <section>
        <h2 className="font-semibold mb-2">{year} by month</h2>
        <div className="flex items-end gap-1 h-32">
          {months.map((m) => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full bg-gray-200 rounded-t relative" style={{ height: `${(m.invoicedCents / max) * 100}%` }}>
                <div className="absolute bottom-0 w-full bg-black rounded-t"
                  style={{ height: m.invoicedCents ? `${(m.collectedCents / m.invoicedCents) * 100}%` : 0 }} />
              </div>
              <span className="text-[10px] text-gray-500">{MONTHS[m.month - 1]}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1">Grey = invoiced · Black = collected</p>
      </section>

      <section>
        <h2 className="font-semibold mb-2">By client</h2>
        {clients.map((c) => (
          <div key={c.name} className="flex justify-between border-b py-2">
            <span>{c.name}</span><span>{formatSGD(c.invoicedCents)}</span>
          </div>
        ))}
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Verify manually**

`/stats` shows the year rows, bar chart, and client totals matching the invoices created so far; tapping a different year re-renders the chart.

- [ ] **Step 7: Commit**

```bash
git add src/lib/stats.ts src/lib/stats.test.ts src/app/stats
git commit -m "feat: income stats (yearly, monthly chart, per-client)"
```

---

### Task 12: PWA polish + full test pass + deploy

**Files:**
- Create: `src/app/manifest.ts`, `public/icons/icon-192.png`, `public/icons/icon-512.png`
- Modify: `src/app/layout.tsx` (metadata)

**Interfaces:**
- Consumes: everything.
- Produces: installable home-screen app, deployed production URL on Vercel.

- [ ] **Step 1: Web manifest + iOS meta**

Create `src/app/manifest.ts`:

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JJ Visuals Invoices",
    short_name: "Invoices",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
```

Generate simple icons (black square, white "JJ" text) with a one-off script or any tool; place at `public/icons/`. In `src/app/layout.tsx` metadata export add:

```ts
export const metadata: Metadata = {
  title: "JJ Visuals Invoices",
  description: "Invoice generator for JJ Visuals",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Invoices" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1 };
```

- [ ] **Step 2: Full verification**

```bash
npx vitest run        # all suites pass
npx tsc --noEmit      # clean
npm run build         # production build succeeds
```

- [ ] **Step 3: Deploy to Vercel**

```bash
npx vercel link       # create/link project (user may need to authenticate)
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
npx vercel --prod
```

Then in the Supabase dashboard → Authentication → URL Configuration: set Site URL to the Vercel production URL.

- [ ] **Step 4: End-to-end smoke test on iPhone**

On the phone: open production URL in Safari → login → Share → Add to Home Screen → open from home screen → create a real invoice ($0.01 to yourself) → finalize → share PDF via share sheet → scan QR with banking app → mark paid → check stats.

- [ ] **Step 5: Commit and push**

```bash
git add -A
git commit -m "feat: PWA manifest, icons, production deploy config"
```

---

## Self-Review Notes

- **Spec coverage:** login/security (T4–5), dashboard + overdue + duplicate + paid toggle (T9), invoice form + drafts + autosave + presets + discounts + auto-numbering (T8, function in T4), PDF + dynamic QR (T3, T10), stats (T11), settings + presets management (T7), PWA/deploy (T12). Out-of-scope items from spec remain out.
- **Type consistency:** `LineItem`/`DiscountType` defined once in `money.ts`, re-exported through `types.ts` imports; DB column names snake_case, mapped 1:1 in `types.ts`.
- **Known risk:** PayNow payload field ordering/flags vary slightly across bank apps — Task 3 Step 5 and Task 10 Step 4 both include a real-device scan check before the format is trusted.
