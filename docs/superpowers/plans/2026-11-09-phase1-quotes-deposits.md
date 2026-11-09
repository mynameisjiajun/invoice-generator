# Phase 1 — Quotes + Deposits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quotes that convert to invoices in one tap, and shoot invoices with a deposit/balance split and recorded payments, plus a "Needs attention" list so the owner sees what to chase.

**Architecture:** A quote is an `invoices` row with `doc_type='quote'` (reuses form, PDF, mail). Payments live in a new `payments` table joined onto invoice reads; pure money logic sits in `src/lib/payments.ts`. Quote numbering uses a new `finalize_quote` RPC with its own per-business counter.

**Tech Stack:** Next.js 16 (read node_modules/next/dist/docs before touching Next APIs), React 19, Supabase, @react-pdf/renderer, vitest.

**Spec:** `docs/superpowers/specs/2026-11-09-business-workflow-design.md` (sections 1, 2) + owner's ask: "put yourself in the shoes of a freelance videographer… convenient to manage".

## Global Constraints
- Migration `supabase/migrations/023_quotes_deposits.sql`; owner runs it in the SQL editor **before** the push (pushing `main` deploys prod; invoice reads join `payments` and filter `doc_type`).
- Quote numbers `Q-<n>` per business, from `businesses.next_quote_seq` (default 1). Quote validity default: issue date + 14 days, stored in `due_date`.
- Deposit default 50%; choices None / 30% / 50% / custom; shoots only (hidden for rentals and print businesses). Balance wording: "due on delivery".
- Quotes never count in stats, overdue, outstanding totals or the invoice list.
- Money in integer cents; amounts shown via `formatSGD`.
- Convenience rules: every action ≤ 2 taps from the invoice screen; amounts pre-filled (payment amount = amount due now); nothing asks for data the app already has.

## Review Focus
- Deleting a quote must not rewind the **invoice** counter (`delete_invoice_rewind` reads `settings`, a legacy table) — quotes use a plain delete.
- An invoice marked paid before payments existed (no payment rows) still reads as fully paid (`paidCents` = total when `status='paid'`).
- Overpayment / payment larger than due: allowed, capped display ("Paid in full"), invoice becomes paid.
- Undo paid on an invoice with payments: status back to unpaid, payment rows kept, state recomputed (deposit paid / part-paid).
- Converting the same quote twice: second tap opens the existing invoice instead of creating another.

---

### Task 1: Migration + types

**Files:** Create `supabase/migrations/023_quotes_deposits.sql`; Modify `src/lib/types.ts`.

**Interfaces — Produces:**
- `Invoice.doc_type?: "invoice" | "quote"`, `deposit_percent?: number`, `converted_invoice_id?: string | null`, `payments?: Payment[]`
- `type Payment = { id: string; invoice_id: string; business_id: string; amount_cents: number; paid_on: string; note: string; created_at: string }`
- `Business.next_quote_seq?: number`; `isQuote(inv): boolean`
- `isOverdue` returns false for quotes.

SQL: columns `invoices.doc_type text not null default 'invoice' check in ('invoice','quote')`, `invoices.deposit_percent numeric not null default 0 check 0..100`, `invoices.converted_invoice_id uuid references invoices(id) on delete set null`, `businesses.next_quote_seq int not null default 1`; table `payments` (columns above, `amount_cents int check > 0`, `paid_on date default current_date`, `note text default ''`, FK cascade on invoice delete), index on `invoice_id`, RLS policy `owner_payments` matching `018_enquiries.sql`'s owner policy; function `finalize_quote(q_id uuid) returns text` — same retry loop as `finalize_invoice` (014) but `'Q-' || seq` from `next_quote_seq`, only for `doc_type='quote'` drafts, sets `status='unpaid'`.

- [ ] Write migration + types; `npx tsc --noEmit` passes. Commit.

### Task 2: Payment maths (`src/lib/payments.ts`)

**Interfaces — Produces:**
- `paidCents(inv: Invoice): number` — sum of `inv.payments`; if `status==='paid'` and that sum < total → total.
- `depositCents(inv: Invoice): number` — `round(total * deposit_percent / 100)`, 0 for rentals/quotes-without-deposit.
- `dueNowCents(inv: Invoice): number` — 0 if paid ≥ total; deposit − paid while paid < deposit; else total − paid.
- `paymentState(inv): "unpaid" | "deposit-paid" | "part-paid" | "paid"`.

- [ ] **Tests** (`src/lib/payments.test.ts`): total 100000 @50% → deposit 50000, dueNow 50000; after 50000 paid → state `deposit-paid`, dueNow 50000; after 30000 paid → `part-paid`, dueNow 20000; status paid with no rows → paidCents 100000, dueNow 0; overpay 120000 → `paid`, dueNow 0; deposit_percent 0 → dueNow = total − paid.
- [ ] Implement; tests pass. Commit.

### Task 3: Data access (`src/lib/db.ts`)

