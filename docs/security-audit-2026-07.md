# RLS Audit — 2026-07-21

Full enumeration of every table, storage bucket, and their RLS policies across
`supabase/migrations/001` through `011`. Verdict per row: is the policy shape
correct for what actually needs anon/public access, and is anything exposed
beyond that.

| Table / bucket | RLS enabled | Policies | Verdict |
|---|---|---|---|
| `businesses` | Yes | `owner_businesses` (all ops, authenticated, email-locked) · `public_read_active_businesses` (select, anon, `archived_at is null`) | **Fix recommended** — see finding below |
| `customers` | Yes | `owner_customers` (all ops, authenticated, email-locked) | OK |
| `presets` | Yes | `owner_presets` (all ops, authenticated, email-locked) | OK |
| `invoices` | Yes | `owner_invoices` (all ops, authenticated, email-locked) | OK |
| `invoice_events` | Yes | `owner_invoice_events` (all ops, authenticated, email-locked) | OK |
| `print_pricing_settings` | Yes | `owner_print_pricing_settings` (all ops, owner) · `public_read_print_pricing_settings` (select, anon, active business only) | OK — table holds no secrets, comment in 004 confirms this was deliberate |
| `print_quotes` | Yes | `owner_print_quotes` (all ops, owner) · `public_insert_print_quotes` (insert only, anon, active business only) | OK — anon can submit but never read back, so no enumeration of other clients' quotes |
| `storage.objects` (`print-quote-files` bucket) | Yes (bucket is non-public) | `anon_upload_print_quote_files` (insert, anon, scoped to a real non-archived business's folder prefix — hardened in 006) · `owner_read_print_quote_files` (select, authenticated, email-locked) | OK |
| RPC `finalize_invoice` | n/a | `security invoker` | OK — runs under caller's own RLS, no privilege escalation |
| RPC `delete_invoice_rewind` | n/a | `security invoker` | OK |

Every table in the schema has RLS enabled — no table was found running without it.
The single-owner email-lock pattern (`auth.jwt()->>'email' = 'chuajiajun2705@gmail.com'`)
is applied consistently everywhere real business data lives.

## Finding: `businesses` anon-select policy grants row access, not column access

**What:** `public_read_active_businesses` (migration 004) lets `anon` `select`
any **column** of any non-archived business row — RLS controls which *rows*
are visible, not which *columns*. The public quote page currently only
queries `id, name, slug` (`src/app/quote/[slug]/page.tsx`), which is safe
today, but the database itself does not enforce that narrowness. If a future
change accidentally widened that query to `select("*")`, it would leak
`address`, `phone`, `email`, `paynow_number`, `payee_name`, `bank_details`,
`payment_terms`, `invoice_prefix`, and `next_invoice_seq` to anyone who knows
a business's slug.

**Why it's in the report, not auto-fixed:** this is a defense-in-depth
improvement, not an active hole — nothing is leaking today. Fixing it
properly means replacing the anon policy with a Postgres view exposing only
`id, name, slug` and pointing anon `select` grants at the view instead of the
table, which is a small schema-shape change worth doing deliberately rather
than as an unreviewed side effect of a security pass.

**Recommended fix** (apply when convenient, not urgent):
```sql
create or replace view public_business_info as
  select id, name, slug from businesses where archived_at is null;

grant select on public_business_info to anon;

drop policy public_read_active_businesses on businesses;
```
Then update `src/app/quote/[slug]/page.tsx` to query `public_business_info`
instead of `businesses`.
