-- supabase/migrations/013_business_logo.sql
-- Per-business PDF logo, stored as a base64 data URL. No new RLS needed:
-- the businesses row policy (001_schema.sql) already covers this column.
alter table businesses add column if not exists logo_data_url text;
