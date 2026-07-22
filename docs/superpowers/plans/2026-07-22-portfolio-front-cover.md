# Portfolio Front Cover + /invoices_login Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the Apex Angles portfolio at `/` (static, mobile+desktop, no PWA, no login link) and move the entire invoice app under `/invoices_login` (login at `/invoices_login`, tabs at `/invoices_login/<tab>`).

**Architecture:** Route-move via `git mv` under `src/app/invoices_login/` with the invoice chrome (fonts, TopBar/BottomNav, BusinessProvider, PWA metadata) relocated from the root layout into `src/app/invoices_login/layout.tsx`. The portfolio (a 739-line single-component Vite app in `/Users/mynameisjiajun/Downloads/apex-angles`) is copied into `src/components/portfolio/`, stripped of its Gemini chat, and rendered by a new server `src/app/page.tsx` with self-hosted Oswald/Inter fonts and a Tailwind v4 `@theme` block replacing its CDN config.

**Tech Stack:** Next.js 16 App Router, Tailwind v4 (`@theme` in `globals.css`), `next/font`, lucide-react (new dep), Supabase (unchanged), vitest + Playwright for verification.

**Spec:** `docs/superpowers/specs/2026-07-22-portfolio-front-cover-design.md`

## Global Constraints

- Portfolio source: `/Users/mynameisjiajun/Downloads/apex-angles` (`App.tsx`, `types.ts`). Apply the code as-is except: strip the AI chat, rename `font-display`→`font-apex-display` and `font-sans`→`font-apex-sans`, and adapt imports. Do NOT rewrite sections, copy, or media.
- **No link to the invoice app anywhere on the portfolio.**
- URL prefix is exactly `invoices_login` (underscore). Login page = `/invoices_login`. Public quote page = `/invoices_login/quote/[slug]`, still unauthenticated.
- Permanent (308) redirects: `/login` → `/invoices_login`; `/quote/:slug` → `/invoices_login/quote/:slug`. No other legacy redirects.
- `/api/keepalive` stays at its current path.
- Portfolio page must build as static (`○` in the build output). No manifest link on it.
- CSP additions limited to: `https://images.unsplash.com` in `img-src`; new directive `media-src 'self' https://cdn.coverr.co`. Never remove existing sources.
- The Gemini chat, `services/geminiService.ts`, and `@google/genai` are NOT ported. Do not add a `GEMINI_API_KEY` anywhere.
- Existing vitest suite must stay green after every task: `npm test`.
- Dev-server hygiene: `pkill -f "next dev"` before starting one (stale servers squat on port 3000).

---

### Task 1: Move the invoice app under `/invoices_login`

