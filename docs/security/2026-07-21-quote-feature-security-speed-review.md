# Security & Speed Review — 3D-Print Quote Feature + Stability Fixes

Date: 2026-07-21
Scope: the 3D-print quote calculator (the app's first public, unauthenticated
route and first anonymous write path) plus the stability/UX batch that shipped
with it (mouse-scroll fix, Clients page, invoice-numbering settings, PDF
refresh).

## Result

No high-confidence data-exposure or auth-bypass vulnerabilities found. One
real abuse vector on the new anonymous upload path (storage bulk-upload)
was partially mitigated in-app; fully closing it needs edge rate limiting.
Two performance items addressed. Details below.

## Security findings

### 1. Anonymous storage bulk-upload — partially mitigated, edge rate-limiting recommended

- **Category:** resource abuse / denial-of-wallet
- **Severity:** medium (no data exposure; free-tier resource exhaustion)

`/quote/[slug]` lets anyone upload an STL to the `print-quote-files` bucket
before (and independent of) submitting a quote row. The bucket caps files at
25 MB and restricts MIME types, but the original `anon` insert policy
authorized *any* object in the bucket, so a scripted client could push
unlimited files and exhaust free-tier storage (~40 × 25 MB ≈ 1 GB).

**Applied (migration 006):** the `anon` insert policy now requires the
object's first path segment to be a real, non-archived business id, so files
can't be sprayed to arbitrary keys and every object ties back to a live
business. This blocks garbage-path spraying but does **not** rate-limit an
attacker who uses a valid business id (business ids are readable by anon,
which the public page requires).

**Recommended next (not in-app):** put rate limiting / bot detection in front
of `/quote` — Vercel BotID or Firewall rules are the intended tool. Longer
term, routing uploads through an authenticated/edge-validated endpoint (so
the DB quote row and the file are created together) would remove the
standalone upload entirely.

### 2. Anonymous read of pricing settings & business list — reviewed, acceptable

The public page reads `businesses` (id/name/slug) and `print_pricing_settings`
via the `anon` role. Both are intentionally exposed and hold no secrets
(pricing math only). RLS scopes both to non-archived businesses, and `anon`
has SELECT-only on them and INSERT-only on `print_quotes` (no read-back, so
quotes can't be enumerated). No change needed.

### 3. Route-gate boundary (`/quote` vs `/quotes`) — verified correct

The login-gate exclusion for the public `/quote/[slug]` page uses
boundary-aware matching (`quote(?:$|/)` in the proxy matcher;
`=== "/quote" || startsWith("/quote/")` in the client checks), so the
authenticated `/quotes` owner inbox stays gated. Hand-verified against
`/quote`, `/quote/x`, `/quotes`, `/quotation`, `/`, `/settings`. (This was a
bug caught and fixed during the feature's own review.)

### 4. Client-number change (migration 005) — reviewed, safe

Changing a customer's primary key cascades to that customer's invoices via
`ON UPDATE CASCADE`, so no invoice is orphaned. A collision on an existing
number surfaces a friendly error rather than a raw constraint violation. The
operation is owner-only (RLS). No issue.

### Carried forward from the prior review

`proxy.ts` still uses `getSession()` (local JWT decode, no network) rather
than `getUser()` — a deliberate tradeoff documented in
`2026-07-20-multi-business-security-review.md`. RLS remains the real
authorization boundary; unchanged by this work.

## Speed findings

### 1. Quotes inbox query — indexed (migration 006)

`listPrintQuotes` filters `business_id` and orders `created_at desc`. Added a
matching `print_quotes(business_id, created_at desc)` composite index so the
owner inbox stays index-served as quote volume grows.

### 2. Public quote page pricing is fully client-side — good

STL parsing, volume/weight/time, and price all run in the browser
(`stlQuote.ts`); the server component does only two lightweight indexed
lookups (business by slug, settings by business_id) before render. No
server-side geometry work, so a large STL doesn't cost server CPU.

### 3. Free-tier auto-pause interaction — watch, not blocking

`/quote/[slug]` is a server component that must hit Supabase, unlike
`proxy.ts` (kept network-free after the earlier 504 outage). The existing
keep-alive cron keeps the project warm, so normal traffic is fine. A genuine
public-traffic burst against the free-tier connection limit remains a scaling
consideration for if/when the quote page gets real volume — pairs naturally
with the edge rate limiting recommended in security finding 1.

## Methodology

Manual review of the new anonymous surface (RLS policies, storage policies,
the public route/component, and the client→DB write path), cross-referenced
against the feature's own multi-stage code review. Storage-policy and index
changes were applied via migration 006 and verified live against the database
(`pg_policies`, `pg_indexes`). The mouse-scroll fix was verified by
reproducing the dead-wheel behavior and confirming the fix with Playwright
across multiple pages.
