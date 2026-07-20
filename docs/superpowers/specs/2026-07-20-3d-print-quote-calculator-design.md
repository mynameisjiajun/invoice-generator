# 3D-Print Quote Calculator — Design

## Context

This is sub-project 3 of the four planned in [2026-07-20-multi-business-foundation-design.md](2026-07-20-multi-business-foundation-design.md): "3D print STL quoting." The multi-business foundation is already in place (`businesses` table, per-business RLS locked to the owner's email, slug-based routing).

The app currently has no public-facing surface at all — [proxy.ts](../../../src/proxy.ts) redirects every unauthenticated visitor to `/login`. This project adds the app's first public, unauthenticated route: a page where anyone can upload an STL file, get an instant estimated price for printing it, and optionally submit a quote request. Pricing itself stays fully admin-configurable, per business, on the existing (authenticated) settings page.

## Goals

- A public URL, `/quote/[slug]`, not gated by login, where a visitor can:
  - upload an `.stl` file and immediately see an estimated price, computed client-side from the file's geometry, clearly labeled as an **estimate** (final price is only confirmed after the file is actually sliced — this app never slices)
  - pick a material and optionally flag the print as multi-colour (AMS), which applies a time surcharge and extra waste allowance
  - get a one-tap "Message me on Telegram" link, pre-filled with the quote summary, to actually place the order — matching how the owner already runs this (contact happens off-platform, on Telegram)
- Every generated estimate is logged automatically (no contact form required from the visitor) so the owner can see quote activity on an authenticated `/quotes` page, with the uploaded file downloadable.
- An authenticated settings section where the owner configures, per business: materials (name, cost/gram, density), a flat print-speed and cost/hour, a waste %, multi-colour surcharge/waste %, and their Telegram handle.
- Zero impact on existing invoice/customer/business functionality or their RLS boundaries.

## Non-Goals

- Slicer-accurate pricing. This is a geometry-based heuristic (volume/weight/time estimate), explicitly labeled "estimated — confirmed by [owner] after slicing" in the UI. Not a substitute for actually slicing the file; the app makes no claim of being able to.
- Payment collection or in-app checkout — ordering happens via the Telegram handoff, unchanged from current practice.
- An in-app contact form (name/email/phone fields). The owner already funnels customers to Telegram directly; replicating a separate lead form would just add friction and a second contact channel to manage.
- Multi-file uploads, OBJ/3MF support, or in-browser 3D preview — STL only, single file per quote.
- Rate limiting / CAPTCHA / bot defense beyond basic file-type and size validation — flagged as a follow-up in the security review, not built here.

## Data Model

Migration `004_print_quotes.sql`:

**`print_pricing_settings`** — one row per business.

| column | type | notes |
|---|---|---|
| `business_id` | uuid, pk, FK → businesses(id) | one settings row per business |
| `materials` | jsonb | array of `{name, density_g_cm3, cost_per_gram_cents}` — seeded from the owner's current price list (PLA Basic $0.03/g, PETG $0.03/g, PLA+ $0.04/g, PLA Matte $0.04/g, PLA Galaxy $0.05/g, TPU $0.06/g), fully editable |
| `print_speed_cm3_per_hour` | numeric | one flat speed used to turn volume into an hours estimate — the P1S doesn't meaningfully vary speed by material for this purpose |
| `cost_per_hour_cents` | int | flat electricity/machine-time rate (owner's current rate: $2.00/hr), applied regardless of material |
| `waste_percent` | numeric | extra weight added on top of raw geometry weight to account for skirts/supports/purge — "prices inclusive of waste" per the owner's existing policy |
| `multi_colour_time_surcharge_percent` | numeric | added to the time cost when the visitor flags the print as multi-colour/AMS (owner's current rate: 20%) |
| `multi_colour_waste_percent` | numeric | additional weight surcharge for multi-colour prints, on top of `waste_percent`, to approximate AMS flush-tower waste |
| `minimum_price_cents` | int, nullable | optional floor; left null/0 disables it — the owner's example pricing doesn't currently apply one |
| `telegram_handle` | text | e.g. `mynameisjiajun`, used to build the `t.me` contact link |
| `updated_at` | timestamptz | |

RLS: owner (matching email, same policy shape as `businesses`) has full access. **`anon` role gets SELECT only** — the public quote page needs to read rates to compute a price; this table holds no secrets, only pricing math.

**`print_quotes`** — one row per submitted quote request.

| column | type | notes |
|---|---|---|
| `id` | uuid, pk | |
| `business_id` | uuid, FK → businesses(id) | |
| `material` | text | name of the chosen material |
| `volume_cm3` | numeric | computed client-side |
| `weight_g` | numeric | |
| `estimated_hours` | numeric | |
| `price_cents` | int | |
| `file_path` | text | path in the `print-quote-files` storage bucket |
| `multi_colour` | boolean | whether the visitor flagged this as an AMS/multi-colour print |
| `notes` | text, nullable | optional free-text the visitor can add (e.g. preferred colour) before generating the Telegram link |
| `status` | text | `new` / `contacted` / `archived`, default `new` |
| `created_at` | timestamptz | |

RLS: **`anon` gets INSERT only** (no select/update/delete — a visitor can submit but never read back other people's quotes). Owner has full access.

**Storage bucket `print-quote-files`**: not public. Policy: `anon` can INSERT (upload) only, scoped by a max file size at the bucket level; owner (authenticated, matching email) can SELECT for signed-URL downloads on the `/quotes` page.

## Pricing Engine (client-side, `src/lib/stlQuote.ts`)

1. Parse the uploaded `.stl` (binary or ASCII) into a triangle list.
2. Compute mesh volume via the signed-tetrahedron/divergence-theorem sum over all triangles, and a bounding box (shown for visitor reassurance, not used in pricing).
3. Given a selected material, the multi-colour toggle, and the business's `print_pricing_settings`:
   - `raw_weight_g = volume_cm3 × material.density_g_cm3`
   - `waste_pct = waste_percent + (multi_colour ? multi_colour_waste_percent : 0)`
   - `billed_weight_g = raw_weight_g × (1 + waste_pct / 100)`
   - `hours = volume_cm3 / print_speed_cm3_per_hour`
   - `time_cost_cents = hours × cost_per_hour_cents × (multi_colour ? 1 + multi_colour_time_surcharge_percent / 100 : 1)`
   - `material_cost_cents = billed_weight_g × material.cost_per_gram_cents`
   - `price_cents = max(material_cost_cents + time_cost_cents, minimum_price_cents ?? 0)`
4. All of this runs in the browser before any network write — a visitor can get a price without uploading anything anywhere.

This reproduces the owner's worked example almost exactly (a 40g/2hr PLA Basic part: $1.20 material + $4.00 time = $5.20, modulo the waste % now folded into `billed_weight_g` rather than being manually pre-added by the owner as before).

## Public Page Flow (`/quote/[slug]`)

1. Server component loads the business by slug (name only, 404 if archived/missing) and its `print_pricing_settings` (anon read).
2. Client uploads STL → parsed locally → picks material + multi-colour toggle + optional notes → instant price + breakdown (material cost, time cost, weight, estimated hours) shown, prominently labeled **"Estimated price — final price confirmed after slicing"**.
3. A "Message [owner] on Telegram" button, built from `telegram_handle`, opens `https://t.me/<handle>?text=<url-encoded quote summary>` (model filename, material, weight, hours, price, notes) so the visitor lands in a chat with the quote pre-filled instead of typing it themselves.
4. Clicking that button (or an explicit "save this estimate" action if the visitor doesn't have Telegram) uploads the file to `print-quote-files` and inserts the `print_quotes` row with the computed numbers, `multi_colour`, and file path — no name/email/phone required, since the actual conversation happens on Telegram.

Basic hardening at this stage: reject non-`.stl` extensions and files over 25MB client-side before parsing, and enforce the same cap server-side via the storage bucket's file-size limit.

## Admin Flow

- `/settings`: new "3D Print Pricing" section for the active business — editable materials table (add/remove/edit rows: name, density, cost/gram), print speed, cost/hour, waste %, multi-colour surcharge/waste %, minimum price, and Telegram handle. Seeded with the owner's current rates on first migration. Follows the existing settings form patterns (same save/validation style as business details).
- New authenticated page `/quotes`: table of `print_quotes` for the active business — material, multi-colour flag, computed price/weight/hours, notes, a signed-URL download link for the file, and a status dropdown (`new`/`contacted`/`archived`) so the owner can track which quotes turned into an actual Telegram conversation. Scoped by `activeBusiness` from [businessContext.tsx](../../../src/lib/businessContext.tsx), same as invoices/customers already are.

## Routing Change

[proxy.ts](../../../src/proxy.ts)'s matcher excludes `api`, `_next/static`, `_next/image`, `favicon.ico`, `manifest`, `icons`. Add `quote` to that negative lookahead so `/quote/*` bypasses the login redirect. No other route is affected; every other path keeps requiring a session exactly as today.

## Testing

- Unit tests for the STL volume/bounding-box parser against small known-geometry fixture files (e.g. a unit cube STL with a known volume), following the existing `*.test.ts` pattern next to [money.ts](../../../src/lib/money.ts).
- Unit tests for the pricing formula (weight/hours/price math, minimum-price clamp) with fixed inputs.
- No changes to existing invoice/business tests; existing RLS behavior for authenticated tables is untouched.

## Rollout

1. Migration (new tables + RLS + storage bucket/policies).
2. Pricing settings UI in `/settings`.
3. STL parser + pricing engine + public `/quote/[slug]` page.
4. `/quotes` admin list page.
5. proxy.ts route exclusion.
6. Tests.
7. Security + performance pass (separate follow-up, requested by the user for after this feature ships) — covers rate limiting/abuse on the new public write path, and a general review of the rest of the app.
