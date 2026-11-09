-- supabase/migrations/020_rental.sql
-- Equipment rental invoices (Apex Cinematics). A rental invoice carries the
-- rental period and appends the Equipment Rental T&C to its PDF; per-item
-- days and replacement values live inside line_items (jsonb, no change).
-- rental_start / rental_end are datetime-local strings ("YYYY-MM-DDTHH:mm",
-- Singapore time) or '' — text like job_date, so no timezone conversion.

alter table invoices
  add column if not exists is_rental boolean not null default false,
  add column if not exists rental_start text not null default '',
  add column if not exists rental_end text not null default '';
