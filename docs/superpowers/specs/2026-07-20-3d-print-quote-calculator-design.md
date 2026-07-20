# 3D-Print Quote Calculator — Design

## Context

This is sub-project 3 of the four planned in [2026-07-20-multi-business-foundation-design.md](2026-07-20-multi-business-foundation-design.md): "3D print STL quoting." The multi-business foundation is already in place (`businesses` table, per-business RLS locked to the owner's email, slug-based routing).

The app currently has no public-facing surface at all — [proxy.ts](../../../src/proxy.ts) redirects every unauthenticated visitor to `/login`. This project adds the app's first public, unauthenticated route: a page where anyone can upload an STL file, get an instant estimated price for printing it, and optionally submit a quote request. Pricing itself stays fully admin-configurable, per business, on the existing (authenticated) settings page.

## Goals

- A public URL, `/quote/[slug]`, not gated by login, where a visitor can:
  - upload an `.stl` file and immediately see an estimated price, computed client-side from the file's geometry
  - optionally submit that estimate as a quote request with contact info
- An authenticated settings section where the owner configures, per business: materials (name, density, cost/gram, print rate), cost/hour, markup %, minimum price.
- An authenticated `/quotes` page listing submitted quote requests per business, with the uploaded file downloadable and a status field.
- Zero impact on existing invoice/customer/business functionality or their RLS boundaries.

## Non-Goals

- Slicer-accurate pricing. This is a geometry-based heuristic (volume/weight/time estimate), explicitly labeled "estimated" in the UI — not a substitute for actually slicing the file.
- Payment collection on the quote page. Quotes are leads; converting one into an actual invoice/payment is a manual follow-up step outside this project.
- Multi-file uploads, OBJ/3MF support, or in-browser 3D preview — STL only, single file per quote.
- Rate limiting / CAPTCHA / bot defense beyond basic file-type and size validation — flagged as a follow-up in the security review, not built here.

## Data Model

Migration `004_print_quotes.sql`:

**`print_pricing_settings`** — one row per business.

| column | type | notes |
|---|---|---|
| `business_id` | uuid, pk, FK → businesses(id) | one settings row per business |
| `materials` | jsonb | array of `{name, density_g_cm3, cost_per_gram_cents, print_rate_cm3_per_hour}` |
| `cost_per_hour_cents` | int | |
| `markup_percent` | numeric | e.g. `30` for 30% |
| `minimum_price_cents` | int | floor applied after markup |
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
| `visitor_name` | text | |
| `visitor_email` | text | |
| `visitor_phone` | text, nullable | |
| `notes` | text, nullable | |
| `status` | text | `new` / `contacted` / `archived`, default `new` |
| `created_at` | timestamptz | |

RLS: **`anon` gets INSERT only** (no select/update/delete — a visitor can submit but never read back other people's quotes). Owner has full access.

**Storage bucket `print-quote-files`**: not public. Policy: `anon` can INSERT (upload) only, scoped by a max file size at the bucket level; owner (authenticated, matching email) can SELECT for signed-URL downloads on the `/quotes` page.

## Pricing Engine (client-side, `src/lib/stlQuote.ts`)

1. Parse the uploaded `.stl` (binary or ASCII) into a triangle list.
2. Compute mesh volume via the signed-tetrahedron/divergence-theorem sum over all triangles, and a bounding box (shown for visitor reassurance, not used in pricing).
3. Given a selected material and the business's `print_pricing_settings`:
   - `weight_g = volume_cm3 × material.density_g_cm3`
   - `hours = volume_cm3 / material.print_rate_cm3_per_hour`
   - `subtotal_cents = weight_g × material.cost_per_gram_cents + hours × cost_per_hour_cents`
   - `price_cents = max(subtotal_cents × (1 + markup_percent / 100), minimum_price_cents)`
4. All of this runs in the browser before any network write — a visitor can get a price without uploading anything anywhere.

## Public Page Flow (`/quote/[slug]`)

1. Server component loads the business by slug (name only, 404 if archived/missing) and its `print_pricing_settings` (anon read).
2. Client uploads STL → parsed locally → material picker → instant price + breakdown (material cost, time cost, weight, estimated hours) shown, labeled "estimated."
3. Optional "Request this quote" form (name, email, phone optional, notes). On submit: upload the file to `print-quote-files`, then insert the `print_quotes` row with the computed numbers and the file path.
4. Confirmation shown; no further account/login involved.

Basic hardening at this stage: reject non-`.stl` extensions and files over 25MB client-side before parsing, and enforce the same cap server-side via the storage bucket's file-size limit.

## Admin Flow

- `/settings`: new "3D Print Pricing" section for the active business — editable materials table (add/remove/edit rows: name, density, cost/gram, print rate), cost/hour, markup %, minimum price. Follows the existing settings form patterns (same save/validation style as business details).
- New authenticated page `/quotes`: table of `print_quotes` for the active business — material, computed price, contact info, a signed-URL download link for the file, and a status dropdown (`new`/`contacted`/`archived`). Scoped by `activeBusiness` from [businessContext.tsx](../../../src/lib/businessContext.tsx), same as invoices/customers already are.

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
