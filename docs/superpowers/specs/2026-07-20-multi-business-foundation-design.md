# Multi-Business Foundation — Design

## Context

The app currently supports a single implicit business (JJ Visuals, photography/videography) baked into one `settings` row. The owner is expanding into two more business lines — a 3D printing service and a videography gear rental service — and wants this app to become the shared admin tool across all three.

This is the first of four planned sub-projects, sequenced as:

1. **Multi-business foundation** (this spec) — the data model everything else attaches to
2. Telegram integration
3. 3D print STL quoting
4. Gear rental tracking

Each will get its own spec and plan. This spec covers only the foundation: introducing "business" as a first-class concept that the rest of the app filters by.

## Goals

- Support multiple, fully independent businesses (own name, address, payment details, bank details, service presets, invoice numbering) under one login.
- Customers, invoices, and presets are scoped per business — no cross-business sharing.
- Existing data (all currently JJ Visuals) migrates automatically with zero data loss.
- Businesses are manageable in-app (create, rename/edit, archive) — no direct DB access needed to add a 4th business later.
- Stats can show either the active business alone, or a combined "All businesses" view.

## Non-Goals

- Telegram notifications, STL quoting, and rental tracking are out of scope — later specs.
- Multi-user / multi-tenant support beyond the single existing account. `business_id` is a data filter, not a new security boundary.
- Hard deletion of businesses. Only archive (soft-delete).

## Data Model

New `businesses` table:

| column | type | notes |
|---|---|---|
| `id` | uuid, pk | |
| `name` | text | e.g. "JJ Visuals" |
| `slug` | text, unique | e.g. "photography", "3d-printing", "rental" — used in the nav switcher |
| `address` | text | |
| `phone` | text | |
| `email` | text | |
| `paynow_number` | text | |
| `payee_name` | text | |
| `bank_details` | text | |
| `invoice_prefix` | text | e.g. "JJV", "3DP" |
| `next_invoice_number` | integer | replaces the current single global counter |
| `archived_at` | timestamptz, nullable | soft-delete |
| `created_at` | timestamptz | |

Existing tables gain a `business_id` FK (not null, `ON DELETE RESTRICT`):

- `customers.business_id`
- `invoices.business_id`
- `service_presets.business_id`

### Migration

1. Insert one `businesses` row for "JJ Visuals" using the current single `settings` row's values (address, phone, PayNow number, payee name, bank details) and the current invoice number counter as its `next_invoice_number`.
2. Backfill `business_id` on every existing `customers`, `invoices`, and `service_presets` row to point at that new row.
3. Add the `NOT NULL` constraint on `business_id` after backfill.
4. Retire the old single-row `settings` table's business-info columns (superseded by `businesses`); anything else it holds stays as-is.

Invoice numbering logic moves from incrementing one global counter to incrementing `businesses.next_invoice_number` for the invoice's business, on finalize — same increment-on-finalize behavior as today, just scoped per business.

## Navigation & UI

- **Business switcher**: a pill/dropdown in `NavBar` showing the active business name. Selecting another business swaps the active context; an "Add business" option sits at the bottom of the list.
- Active business persists in `localStorage` and a cookie (so proxy/server components can read it too) so reopening the PWA returns to the last-used business.
- `Dashboard`, `InvoiceForm`, `Stats`, and `Settings` all filter by the active `business_id`.
- `InvoiceDetail` is the one exception: an invoice already carries its own `business_id`, so opening one (e.g. from search) displays correctly regardless of which business is currently active in the nav — it does not require switching first.
- **Settings** gains a "Businesses" section above the existing business-info form:
  - List of businesses with an "Add business" button. New businesses start with just a name + slug; the owner fills in payment/address details afterward.
  - Per-business "Archive" action (soft-delete via `archived_at`), not a hard delete.
  - Archived businesses are hidden from the nav switcher's default list but remain reachable (their invoices stay in search/history and in the "All businesses" stats view).
- **Stats** gains a scope toggle: "Active business" (default) vs. "All businesses" (combined revenue/invoice numbers across every non-archived business).

## Edge Cases & Error Handling

- **New business with incomplete settings**: reuse the existing `OnboardingBanner` pattern to nudge the owner to fill in PayNow/address/bank details before finalizing an invoice under a newly created business.
- **Archiving a business with invoices**: allowed (soft-delete only) — invoices remain queryable via search/history and the "All businesses" stats view. Hard delete is blocked at the DB level (`ON DELETE RESTRICT`) regardless.
- **RLS**: unchanged in structure — still scoped to the single owner account (`auth.uid()`/email check). `business_id` is an additional filter column within that owner's data, not a new authorization boundary.
- **Switching business mid-draft**: if an invoice draft is in progress (autosaved via `formStorage.ts`) and the owner switches the active business in the nav, warn before discarding — the draft's line items and presets belong to the business it was started under.

## Testing Plan

- Unit tests (extending the existing `src/lib/*.test.ts` pattern):
  - Per-business invoice number increments independently and correctly.
  - Migration backfill assigns every pre-existing row to the JJ Visuals business.
  - Stats aggregation is correct in both "active business" and "All businesses" modes.
- Manual QA after migration, in-browser:
  - Existing JJ Visuals invoices, customers, and presets appear correctly under the auto-created business.
  - PayNow QR still generates using the correct business's payment details.
  - PDF export still pulls the correct business name/logo.
  - Creating a second business, adding a customer/invoice under it, and confirming it does not appear when the first business is active.