**Interfaces — Produces:** `INVOICE_SELECT = "*, customers(*), payments(*)"`; `listInvoices(businessId?)` filters `doc_type='invoice'`; `listQuotes(businessId)`; `listInvoicesForCustomer` filters invoices; `finalizeQuote(id): Promise<string>`; `recordPayment(inv: Invoice, p: { amount_cents: number; paid_on: string; note: string }): Promise<Invoice>` (inserts, then if new paidCents ≥ total sets `status='paid'`, `paid_date=p.paid_on` and logs `paid`; returns refreshed invoice via `getInvoice`); `deletePayment(inv, paymentId): Promise<Invoice>` (if invoice was paid and now short → back to unpaid); `convertQuote(quoteId): Promise<string>` (returns existing `converted_invoice_id` if set; else inserts invoice draft copying customer_id, job_*, line_items, discount_*, deposit_percent, rental fields, with `issue_date` today and `due_date` today+30 — or collection date for rentals — then stamps the quote); `deleteInvoice` does a plain delete for quotes. `DraftInput` gains `doc_type`, `deposit_percent`. `setPaid(true)` on an invoice with payments records the remaining balance as a "Balance" payment instead.

- [ ] Implement; tsc passes. Commit.

### Task 4: Form — deposit + quote mode

**Files:** `src/components/InvoiceForm.tsx`, `src/lib/formStorage.ts`, NEW `src/components/DepositField.tsx`, `src/app/invoices_login/invoices/new/page.tsx` (accept `?type=quote`).

- `InvoiceForm` prop `docType: "invoice" | "quote"` (from `?type=quote`, or from the loaded draft). Quote: title "New Quote", due label "Valid until" defaulting to issue+14 (untouched), finalize button "Issue quote" → `finalizeQuote`, confirm text "assigns quote number Q-n". Autosave key separate for quotes (`jjv.quote.form.v1`) so a half-typed quote never resurfaces as an invoice.
- `DepositField` (chips None / 30% / 50% / Custom + number input), shown when `!isPrint && !isRental`; new forms default 50% for shoots. Shows "Deposit $X now · balance $Y on delivery" live.
- FormState `depositPercent?: number`; persisted as `deposit_percent`.
- [ ] Implement; tsc + existing tests pass. Commit.

### Task 5: PDF, email, messages

**Files:** `src/components/InvoicePdf.tsx`, `src/lib/emailHtml.ts`, `src/lib/templates.ts` (+ tests), `src/app/api/mail/send/route.ts`, `scripts/pdf-preview.tsx` (modes `quote`, `deposit`, `deposit-receipt`).

- PDF quote: badge "QUOTE", meta "Valid until <date>", final row "TOTAL", payment card replaced by "To confirm" card: "Reply to this email or WhatsApp to accept. {A 50% deposit of $X secures your date.}" and no QR.
- PDF deposit invoice: totals rows "Deposit (50%) $X", "Received −$Y" (if any), final row "DUE NOW $Z"; payment text "…balance of $B is due on delivery"; QR amount = `dueNowCents`.
- Receipt with payments: lists each payment (date, note, amount); if not fully paid, "Balance outstanding $B" instead of "No further payment is due". Mail route allows a receipt when `paidCents > 0`.
- Email card: quote → "Quote Q-3 · Total", "Valid until …"; deposit → label "Deposit due now", amount `dueNowCents`, meta "Balance $B on delivery".
- Templates: `quoteEmailMessage`, `quoteWhatsappMessage`, `quoteSubject` ("Quote for {job}"); deposit note appended to invoice messages while deposit outstanding: "A {pct}% deposit of {deposit} is due now to confirm your booking; the balance of {balance} is due on delivery."; receipt messages for part payment say what was received and the balance left.
- [ ] Tests for each template variant; render previews and inspect. Commit.

### Task 6: Screens — payments, quotes, attention list

**Files:** `src/components/InvoiceDetail.tsx`, NEW `src/components/PaymentsCard.tsx`, `src/components/InvoiceList.tsx`, NEW `src/components/AttentionList.tsx`, NEW `src/lib/attention.ts` (+ test), `src/app/invoices_login/enquiries/page.tsx`, `src/lib/stats.ts` (+ test).

- `PaymentsCard` on finalized invoices: payment rows (date · note · amount, delete with confirm), "Record payment" pre-filled with `dueNowCents`, note pre-set "Deposit" when nothing paid and a deposit is set, else "Balance"; after saving, offer "Email receipt".
- Quote detail: actions Download / Send / Email quote, **Convert to invoice** (→ `convertQuote` → open the new draft), status chip Open / Expired / Accepted; no paid toggle.
- `InvoiceList`: segmented Invoices | Quotes; badges Deposit paid / Part-paid; "outstanding" uses `total − paidCents`; "+ New" respects the segment.
- `attention.ts`: `attentionItems(invoices, quotes, today): { kind, invoiceId, label, sub }[]` — quote open & expiring within 3 days or expired without conversion; invoice with deposit due and unpaid deposit; deposit paid & shoot date passed (balance to chase); rental awaiting signature; overdue. Shown at top of the list as a compact "Needs attention" card (hidden when empty).
- Enquiries: "Create quote" next to "Create invoice".
- Stats: collected uses `paidCents`.
- [ ] Tests: `attention.test.ts` (each kind + empty), stats with part payments. Build passes. Commit.

### Task 7: Ship
- [ ] Owner runs `023_quotes_deposits.sql`; then push; check the Vercel deploy; owner smoke-tests: quote → convert → deposit invoice → record deposit → receipt.