**Files:**
- Move (git mv): `src/app/login/page.tsx` → `src/app/invoices_login/page.tsx`; `src/app/page.tsx` → `src/app/invoices_login/invoices/page.tsx`; `src/app/invoices/[id]/page.tsx` → `src/app/invoices_login/invoices/[id]/page.tsx`; `src/app/invoices/new/page.tsx` → `src/app/invoices_login/invoices/new/page.tsx`; `src/app/customers/page.tsx` → `src/app/invoices_login/customers/page.tsx`; `src/app/quotes/page.tsx` → `src/app/invoices_login/quotes/page.tsx`; `src/app/settings/page.tsx` → `src/app/invoices_login/settings/page.tsx`; `src/app/stats/page.tsx` → `src/app/invoices_login/stats/page.tsx`; `src/app/quote/[slug]/page.tsx` → `src/app/invoices_login/quote/[slug]/page.tsx`
- Create: `src/app/invoices_login/layout.tsx`, `public/manifest.webmanifest`
- Modify: `src/app/layout.tsx`, `src/proxy.ts`, `next.config.ts`, `src/app/globals.css:125-160`, `src/components/TopBar.tsx`, `src/components/BottomNav.tsx`, `src/components/Dashboard.tsx:174`, `src/components/InvoiceForm.tsx:160,171,375`, `src/components/InvoiceDetail.tsx:192`, `src/components/OnboardingBanner.tsx:37`, `src/components/PrintPricingSettingsCard.tsx:117`
- Delete: `src/app/manifest.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: invoice app fully working at the new URLs; root `src/app/page.tsx` slot is **vacant** (`/` 404s until Task 2 — expected); root layout is minimal and portfolio-ready; `.invoice-app-root` wrapper class that scopes invoice-only global CSS (film grain, body font).

- [ ] **Step 1: Move the route files**

```bash
cd "/Users/mynameisjiajun/Documents/Coding projects/invoice generator"
mkdir -p src/app/invoices_login/invoices
git mv src/app/login/page.tsx src/app/invoices_login/page.tsx
git mv src/app/page.tsx src/app/invoices_login/invoices/page.tsx
git mv src/app/invoices/\[id\] src/app/invoices_login/invoices/\[id\]
git mv src/app/invoices/new src/app/invoices_login/invoices/new
git mv src/app/customers src/app/invoices_login/customers
git mv src/app/quotes src/app/invoices_login/quotes
git mv src/app/settings src/app/invoices_login/settings
git mv src/app/stats src/app/invoices_login/stats
git mv src/app/quote src/app/invoices_login/quote
rmdir src/app/invoices src/app/login 2>/dev/null; true
```

Expected: `git status` shows renames; `src/app/` now contains `api/ favicon.ico globals.css invoices_login/ layout.tsx manifest.ts`.

- [ ] **Step 2: Create the invoice-app layout (chrome moves here from root)**

Create `src/app/invoices_login/layout.tsx`:

```tsx
import type { Metadata, Viewport } from "next";
import { Fraunces, Space_Mono, Work_Sans } from "next/font/google";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import { BusinessProvider } from "@/lib/businessContext";

// Editorial pairing: a warm, high-contrast serif for headlines (the
// "magazine" voice) against a humanist grotesque for UI text, with a
// typewriter mono for EXIF-style captions — a photographer's contact sheet,
// not a SaaS dashboard.
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz", "SOFT", "WONK"],
});

const workSans = Work_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const spaceMono = Space_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "JJ Visuals Invoices",
  description: "Invoice generator for JJ Visuals",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Invoices" },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F0E4" },
    { media: "(prefers-color-scheme: dark)", color: "#14110C" },
  ],
};

export default function InvoiceAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className={`${fraunces.variable} ${workSans.variable} ${spaceMono.variable} invoice-app-root flex-1 flex flex-col`}
    >
      <BusinessProvider>
        <TopBar />
        {children}
        <BottomNav />
      </BusinessProvider>
    </div>
  );
}
```

- [ ] **Step 3: Slim the root layout**

Replace the entire contents of `src/app/layout.tsx` with:

```tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Apex Angles | Videography & Photography",
  description:
    "Apex Angles — Singapore-based videography and photography. Edgy, cinematic, high-contrast visuals for brands, events, and editorials.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Scope invoice-only global CSS to `.invoice-app-root`**

In `src/app/globals.css`:

a) The `body` rule (line 125) keeps layout/overscroll properties but its paper theming must not leak onto the portfolio. Replace:

```css
body {
  min-height: 100%;
  overflow-x: clip;
  overscroll-behavior-y: none;
  position: relative;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-body), system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  touch-action: pan-y;
}
```

with:

```css
body {
  min-height: 100%;
  overflow-x: clip;
  overscroll-behavior-y: none;
  position: relative;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  touch-action: pan-y;
}

/* Invoice-app theming lives on its wrapper so the portfolio at `/` can
   bring its own dark theme without fighting the paper tokens. */
.invoice-app-root {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-body), system-ui, sans-serif;
}
body:has(.invoice-app-root) {
  background: var(--bg-primary);
}
```

b) The film grain overlay (line 149) must only cover the invoice app. Change the selector `body::before {` to `body:has(.invoice-app-root)::before {` (rule body unchanged).

- [ ] **Step 5: Replace the auto-linked manifest with an invoice-scoped static one**

```bash
git rm src/app/manifest.ts
```

Create `public/manifest.webmanifest`:

