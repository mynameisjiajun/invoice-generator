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
   the top. Unpaid invoices older than 30 days are flagged **Overdue** (red)
   automatically. Each invoice has a **Duplicate** action that opens the new
   invoice form pre-filled with everything except invoice number (next in
   sequence) and date (today).
3. **New invoice**
   - Customer: pick existing (auto-fills name/phone/email/address) or add new;
     customer ID auto-assigned (continues existing numbering).
   - Job block: event name, date, time/hours, location.
   - Line items: description / quantity / unit price; add rows as needed.
     A **preset picker** inserts saved service packages as line items.
   - **Draft autosave**: form state persists locally (localStorage) on every
     change, and reloads if the tab is killed or closed; an in-progress
     invoice can also be saved to the database with `draft` status and
     finished later. Drafts don't consume an invoice number until finalized.
   - Discount: optional, invoice-level, entered as fixed amount or percentage.
   - Invoice number auto-increments in `A-<n>` format (next: A-30), editable
     override allowed; database enforces uniqueness.
   - Date defaults to today. Payment terms fixed: "PayNow within 30 days of
     invoice."
4. **Invoice preview** — full rendered invoice; download / share PDF.
5. **Stats** — income tracking: total invoiced vs collected per year and per
   month (simple bar chart + numbers), outstanding total, and a per-client
   breakdown (who you've billed the most). Useful for IRAS filing.
6. **Settings** — business details (address, phone, email, PayNow number,
   bank transfer info), editable anytime; manage service presets (name,
   description, unit price) here too.

## Data model (Supabase Postgres)

- `customers` — id (running customer ID), name, phone, email, address,
  timestamps.
- `invoices` — invoice_number (unique when set, null for drafts), status
  (`draft` | `unpaid` | `paid`), issue_date, customer_id (FK), job_event,
  job_date, job_location, line_items (JSONB: description, qty, unit_price),
  discount_type (`none` | `amount` | `percent`), discount_value, subtotal,
  total, paid_date, timestamps. "Overdue" is derived (status = unpaid and
  issue_date > 30 days ago), not stored.
- `presets` — name, description, unit_price, default_qty.
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

- Form state autosaves locally on every change and survives tab closure;
  saving to the database requires a connection.
- Unique constraint prevents invoice-number collisions.
- Percentage discounts rounded to cents; totals always derived, never typed.

- QR payload validated (amount > 0, correct checksum) before rendering.

## Out of scope (for now)

- GST/tax lines, deposits/partial payments, multi-user access, email sending
  from the app, recurring invoices, quotes, payment reminders, paid receipts,
  CSV export.
