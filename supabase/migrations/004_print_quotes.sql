-- supabase/migrations/004_print_quotes.sql
-- 3D-print quote calculator: the app's first public, unauthenticated write
-- path. Two new tables plus a storage bucket, each opened to `anon` for
-- only the narrow operation the public quote page needs — never broad
-- access. Owner access follows the same email-locked pattern as every
-- other table in this project.

create table print_pricing_settings (
  business_id uuid primary key references businesses(id) on delete cascade,
  materials jsonb not null default '[]',
  print_speed_cm3_per_hour numeric not null,
  cost_per_hour_cents int not null default 200,
  waste_percent numeric not null default 0,
  multi_colour_time_surcharge_percent numeric not null default 20,
  multi_colour_waste_percent numeric not null default 0,
  minimum_price_cents int,
  telegram_handle text not null default '',
  updated_at timestamptz not null default now()
);

alter table print_pricing_settings enable row level security;

create policy owner_print_pricing_settings on print_pricing_settings for all to authenticated
  using ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com')
  with check ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com');

-- Public quote page needs to read rates to compute a price. No secrets in
-- this table, only pricing math. Scoped to non-archived businesses only.
create policy public_read_print_pricing_settings on print_pricing_settings for select to anon
  using (exists (
    select 1 from businesses b
    where b.id = print_pricing_settings.business_id and b.archived_at is null
  ));

create table print_quotes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  material text not null,
  volume_cm3 numeric not null,
  weight_g numeric not null,
  estimated_hours numeric not null,
  price_cents int not null,
  file_path text not null,
  multi_colour boolean not null default false,
  notes text not null default '',
  status text not null default 'new' check (status in ('new','contacted','archived')),
  created_at timestamptz not null default now()
);

alter table print_quotes enable row level security;

create policy owner_print_quotes on print_quotes for all to authenticated
  using ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com')
  with check ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com');

-- Visitors can submit a quote but can never read one back — no way to
-- enumerate other people's quote requests. The business_id check stops an
-- anon client from writing against an archived/nonexistent business.
create policy public_insert_print_quotes on print_quotes for insert to anon
  with check (exists (
    select 1 from businesses b
    where b.id = print_quotes.business_id and b.archived_at is null
  ));

-- The public quote page needs the business's name/slug; `businesses`
-- currently has no anon access at all. Scoped to non-archived rows — app
-- code must keep selecting only {id,name,slug} for anon callers, since RLS
-- controls row visibility, not column visibility.
create policy public_read_active_businesses on businesses for select to anon
  using (archived_at is null);

-- Storage bucket for uploaded STL files. Not public: anon can upload but
-- never list/read; only the owner can read (for the /quotes download link).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'print-quote-files', 'print-quote-files', false, 26214400,
  array['model/stl', 'application/sla', 'application/vnd.ms-pki.stl', 'application/octet-stream']
);

create policy anon_upload_print_quote_files on storage.objects for insert to anon
  with check (bucket_id = 'print-quote-files');

create policy owner_read_print_quote_files on storage.objects for select to authenticated
  using (
    bucket_id = 'print-quote-files'
    and (select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com'
  );
