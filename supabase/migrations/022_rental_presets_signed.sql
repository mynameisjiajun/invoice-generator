-- supabase/migrations/022_rental_presets_signed.sql
-- 1. Presets can carry a replacement value, so picking a piece of gear on a
--    rental invoice fills in its day rate AND its replacement value.
-- 2. Rental invoices record when the renter's signed T&C acknowledgement
--    came back (null = not yet), shown on the invoice list.

alter table presets
  add column if not exists replacement_cents int not null default 0;

alter table invoices
  add column if not exists rental_signed_at timestamptz;
