# Business Logo Upload — Design

**Date:** 2026-07-22
**Status:** Approved (conversational review 2026-07-22)

## Problem

The invoice PDF logo is hardcoded: `InvoiceDetail.tsx` fetches `/logo.png` from
`public/` at PDF-generation time. Changing the logo requires editing the repo and
redeploying, and the logo cannot differ per business.

## Decisions (user-confirmed)

1. **Per-business logo** — each business row gets its own logo, matching how every
   other business field works (name, address, PayNow, templates).
2. **Storage: base64 data URL in a DB column** — new nullable `businesses.logo_data_url`
   `text` column. No storage bucket, no new RLS (the businesses row policy already
   covers it), and the PDF renderer wants a data URL anyway — this *removes* the
   current fetch→blob→FileReader conversion. Mirrors the PayNow QR pattern
   (client-generated data URL).
3. **Auto-resize + compress on upload** — client-side canvas resize into a 900×300 max
   box (preserve aspect ratio, never upscale), re-encode as PNG. Keeps rows small and
   output predictable regardless of what the user picks.

## Components

- **Schema**: migration `012_business_logo.sql` — `alter table businesses add column
  if not exists logo_data_url text;`. Applied via the Supabase Management API query
  endpoint (project has no usable DB password; see memory/infra notes).
- **Type**: `logo_data_url: string | null` added to `Business` in `src/lib/types.ts`.
- **Image helper**: new `src/lib/logoImage.ts` — pure `fitWithin(w, h, maxW, maxH)`
  (unit-tested) plus browser-only `fileToLogoDataUrl(file)` (decode → canvas resize →
  PNG data URL; throws user-readable errors for non-images/undecodable files).
- **Settings UI** (`src/app/settings/page.tsx`): logo control inside the existing
  "Business Information" card — thumbnail preview on a checkerboard background,
  Upload/Change via hidden file input, Remove via the existing `IconTrash`/btn-danger
  pattern. Selecting a file only updates `form.logo_data_url`; persistence stays with
  the existing "Save Settings" button. Helper caption: "For a crisp PDF, upload an
  image at least 900px wide."
- **PDF generation** (`src/components/InvoiceDetail.tsx`): delete `fetchLogo()` and
  the `/logo.png` fetch; pass `business.logo_data_url` straight to
  `<InvoicePdf logo={…} />`. `public/logo.png` is deleted (unused after this).
  When `logo_data_url` is null the PDF falls back to the business-name text header
  (existing behaviour in `InvoicePdf.tsx`).

## Error handling

Undecodable/non-image file → message via the settings page's existing inline error
banner. No other failure modes are new (save path is the existing `updateBusiness`).

## Testing

- Unit: `fitWithin` (downscale wide, downscale tall, never-upscale, exact-fit edge).
- Manual: upload → preview → save → reload persists → PDF shows logo; remove → save →
  PDF falls back to text name.

## Post-deploy step (one-time)

JJ Visuals loses its PDF logo until the user uploads one in Settings — upload the
high-res logo (kept at repo root as `JJ Visuals Logo.png`) via the new control.

## Out of scope

Logo in the app UI/quote pages, non-PNG output encodings, server-side validation
beyond RLS (single-owner app), storage buckets.
