-- supabase/migrations/018_enquiries.sql
-- Enquiries from the website's "Tell me about your shoot" form, handled at
-- /invoices_login/enquiries. Visitors (anon) may only INSERT a fresh 'new'
-- row with sane field sizes — they can never read, change or delete one.
-- The owner has full access, matching 001_schema.sql.

create table if not exists enquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (length(trim(name)) between 1 and 120),
  email text not null check (length(email) between 3 and 200 and email like '%_@_%'),
  phone text not null default '' check (length(phone) <= 40),
  shoot_type text not null default '' check (length(shoot_type) <= 60),
  shoot_date date,
  budget text not null default '' check (length(budget) <= 60),
  message text not null check (length(trim(message)) between 1 and 4000),
  status text not null default 'new' check (status in ('new', 'replied', 'booked', 'archived')),
  -- Client numbers are editable (005_customer_number_cascade.sql), so follow them.
  customer_id integer references customers(id) on update cascade on delete set null
);
create index if not exists enquiries_created_idx on enquiries (created_at desc);

alter table enquiries enable row level security;

create policy enquiries_public_insert on enquiries for insert to anon, authenticated
  with check (status = 'new' and customer_id is null);

create policy owner_enquiries on enquiries for all to authenticated
  using ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com')
  with check ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com');
