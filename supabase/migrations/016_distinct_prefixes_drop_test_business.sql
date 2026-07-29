-- supabase/migrations/016_distinct_prefixes_drop_test_business.sql
-- Housekeeping on the live data after 014 rescoped invoice numbering.
--
-- Every business was still on the default 'A-' prefix, so per-business
-- numbering (now legal) would produce two different invoices both reading
-- "A-1". invoice_number doubles as the PayNow payment reference, so the
-- ambiguity is worth removing even though it no longer breaks the constraint.
--
-- JJ Visuals deliberately keeps 'A-': its issued invoices are A-30/A-31 and
-- it continues at A-32, so changing it would split one continuous series.
-- The other two have no issued numbers to preserve (JJ Gears & Prints has
-- only a draft; 3D Printing Co is archived and its single A-1 was never
-- sent), so their counters reset to 1 to start a clean series.
--
-- Keyed on slug rather than name so a later rename can't silently re-target
-- these, and guarded on the prefix still being 'A-' so re-running is a no-op
-- and a hand-picked prefix is never clobbered.

update businesses set invoice_prefix = 'JGP-', next_invoice_seq = 1
 where slug = 'jj-gears-prints' and invoice_prefix = 'A-';

update businesses set invoice_prefix = '3PC-', next_invoice_seq = 1
 where slug = '3d-printing-co' and invoice_prefix = 'A-';

-- Drop the leftover QA business. Archived, and empty on every dependent
-- table — the NOT EXISTS guards make this a no-op rather than an FK error
-- if it ever does hold data, so this can't destroy real records.
delete from businesses b
 where b.slug = 'qa-test-biz'
   and not exists (select 1 from invoices   i where i.business_id = b.id)
   and not exists (select 1 from customers  c where c.business_id = b.id)
   and not exists (select 1 from presets    p where p.business_id = b.id);
