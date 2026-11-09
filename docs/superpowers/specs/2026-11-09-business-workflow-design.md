# Apex Cinematics — business workflow features (design)

Approved in chat 2026-11-09 ("do 1 2 3 4 7", defaults accepted; "income without
invoices" explicitly declined — the owner backfills invoices instead).

Context: single-owner Singapore sole proprietorship (videography/photography
shoots + camera gear rental). App = Next.js 16 + Supabase, invoices at
/invoices_login. Pushing `main` deploys production (Vercel). The owner applies
migrations by hand in the Supabase SQL editor, so every phase ships its SQL
first and code must not break for the minutes between push and SQL where
avoidable (otherwise: SQL first, then push).

Build order (each phase ships and is checked before the next):
1. Deposits + Quotes  2. Shoot T&C  3. Calendar  4. Expenses + tax summary

## 1. Quotes
- A quote is an invoices row with `doc_type = 'quote'`; same form, PDF look,
  email/WhatsApp flow. Own numbering per business: `Q-1`, `Q-2`…
- Valid for 14 days by default (stored in `due_date`, labelled "Valid until").
- Issue → send → "Convert to invoice": copies client, job, items, discount,
  deposit and rental fields into a new invoice draft; the quote is marked
  accepted (`converted_invoice_id`). Quotes never count in stats/overdue.
- Can be started from a website enquiry.

## 2. Deposits
- Shoot invoices (not rentals — rentals are paid in full before collection)
  can ask for a deposit; default 50%, choices None / 30% / 50% / custom.
- PDF: "Deposit due now $X · Balance $Y due on delivery"; PayNow QR is for the
  amount due now. After the deposit is recorded, due-now becomes the balance.
- Payments are recorded as they arrive (amount, date, note). List shows
  Deposit paid / Part-paid; full payment marks the invoice paid. Receipts
  list every payment; a receipt can be sent for a deposit.

## 3. Shoot T&C (phase 2)
Attached to shoot invoices/quotes like the rental T&C (tickbox, signature page
with invoice number). Defaults: deposit non-refundable and locks the date;
client cancellation >14 days: deposit kept, 7–14 days: 50% of total, <7 days:
100%; one free reschedule with >7 days' notice subject to availability;
2 revision rounds included, extra charged; delivery within 14 working days of
the shoot; final files released on full payment; raw footage not included
unless quoted; client may use deliverables for its own purposes, Apex keeps
copyright and may use in its portfolio (client may opt out in writing);
footage kept 3 months after delivery; liability capped at fees paid, not
liable for weather/venue/third parties. Draft to the rental T&C's standard;
owner to have it reviewed (Claude is not a lawyer).

## 4. Calendar (phase 3)
Month view: shoots and rental periods; warnings for a shoot during a rental
of gear, and the same item rented on overlapping dates. Shoots gain a
structured date/time picker (job_date stays as display text); old free-text
dates appear only when parseable.

## 7. Expenses + tax summary (phase 4)
Expenses page (date, amount, category: Gear, Freelancers/crew, Transport,
Software & subscriptions, Marketing, Other; note; optional receipt photo).
Stats: revenue, expenses, profit per month/year. Year-end export: Form B
4-line statement (revenue, gross profit, allowable expenses, adjusted profit)
+ CSV. Not GST-registered.
