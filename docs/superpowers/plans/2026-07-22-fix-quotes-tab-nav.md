# Fix: Quotes Tab Hides Nav Bars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (single small task). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The 3D-print Quotes tab (`/invoices_login/quotes`) must show the app chrome again — it currently hides TopBar/BottomNav, skips business loading, and bypasses the auth proxy.

**Architecture:** During the `/invoices_login` restructure, the "is this the public quote page?" checks were written as `startsWith("/invoices_login/quote")` — which also matches `/invoices_login/quote`**`s`**. The public page is always `/invoices_login/quote/<slug>`, so the fix is the trailing slash: `startsWith("/invoices_login/quote/")` in all four places. (The original pre-restructure code had exactly this distinction: `p === "/quote" || p.startsWith("/quote/")`.)

**Tech Stack:** Next.js App Router; no new deps.

## Global Constraints

- Behaviour of the real public page `/invoices_login/quote/<slug>` must NOT change: still unauthenticated, still chrome-free.
- Existing vitest suite stays green: `npm test`.
- Run all commands from the repo root. `pkill -f "next dev"; pkill -f "next start"` before starting servers.

---

### Task 1: Trailing-slash the four public-quote checks

**Files:**
- Modify: `src/components/BottomNav.tsx:6`, `src/components/TopBar.tsx:8`, `src/lib/businessContext.tsx:36,39`, `src/proxy.ts:14`

**Interfaces:**
- Consumes/Produces: nothing — pure predicate fix.

- [ ] **Step 1: Apply the four edits**

Each is an exact string replacement; the quotes-tab path `/invoices_login/quotes` must no longer match, while `/invoices_login/quote/<slug>` still does.

| File | Old (exact) | New (exact) |
|---|---|---|
| `src/components/BottomNav.tsx:6` | `const isQuotePublic = (p: string) => p.startsWith("/invoices_login/quote");` | `const isQuotePublic = (p: string) => p.startsWith("/invoices_login/quote/");` |
| `src/components/TopBar.tsx:8` | `const isQuotePublic = (p: string) => p.startsWith("/invoices_login/quote");` | `const isQuotePublic = (p: string) => p.startsWith("/invoices_login/quote/");` |
| `src/lib/businessContext.tsx:36` | `if (pathname === "/invoices_login" \|\| pathname.startsWith("/invoices_login/quote")) return;` | `if (pathname === "/invoices_login" \|\| pathname.startsWith("/invoices_login/quote/")) return;` |
| `src/lib/businessContext.tsx:39` | `}, [pathname === "/invoices_login" \|\| pathname.startsWith("/invoices_login/quote")]);` | `}, [pathname === "/invoices_login" \|\| pathname.startsWith("/invoices_login/quote/")]);` |
| `src/proxy.ts:14` | `if (path.startsWith("/invoices_login/quote")) {` | `if (path.startsWith("/invoices_login/quote/")) {` |

Note the proxy one matters most: without it, `/invoices_login/quotes` (and any future `/invoices_login/quote-*` route) skips the auth redirect entirely. Supabase RLS still protected the data, but the gate should work as designed.

- [ ] **Step 2: Sweep for any other short-prefix checks**

Run: `grep -rn 'invoices_login/quote"' src`
Expected: no hits (every remaining occurrence ends with `quote/"` or is the literal route path `quote/[slug]`). Any hit = another missed check; apply the same trailing-slash fix.

- [ ] **Step 3: Type-check, test, build**

Run: `npx tsc --noEmit && npm test && npx next build`
Expected: all green.

- [ ] **Step 4: Behavior verification (production server)**

```bash
pkill -f "next dev"; pkill -f "next start"
npx next start -p 3131 & sleep 3
# Quotes tab is auth-gated again (was previously slipping through as 200):
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3131/invoices_login/quotes
# expect: 307 http://localhost:3131/invoices_login
# Public quote page still exempt from auth (404 for a fake slug — no redirect —
# proves the proxy exemption still applies to /quote/<slug>):
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3131/invoices_login/quote/abc
# expect: 404 with empty redirect_url
pkill -f "next start"
```

Then in a browser, sign in at `/invoices_login` and open the Quotes tab: TopBar (business name) and BottomNav (with Quotes highlighted) are both visible, and the page's business data loads. Open a real shared quote link (`/invoices_login/quote/<real-slug>`) logged out: renders publicly with no nav bars.

- [ ] **Step 5: Commit and push**

```bash
git add src/components/BottomNav.tsx src/components/TopBar.tsx src/lib/businessContext.tsx src/proxy.ts
git commit -m "fix: quotes tab matched the public-quote path prefix, hiding nav and skipping auth"
git push origin main
```

(Small targeted fix — direct to main per the project's convention for one-liner fixes, unless the portfolio-v2 branch is already checked out; then commit it there first, on its own commit, before starting v2 work.)
