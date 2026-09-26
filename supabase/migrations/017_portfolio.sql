-- supabase/migrations/017_portfolio.sql
-- Portfolio content, edited from /invoices_login/portfolio instead of code.
-- Anyone may read (the public site renders it); only the owner may write,
-- matching the owner policies in 001_schema.sql. Photos live in the public
-- `portfolio` storage bucket; rows store the object path, or a full URL for
-- external images such as YouTube thumbnails.

create table if not exists portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(trim(title)) > 0),
  type text not null default 'photo' check (type in ('photo', 'video')),
  story text not null default '',
  tags text[] not null default '{}',
  youtube_id text,
  instagram_url text,
  cover text,
  position integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists portfolio_photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references portfolio_projects(id) on delete cascade,
  path text not null,
  alt text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists portfolio_photos_project_idx on portfolio_photos (project_id, position);

-- One-row table for site-wide images (currently the Studio section photo).
create table if not exists portfolio_site (
  id integer primary key default 1 check (id = 1),
  about_photo text
);
insert into portfolio_site (id) values (1) on conflict (id) do nothing;

alter table portfolio_projects enable row level security;
alter table portfolio_photos enable row level security;
alter table portfolio_site enable row level security;

-- Public reads: visitors see published projects and their photos; the owner
-- sees everything (drafts included).
create policy portfolio_projects_read on portfolio_projects for select to anon, authenticated
  using (published or (select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com');
create policy portfolio_photos_read on portfolio_photos for select to anon, authenticated
  using (exists (
    select 1 from portfolio_projects p where p.id = project_id
      and (p.published or (select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com')
  ));
create policy portfolio_site_read on portfolio_site for select to anon, authenticated using (true);

create policy owner_portfolio_projects on portfolio_projects for all to authenticated
  using ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com')
  with check ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com');
create policy owner_portfolio_photos on portfolio_photos for all to authenticated
  using ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com')
  with check ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com');
create policy owner_portfolio_site on portfolio_site for update to authenticated
  using ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com')
  with check ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com');

-- Storage: public bucket (anyone can view files by URL), 15 MB/file cap,
-- images only. Uploads/deletes are owner-only (Storage's remove() also needs
-- a select policy, hence the owner select below; public viewing goes through
-- the bucket's public URL and needs no policy).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio', 'portfolio', true, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update set public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy portfolio_objects_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'portfolio' and (select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com');
create policy portfolio_objects_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'portfolio' and (select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com');
create policy portfolio_objects_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'portfolio' and (select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com');
create policy portfolio_objects_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'portfolio' and (select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com');