```json
{
  "name": "JJ Visuals Invoices",
  "short_name": "Invoices",
  "id": "/invoices_login",
  "start_url": "/invoices_login/invoices",
  "scope": "/invoices_login",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#F5F0E4",
  "theme_color": "#251F19",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

(The invoice layout's `metadata.manifest` from Step 2 links it; the portfolio gets no manifest link.)

- [ ] **Step 6: Update the auth proxy**

In `src/proxy.ts`, replace the body of `proxy()` after the supabase client setup, and the `config`, so the whole file's logic section reads:

```ts
export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // Public, unauthenticated 3D-print quote page lives inside the prefix.
  if (path.startsWith("/invoices_login/quote")) {
    return NextResponse.next({ request });
  }

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
  const { data: { session } } = await supabase.auth.getSession();

  const isLogin = path === "/invoices_login";
  if (!session && !isLogin) {
    return NextResponse.redirect(new URL("/invoices_login", request.url));
  }
  if (session && isLogin) {
    return NextResponse.redirect(new URL("/invoices_login/invoices", request.url));
  }
  return response;
}

export const config = {
  // Only the invoice app is gated. The portfolio (/), /api, and static
  // assets never touch Supabase. /invoices_login/quote/* is exempted in
  // code above (matchers can't express that cleanly).
  matcher: ["/invoices_login/:path*"],
};
```

Keep the existing header comment about optimistic auth / no network calls — it still applies verbatim.

- [ ] **Step 7: Add legacy redirects in `next.config.ts`**

Add to `nextConfig` (alongside `headers()`):

```ts
  async redirects() {
    return [
      { source: "/login", destination: "/invoices_login", permanent: true },
      // Quote links were shared with customers before the move.
      { source: "/quote/:slug", destination: "/invoices_login/quote/:slug", permanent: true },
    ];
  },
