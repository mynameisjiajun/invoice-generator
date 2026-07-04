# JJ Visuals Invoice Generator — Design

**Date:** 2026-07-04
**Status:** Approved pending final spec review

## Purpose

Replace manual invoice creation for JJ Visuals (freelance photo/video, Singapore).
Single user: Chua Jia Jun. Generates professional PDF invoices with a dynamic
PayNow QR code, tracks paid/unpaid status, and syncs across iPhone and Mac.

## Platform & Stack

- **Web app (PWA)** — Next.js (App Router, React, TypeScript), installable to
  iPhone home screen; works in Safari on iPhone and Mac.
- **Supabase** (free tier) — authentication + Postgres database.
- **Vercel** (free tier) — hosting and deploys.
- **PDF** — generated client-side with `@react-pdf/renderer`; shared via the
  iOS share sheet (AirDrop, WhatsApp, email).
- **PayNow QR** — dynamic per-invoice EMVCo/SGQR payload (mobile proxy
  +65 9656 1716, exact amount, invoice number as reference), rendered with a
  standard QR library and embedded in the PDF.

## Security

- Login via Supabase Auth, restricted to a single allowed email:
  `chuajiajun2705@gmail.com`. Public signups disabled.
- Row-level security on every table: only the authenticated owner can read or
  write. Direct API calls without a valid session return nothing.
- All app screens sit behind the login; unauthenticated visitors see only the
  login page.

## Screens

1. **Login** — email-based sign-in (single user).
2. **Dashboard / invoice list** — invoices newest-first with client, event,
   amount, Paid/Unpaid badge; toggle paid on tap; total outstanding shown at
   the top.
3. **New invoice**
   - Customer: pick existing (auto-fills name/phone/email/address) or add new;
     customer ID auto-assigned (continues existing numbering).
   - Job block: event name, date, time/hours, location.
   - Line items: description / quantity / unit price; add rows as needed.
   - Discount: optional, invoice-level, entered as fixed amount or percentage.
   - Invoice number auto-increments in `A-<n>` format (next: A-30), editable
     override allowed; database enforces uniqueness.
   - Date defaults to today. Payment terms fixed: "PayNow within 30 days of
     invoice."
4. **Invoice preview** — full rendered invoice; download / share PDF.
5. **Settings** — business details (address, phone, email, PayNow number,
   bank transfer info), editable anytime.

## Data model (Supabase Postgres)

- `customers` — id (running customer ID), name, phone, email, address,
  timestamps.
- `invoices` — invoice_number (unique), issue_date, customer_id (FK),
  job_event, job_date, job_location, line_items (JSONB: description, qty,
  unit_price), discount_type (`none` | `amount` | `percent`), discount_value,
  subtotal, total, paid (bool), paid_date, timestamps.
- `settings` — single row: business name, address, phone, email, PayNow
  number, bank details, payment terms text.

Totals are computed from line items minus discount — no manual math.

## PDF layout

Fresh, clean, modern design (not a clone of the old template) carrying the
same information: JJ Visuals branding, business info, invoice no./date/
customer ID, customer block, job block, payment terms, line-item table,
subtotal, discount line (when present), total due, payment instructions
(PayNow, cheque, bank transfer), and the dynamic PayNow QR.

## Error handling & edge cases

- Saving requires a connection; form state is kept until the page is left.
- Unique constraint prevents invoice-number collisions.
- Percentage discounts rounded to cents; totals always derived, never typed.
- QR payload validated (amount > 0, correct checksum) before rendering.

## Out of scope (for now)

- GST/tax lines, deposits/partial payments, multi-user access, email sending
  from the app, recurring invoices.
