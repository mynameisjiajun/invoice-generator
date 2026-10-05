-- supabase/migrations/019_business_kind.sql
-- JJ Gears & Prints is a 3D-print shop, not a photo business: its invoices
-- need a project/handover card and per-part print specs instead of event
-- details. `kind` lets the invoice form and PDF switch between the two.
-- Keyed on slug (as in 016) so a rename can't re-target it.

alter table businesses
  add column if not exists kind text not null default 'photo'
  check (kind in ('photo', 'print'));

update businesses set kind = 'print' where slug = 'jj-gears-prints';

-- Payment details on JJ Gears & Prints invoices should read exactly like
-- JJ Visuals' (same PayNow, payee, bank details and terms). Copied once
-- here; each business still edits its own afterwards in Settings.
update businesses g
   set paynow_number = v.paynow_number,
       payee_name    = v.payee_name,
       bank_details  = v.bank_details,
       payment_terms = v.payment_terms
  from businesses v
 where g.slug = 'jj-gears-prints'
   and v.slug = 'photography';
