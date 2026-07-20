# Security Review — Multi-Business Foundation Branch

Date: 2026-07-20
Scope: all commits on this branch (multi-business foundation feature, PWA overflow fixes, PayNow QR fix, Supabase keep-alive cron).

## Result

No high-confidence (≥8/10) security vulnerabilities were found.

## Findings considered and dismissed

### `src/proxy.ts` uses `getSession()` instead of `getUser()`

- **Category:** authentication (routing gate only)
- **Confidence after review:** 4/10 — below the reporting threshold, documented here for the record rather than as an actionable finding.

`getSession()` decodes the session cookie's JWT locally without a network round-trip to verify its signature against Supabase's Auth server, whereas `getUser()` (used by the file this replaced) does. A forged/self-signed cookie value could make `proxy.ts` treat a request as "logged in" and skip the `/login` redirect.

This was a deliberate, explicitly-commented tradeoff: `proxy.ts` runs on every request including prefetches, and a slow/unreachable Supabase call there previously caused a full-app 504 outage when the Supabase project auto-paused from inactivity. `getSession()` avoids that network dependency entirely.

The reason this doesn't rise to an actionable vulnerability: every actual data query still requires a genuinely signed JWT to pass Supabase Row Level Security, which is the real authorization boundary in this app (every table's RLS policy checks `auth.jwt()->>'email'` against the owner's account). Bypassing `proxy.ts`'s redirect only exposes the authenticated app's page shell/routing structure — comparable to what's already visible by reading the client-side JS bundle — not any actual invoice, customer, or business data.

**Noted for the future:** if a server-side API route is ever added that trusts "proxy.ts let this request through" as a proxy for "this user is verified" (rather than checking auth itself or relying on RLS), that assumption would need revisiting — at that point the gap stops being purely cosmetic.

## Methodology

Reviewed via a two-stage pipeline: an initial broad scan across the full diff for the categories in the OWASP-style checklist (injection, auth/session, crypto/secrets, code execution, data exposure), followed by an independent adversarial re-check of the one finding that surfaced, specifically investigating whether `getSession()` can genuinely be spoofed by an attacker with no prior valid session (yes, trivially — they control their own request cookies) and whether that has real data-access impact (no — RLS is untouched and remains the actual boundary).