```

- [ ] **Step 8: Update every internal link/redirect to the new paths**

Exact edits (old → new, one per line):

| File | Old | New |
|---|---|---|
| `src/app/invoices_login/page.tsx` (ex-login, line 21) | `router.push("/");` | `router.push("/invoices_login/invoices");` |
| `src/app/invoices_login/settings/page.tsx` (line 44) | `router.push("/login");` | `router.push("/invoices_login");` |
| `src/components/InvoiceDetail.tsx` (line 192) | `router.push("/");` | `router.push("/invoices_login/invoices");` |
| `src/components/InvoiceForm.tsx` (lines 160, 171, 375) | `` `/invoices/${…}` `` | `` `/invoices_login/invoices/${…}` `` (all three) |
| `src/components/Dashboard.tsx` (line 174) | `href="/invoices/new"` | `href="/invoices_login/invoices/new"` |
| `src/components/OnboardingBanner.tsx` (line 37) | `href="/settings"` | `href="/invoices_login/settings"` |
| `src/components/PrintPricingSettingsCard.tsx` (line 117) | `` `${window.location.origin}/quote/${slug}` `` | `` `${window.location.origin}/invoices_login/quote/${slug}` `` |
| `src/components/TopBar.tsx` (line 8) | `p === "/quote" \|\| p.startsWith("/quote/")` | `p.startsWith("/invoices_login/quote")` |
| `src/components/TopBar.tsx` (line 15) | `pathname.startsWith("/login")` | `pathname === "/invoices_login"` |
| `src/components/TopBar.tsx` (lines 33–34) | `href="/stats"` / `startsWith("/stats")` | `href="/invoices_login/stats"` / `startsWith("/invoices_login/stats")` |
| `src/components/BottomNav.tsx` (line 6) | `p === "/quote" \|\| p.startsWith("/quote/")` | `p.startsWith("/invoices_login/quote")` |
| `src/components/BottomNav.tsx` (line 18) | `pathname.startsWith("/login")` | `pathname === "/invoices_login"` |

And replace the `tabs` array + fab in `src/components/BottomNav.tsx` (lines 8–14, 22, 27):

```ts
const tabs = [
  { href: "/invoices_login/invoices", label: "Invoices", Icon: IconCamera,
    match: (p: string) => p.startsWith("/invoices_login/invoices") && p !== "/invoices_login/invoices/new" },
  { href: "/invoices_login/quotes", label: "Quotes", Icon: IconReceipt, match: (p: string) => p.startsWith("/invoices_login/quotes") },
  { href: "/invoices_login/customers", label: "Clients", Icon: IconUser, match: (p: string) => p.startsWith("/invoices_login/customers") },
  { href: "/invoices_login/settings", label: "Settings", Icon: IconSettings, match: (p: string) => p.startsWith("/invoices_login/settings") },
];
```

plus `const newActive = pathname === "/invoices_login/invoices/new";` and the fab `<Link href="/invoices_login/invoices/new" …>`.

(Note: the Quotes match `"/invoices_login/quotes"` cannot collide with the public `"/invoices_login/quote/…"` — the trailing `s` differs.)

- [ ] **Step 9: Sweep for stragglers**

Run: `grep -rn '"/login\|"/quote\|"/invoices/\|"/customers\|"/quotes\|"/settings\|"/stats\|href="/"\|push("/")' src --include="*.tsx" --include="*.ts" | grep -v invoices_login`
Expected: no hits (the `/api/keepalive` route and CSS files don't match this pattern). Any hit = a missed link; fix it the same way.

- [ ] **Step 10: Type-check, test, build**

Run: `npx tsc --noEmit && npm test && npx next build`
Expected: all green. Build route list shows `/invoices_login`, `/invoices_login/invoices`, `/invoices_login/invoices/[id]`, `/invoices_login/invoices/new`, `/invoices_login/customers`, `/invoices_login/quotes`, `/invoices_login/quote/[slug]`, `/invoices_login/settings`, `/invoices_login/stats`, `/api/keepalive` — and NO `/` page (Task 2 adds it).

- [ ] **Step 11: Smoke-test the moved app**

```bash
pkill -f "next dev"; pkill -f "next start"
npx next start -p 3131 & sleep 3
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3131/login          # expect 308 → /invoices_login
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3131/quote/abc      # expect 308 → /invoices_login/quote/abc
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3131/invoices_login/customers  # expect 307 → /invoices_login (no session)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3131/invoices_login                 # expect 200 (login page)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3131/manifest.webmanifest           # expect 200
pkill -f "next start"
```

Then sign in through the browser (dev or start server) and click through all four tabs + stats + create-invoice to confirm navigation works and TopBar/BottomNav show everywhere except the login and public quote pages.

- [ ] **Step 12: Commit**

```bash
git add -A src/app src/components src/proxy.ts next.config.ts public/manifest.webmanifest
git commit -m "refactor: move invoice app under /invoices_login, slim root layout"
```

---

### Task 2: Portfolio page at `/`

**Files:**
- Create: `src/components/portfolio/Portfolio.tsx` (from `/Users/mynameisjiajun/Downloads/apex-angles/App.tsx`), `src/components/portfolio/types.ts` (from same dir), `src/app/page.tsx`
- Modify: `src/app/globals.css` (append theme block), `next.config.ts:21-23` (CSP), `package.json` (lucide-react)

**Interfaces:**
- Consumes: the vacant `/` slot and minimal root layout from Task 1.
- Produces: static portfolio at `/`. Exports: `src/components/portfolio/Portfolio.tsx` default-exports `Portfolio` (a `"use client"` component with no props); `src/app/page.tsx` is the only consumer.

- [ ] **Step 1: Install lucide-react and copy the sources**

```bash
cd "/Users/mynameisjiajun/Documents/Coding projects/invoice generator"
npm install lucide-react
mkdir -p src/components/portfolio
cp "/Users/mynameisjiajun/Downloads/apex-angles/App.tsx" src/components/portfolio/Portfolio.tsx
cp "/Users/mynameisjiajun/Downloads/apex-angles/types.ts" src/components/portfolio/types.ts
```

Do NOT copy `services/geminiService.ts`, `index.html`, `index.tsx`, or anything else.

- [ ] **Step 2: Strip the AI chat from `Portfolio.tsx`**

All edits in `src/components/portfolio/Portfolio.tsx`:

1. Add `"use client";` as the very first line (it uses hooks and browser APIs).
2. Delete line `import { sendMessageToGemini } from './services/geminiService';`.
3. Change `import { PortfolioCategory, Project, Service, ChatMessage } from './types';` to `import { PortfolioCategory, Project, Service } from './types';` (path already relative — now resolves to the copied `types.ts`).
4. Delete the entire `AIChat` component: from the line `const AIChat: React.FC = () => {` (originally line 208) down to the line **before** `const SectionHeader: React.FC<…` (originally line 314) — the component and its closing `};`.
5. Delete the line `<AIChat />` near the end (originally line 734).
6. Rename the main component: `const App: React.FC = () => {` → `const Portfolio: React.FC = () => {` and `export default App;` → `export default Portfolio;`.
7. Remove now-unused lucide imports. Check each with grep, e.g. `grep -c "MessageSquare" src/components/portfolio/Portfolio.tsx` — for any icon whose only remaining count is the import line itself, delete it from the import list (expected: `MessageSquare`, `Sparkles`, possibly `Zap`/`X` — but `X` is also used by the mobile menu, verify before removing). `npx tsc --noEmit` and the build's lint pass are the arbiters.

- [ ] **Step 3: Rename the font utility classes**

```bash
sed -i '' 's/font-display/font-apex-display/g; s/font-sans/font-apex-sans/g' src/components/portfolio/Portfolio.tsx
grep -c "font-apex-display" src/components/portfolio/Portfolio.tsx   # expect > 0
grep -c "font-display\b" src/components/portfolio/Portfolio.tsx      # expect 0 (only apex variants remain)
```

(The rename avoids colliding with the invoice app's `--font-display` variable, which is Fraunces.)

- [ ] **Step 4: Add the portfolio theme block to `globals.css`**

Append at the end of `src/app/globals.css`:

```css
/* ── Apex Angles portfolio (route: /) ──
   Replaces the Vite prototype's tailwind-CDN config. Brand tokens are
   namespaced (brand-*, font-apex-*) so they can't collide with the
   invoice app's design system above. */
@theme {
  --color-brand-orange: #FF6B00;
  --color-brand-dark: #0A0A0A;
  --color-brand-gray: #171717;
  --font-apex-display: var(--font-oswald), sans-serif;
  --font-apex-sans: var(--font-inter), sans-serif;
  --animate-marquee-right: marqueeRight 60s linear infinite;
}
@keyframes marqueeRight {
  0% { transform: translateX(-50%); }
  100% { transform: translateX(0%); }
}
/* The portfolio is a one-pager with #anchor nav links. */
html:has([data-apex-root]) {
  scroll-behavior: smooth;
}
```

(`animate-fade-in` / `animate-slide-up` already exist in this file and are close enough to the prototype's 0.5s versions — reuse them, don't redefine.)

- [ ] **Step 5: Create the portfolio route**

Create `src/app/page.tsx`:

```tsx
import { Inter, Oswald } from "next/font/google";
import Portfolio from "@/components/portfolio/Portfolio";

// Self-hosted via next/font: no Google Fonts CDN request, so the strict
// CSP needs no font-src/style-src additions for this page.
const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
});

