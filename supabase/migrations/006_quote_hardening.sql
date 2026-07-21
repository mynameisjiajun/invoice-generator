-- supabase/migrations/006_quote_hardening.sql
-- Security + speed follow-up for the 3D-print quote feature.

-- 1) Defense-in-depth on the anonymous file-upload path. The original anon
--    insert policy authorized ANY object in the bucket, so a scripted client
--    could spray files to arbitrary keys without ever touching the quote
--    flow. Require the object's first path segment to be a real, non-archived
--    business id (the app already uploads to `${businessId}/${uuid}.stl`).
--    This does not rate-limit — true abuse protection needs edge rate
--    limiting (e.g. Vercel BotID/Firewall) on /quote — but it ties every
--    uploaded object to a live business and blocks root/garbage-path sprays.
drop policy anon_upload_print_quote_files on storage.objects;
create policy anon_upload_print_quote_files on storage.objects for insert to anon
  with check (
    bucket_id = 'print-quote-files'
    and exists (
      select 1 from businesses b
      where b.id::text = (storage.foldername(name))[1]
        and b.archived_at is null
    )
  );

-- 2) The owner's /quotes inbox lists quotes filtered by business_id and
--    ordered by created_at desc. Add the matching composite index so that
--    query stays index-served as quote volume grows.
create index print_quotes_business_created_idx
  on print_quotes (business_id, created_at desc);
