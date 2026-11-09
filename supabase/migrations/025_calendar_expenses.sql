-- supabase/migrations/025_calendar_expenses.sql
-- Phase 3: a real shoot date for the calendar (job_date stays as the
-- free-text line printed on the invoice).
-- Phase 4: expenses, for profit, the MediSave/tax set-aside and Form B.

alter table invoices
  add column if not exists shoot_date date;

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  spent_on date not null default current_date,
  amount_cents int not null check (amount_cents > 0),
  category text not null default 'other'
    check (category in ('gear', 'crew', 'transport', 'software', 'marketing', 'other')),
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists expenses_business_date_idx on expenses (business_id, spent_on);

alter table expenses enable row level security;

drop policy if exists owner_expenses on expenses;
create policy owner_expenses on expenses for all to authenticated
  using ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com')
  with check ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com');
