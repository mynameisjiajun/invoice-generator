-- supabase/migrations/003_businesses.sql
-- Multi-business foundation: a businesses table becomes the scoping key
-- for customers/invoices/presets. The single-row settings table (which
-- held nothing but business-specific fields) is retired in favor of it.

create table businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  address text not null default '',
  phone text not null default '',
  email text not null default '',
  paynow_number text not null default '',
  payee_name text not null default '',
  bank_details text not null default '',
  payment_terms text not null default 'paynow within 30 days of invoice',
  invoice_prefix text not null default 'A-',
  next_invoice_seq int not null default 1,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

alter table businesses enable row level security;
create policy owner_businesses on businesses for all to authenticated
  using ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com')
  with check ((select auth.jwt()->>'email') = 'chuajiajun2705@gmail.com');

-- Seed the one existing business from the current settings row.
insert into businesses (name, slug, address, phone, email, paynow_number,
  payee_name, bank_details, payment_terms, invoice_prefix, next_invoice_seq)
select business_name, 'photography', address, phone, email, paynow_number,
  payee_name, bank_details, payment_terms, invoice_prefix, next_invoice_seq
from settings where id = 1;

-- Add business_id to every business-scoped table, backfill it to the one
-- business that exists at this point in the migration, then lock it down.
alter table customers add column business_id uuid references businesses(id);
alter table invoices add column business_id uuid references businesses(id);
alter table presets add column business_id uuid references businesses(id);

update customers set business_id = (select id from businesses limit 1);
update invoices set business_id = (select id from businesses limit 1);
update presets set business_id = (select id from businesses limit 1);

alter table customers alter column business_id set not null;
alter table invoices alter column business_id set not null;
alter table presets alter column business_id set not null;

drop table settings;

-- Re-point finalize_invoice at businesses instead of the retired settings
-- table, scoped by the invoice's own business rather than a single global row.
create or replace function finalize_invoice(inv_id uuid)
returns text
language plpgsql
security invoker
as $$
declare
  num text;
  biz_id uuid;
begin
  select business_id into biz_id from invoices where id = inv_id;
  if biz_id is null then
    raise exception 'invoice % not found', inv_id;
  end if;

  update businesses
     set next_invoice_seq = next_invoice_seq + 1
   where id = biz_id
  returning invoice_prefix || (next_invoice_seq - 1)::text into num;

  update invoices
     set invoice_number = num, status = 'unpaid', updated_at = now()
   where id = inv_id and status = 'draft';

  if not found then
    raise exception 'invoice % is not a draft', inv_id;
  end if;

  return num;
end;
$$;

-- Same re-pointing for the delete/rewind RPC.
create or replace function delete_invoice_rewind(inv_id uuid)
returns boolean
language plpgsql
security invoker
as $$
declare
  num text;
  biz_id uuid;
  pref text;
  seq int;
  rewound boolean := false;
begin
  select invoice_number, business_id into num, biz_id from invoices where id = inv_id for update;

  if not found then
    raise exception 'invoice % not found', inv_id;
  end if;

  delete from invoices where id = inv_id;

  if num is not null then
    select invoice_prefix, next_invoice_seq into pref, seq
      from businesses where id = biz_id for update;
    if num = pref || (seq - 1)::text then
      update businesses set next_invoice_seq = seq - 1 where id = biz_id;
      rewound := true;
    end if;
  end if;

  return rewound;
end;
$$;
