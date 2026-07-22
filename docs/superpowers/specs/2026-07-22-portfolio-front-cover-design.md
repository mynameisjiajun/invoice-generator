# Portfolio Front Cover + `/invoices_login` Restructure — Design

**Date:** 2026-07-22
**Status:** Approved (conversational review 2026-07-22)

## Problem

apexcinematics.tech currently serves the invoice app at `/`. The user has a new
portfolio site ("Apex Angles", an AI-Studio-generated Vite/React one-pager in
`/Users/mynameisjiajun/Downloads/apex-angles`) that should become the public front
cover, with the invoice app tucked away under an unlisted path prefix.

## Decisions (user-confirmed)

1. **Portfolio at `/`** — ported into this Next.js app as a static, mobile+desktop
   page. No PWA for it. Code applied essentially as-is (placeholder Unsplash/Coverr
   media and Apex Angles copy included; content swaps are a later, separate task).
2. **Invoice app under `/invoices_login`** — login lives at `/invoices_login`
   itself; every tab follows suit (`/invoices_login/invoices`, `/invoices_login/customers`,
   `/invoices_login/quotes`, `/invoices_login/settings`, `/invoices_login/stats`,
   `/invoices_login/invoices/new`, `/invoices_login/invoices/[id]`).
3. **No login link on the portfolio** — the user types the URL manually. Nothing on
   the public page references the invoice app.
4. **Gemini "Apex AI" chat: dropped for v1** — a static page can't hide the API key.
   The chat widget and `services/geminiService.ts` are not ported.
5. **Public 3D-print quote page moves too** → `/invoices_login/quote/[slug]`
   (stays unauthenticated). Permanent redirects keep old `/quote/[slug]` links and
   `/login` working.

## Route map

| Old | New |
|---|---|
| `/` (dashboard) | `/invoices_login/invoices` |
| `/login` | `/invoices_login` (+ 308 redirect from `/login`) |
| `/invoices/new`, `/invoices/[id]` | `/invoices_login/invoices/new`, `/invoices_login/invoices/[id]` |
| `/customers`, `/quotes`, `/settings`, `/stats` | `/invoices_login/<same>` |
| `/quote/[slug]` (public) | `/invoices_login/quote/[slug]` (+ 308 redirect) |
| `/api/keepalive` | unchanged |
| — | `/` = portfolio (new) |

## Architecture

- **Layout split.** Root layout becomes minimal (html/body + `globals.css`); the
  invoice chrome (Fraunces/Work Sans/Space Mono fonts, `TopBar`, `BottomNav`,
  `BusinessProvider`, PWA/apple metadata) moves to `src/app/invoices_login/layout.tsx`.
  Portfolio metadata (Apex Angles title/description) lives on the root page.
- **PWA scoping.** `src/app/manifest.ts` (auto-linked app-wide, would leak onto the
  portfolio) is replaced by a static `public/manifest.webmanifest` with
  `start_url`/`scope` under `/invoices_login`, hand-linked only from the invoice layout.
- **Auth proxy.** `src/proxy.ts` matcher narrows to `/invoices_login/:path*`;
  `/invoices_login/quote/*` is exempt (public); unauthenticated → `/invoices_login`,
  authenticated on the login page → `/invoices_login/invoices`. The portfolio and
  redirects never touch Supabase.
- **Portfolio port.** `App.tsx`/`types.ts` copied to `src/components/portfolio/`,
  chat stripped, rendered by a server `src/app/page.tsx` that loads Oswald + Inter
  via `next/font` (self-hosted — no Google Fonts CDN, satisfying the existing CSP).
  Tailwind-CDN config becomes a `@theme` block in `globals.css`
  (`--color-brand-*`, `--font-apex-display`, marquee keyframes); `font-display`
  classes rename to `font-apex-display` to avoid colliding with the invoice app's
  `--font-display` (Fraunces) variable.
- **CSP.** `img-src` gains `https://images.unsplash.com`; new
  `media-src 'self' https://cdn.coverr.co` for hover-preview videos (currently
  blocked by `default-src 'self'`).

## Error handling

No new failure modes: the portfolio is static JSX (contact = `mailto:`), and the
invoice app's behaviour is unchanged apart from paths. Redirects are permanent
(308) and defined in `next.config.ts`.

## Testing

Existing vitest suite must stay green (no route logic is unit-tested today).
Verification is end-to-end: `next build` route listing, Playwright checks that `/`
renders the portfolio with zero console/CSP errors, `/invoices_login` shows the
login screen, old URLs redirect, and the PDF/share flow still works post-login.

## Out of scope

Portfolio content swaps (real photos/videos, copy, `apexangles.sg` mailto, favicon),
re-adding the AI chat behind a server route, redirects for old private-tab
bookmarks beyond `/login` and `/quote/[slug]`, DNS/domain wiring.
