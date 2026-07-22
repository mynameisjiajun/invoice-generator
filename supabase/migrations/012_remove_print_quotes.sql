-- supabase/migrations/012_remove_print_quotes.sql
-- The 3D-print quote calculator was never used in practice. Removing it
-- entirely: both tables, the anon business-read policy that existed only
-- to serve the public quote page, and the storage bucket + its policies.

drop policy if exists public_read_active_businesses on businesses;

drop table if exists print_quotes;
drop table if exists print_pricing_settings;

drop policy if exists anon_upload_print_quote_files on storage.objects;
drop policy if exists owner_read_print_quote_files on storage.objects;
delete from storage.objects where bucket_id = 'print-quote-files';
delete from storage.buckets where id = 'print-quote-files';