export default function HomePage() {
  return (
    <div data-apex-root className={`${oswald.variable} ${inter.variable} flex-1`}>
      <Portfolio />
    </div>
  );
}
```

- [ ] **Step 6: Open the CSP for the portfolio's external media**

In `next.config.ts`, change:

```ts
  "img-src 'self' data: blob: https://vercel.live https://vercel.com",
```

to:

```ts
  "img-src 'self' data: blob: https://vercel.live https://vercel.com https://images.unsplash.com",
  "media-src 'self' https://cdn.coverr.co",
```

(Two lines replace the one; `media-src` is new — without it, `default-src 'self'` blocks the coverr.co hover-preview videos.)

- [ ] **Step 7: Type-check, test, build**

Run: `npx tsc --noEmit && npm test && npx next build`
Expected: green; build output now includes `○ /` (static). If tsc flags unused icon imports missed in Step 2.7, remove them and rerun.

- [ ] **Step 8: Visual + console verification (production server, real CSP)**

```bash
pkill -f "next dev"; pkill -f "next start"
npx next start -p 3131 & sleep 3
```

Playwright script (run with `python3`, pattern per the webapp-testing skill):

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for viewport, name in [({"width": 390, "height": 844}, "mobile"), ({"width": 1440, "height": 900}, "desktop")]:
        page = browser.new_page(viewport=viewport)
        errors = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto("http://localhost:3131/")
        page.wait_for_load_state("networkidle")
        page.screenshot(path=f"/tmp/portfolio-{name}.png", full_page=True)
        assert page.locator("text=APEX ANGLES").first.is_visible(), f"{name}: hero brand missing"
        csp = [e for e in errors if "Content Security Policy" in e or "Refused" in e]
        print(name, "console errors:", errors)
        assert not csp, f"{name}: CSP violations: {csp}"
        # No login link anywhere on the public page:
        assert page.locator('a[href*="invoices_login"]').count() == 0, f"{name}: invoice app is linked from the portfolio!"
        page.close()
    browser.close()
    print("OK")
```

