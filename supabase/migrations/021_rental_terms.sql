-- supabase/migrations/021_rental_terms.sql
-- Per-invoice choice to leave the Equipment Rental T&C off a rental
-- invoice's PDF, for renters who were sent the T&C separately. Defaults to
-- attaching them, so existing rentals are unchanged.

alter table invoices
  add column if not exists rental_terms boolean not null default true;
