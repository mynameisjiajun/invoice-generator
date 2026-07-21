-- supabase/migrations/009_customer_company_uen.sql
-- Clients often are companies: add a company name and an optional Singapore
-- UEN (Unique Entity Number) alongside the existing contact fields.
alter table customers add column company text not null default '';
alter table customers add column uen text not null default '';