Expected: `OK`; inspect both screenshots — dark theme, orange accents, Oswald headlines, hero/portfolio/rates/about/contact sections present, no film-grain/paper-background bleed from the invoice theme, no horizontal overflow at 390px. Then `pkill -f "next start"`.

- [ ] **Step 9: Commit**

```bash
git add src/app/page.tsx src/components/portfolio src/app/globals.css next.config.ts package.json package-lock.json
git commit -m "feat: Apex Angles portfolio as the site front cover at /"
```

---

### Task 3: Cleanup, docs, ship

**Files:**
- Delete: `public/next.svg`, `public/vercel.svg`, `public/window.svg`, `public/file.svg`, `public/globe.svg`
- Modify: `docs/superpowers/plans/2026-07-22-business-logo-upload.md` (path updates)

**Interfaces:**
- Consumes: Tasks 1–2 complete.
- Produces: shipped site; the pending logo-upload plan stays executable against the new structure.

- [ ] **Step 1: Delete the unused starter SVGs**

```bash
grep -rn "next.svg\|vercel.svg\|window.svg\|file.svg\|globe.svg" src
```
Expected: no hits. Then:
```bash
git rm public/next.svg public/vercel.svg public/window.svg public/file.svg public/globe.svg
```
(If grep DID hit something, keep that file and delete only the unreferenced ones.)

- [ ] **Step 2: Update the pending logo-upload plan's paths**

`docs/superpowers/plans/2026-07-22-business-logo-upload.md` was written pre-restructure. Update in place:
- Every occurrence of `src/app/settings/page.tsx` → `src/app/invoices_login/settings/page.tsx` (Task 3 header + steps).
- In its manual-verification steps, "open Settings" URLs are now under `/invoices_login/settings`; sign-in is at `/invoices_login`.
- All other paths it references (`src/lib/*`, `src/components/InvoiceDetail.tsx`, `supabase/migrations/*`, `public/logo.png`) are unchanged — verify with a quick `ls` per path and leave them alone.

- [ ] **Step 3: Full verification pass**

Run: `npx tsc --noEmit && npm test && npx next build`
Expected: green. Re-run Task 1 Step 11's curl checks and Task 2 Step 8's Playwright script against a fresh `npx next start -p 3131` — all pass.

- [ ] **Step 4: Commit and push**

```bash
git add -A docs public
git commit -m "chore: remove starter assets; update logo-upload plan for new routes"
git push origin main
```

Vercel auto-deploys `main`.

- [ ] **Step 5: Post-deploy hand-off (tell the user)**

1. apexcinematics.tech now shows the portfolio; the invoice app is at apexcinematics.tech/invoices_login (bookmark it — nothing links to it, by design).
2. If the invoice app was added to a phone home screen before, remove and re-add it from `/invoices_login/invoices` (the old install's start URL now opens the portfolio).
3. Any previously shared 3D-print quote links redirect automatically; new copies from Settings use the new URL.
4. Portfolio content is still the AI-generated placeholder set (Unsplash/Coverr media, "shoot@apexangles.sg" contact, social links to `#`) — swapping in real work/copy is a follow-up task.
5. The logo-upload feature plan is still pending and ready to execute after this.
