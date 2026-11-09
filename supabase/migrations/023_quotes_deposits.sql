-- supabase/migrations/023_quotes_deposits.sql
-- Quotes and deposits (Apex Cinematics, phase 1).
--
-- Quotes are invoices rows with doc_type = 'quote': same items/form/PDF, own
-- numbering (Q-1, Q-2 … per business), valid-until in due_date. Converting a
-- quote creates an invoice draft and records it in converted_invoice_id.
--
-- Deposits: invoices.deposit_percent is the share asked for upfront; actual
-- money received is recorded in payments, one row per transfer.

alter table invoices
  add column if not exists doc_type text not null default 'invoice'
    check (doc_type in ('invoice', 'quote')),
  add column if not exists deposit_percent numeric not null default 0
    check (deposit_percent >= 0 and deposit_percent <= 100),
  add column if not exists converted_invoice_id uuid
    references invoices(id) on delete set null;

create index if not exists invoices_business_doc_type_idx on invoices (business_id, doc_type);

alter table businesses
  add column if not exists next_quote_seq int not null default 1;

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  amount_cents int not null check (amount_cents > 0),
  paid_on date not null default current_date,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists payments_invoice_idx on payments (invoice_id);

alter table payments enable row level security;

drop policy if exists owner_payments on payments;
create policy owner_payments on payments for all to authenticated
  using ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com')
  with check ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com');

-- Issues a draft quote: assigns the business's next free Q-number. Mirrors
-- finalize_invoice (014): tolerant of a stale counter, never reuses a number.
create or replace function finalize_quote(q_id uuid)
returns text
language plpgsql
security invoker
as $$
declare
  num text;
  biz_id uuid;
  seq int;
  attempts int := 0;
begin
  select business_id into biz_id from invoices
   where id = q_id and doc_type = 'quote';
  if biz_id is null then
    raise exception 'quote % not found', q_id;
  end if;

  select next_quote_seq into seq from businesses where id = biz_id for update;

  loop
    attempts := attempts + 1;
    if attempts > 1000 then
      raise exception 'could not find a free quote number for business %', biz_id;
    end if;
    num := 'Q-' || seq::text;
    seq := seq + 1;
    exit when not exists (
      select 1 from invoices where business_id = biz_id and invoice_number = num
    );
  end loop;

  update businesses set next_quote_seq = seq where id = biz_id;

  update invoices
     set invoice_number = num, status = 'unpaid', updated_at = now()
   where id = q_id and status = 'draft';

  if not found then
    raise exception 'quote % is not a draft', q_id;
  end if;

  return num;
end;
$$;
