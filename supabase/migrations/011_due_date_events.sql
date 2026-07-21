-- supabase/migrations/011_due_date_events.sql
alter table invoices add column if not exists due_date date;

-- Backfill: existing unpaid/paid invoices get issue_date + 30 (the old implicit rule).
update invoices set due_date = issue_date + 30 where due_date is null;

create table if not exists invoice_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  kind text not null check (kind in ('created','sent','reminded','paid','unpaid')),
  created_at timestamptz not null default now()
);
create index if not exists invoice_events_invoice_idx on invoice_events(invoice_id, created_at);

-- Same owner-email-locked pattern as every other table (see 001_schema.sql).
alter table invoice_events enable row level security;
create policy owner_invoice_events on invoice_events for all to authenticated
  using ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com')
  with check ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com');
