-- supabase/migrations/014_invoice_number_scope.sql
-- Root cause of "duplicate key value violates unique constraint
-- invoices_invoice_number_key": invoice numbers are generated per-business
-- (finalize_invoice draws from businesses.invoice_prefix/next_invoice_seq,
-- see 003_businesses.sql) but the uniqueness constraint added in
-- 001_schema.sql is still global across the whole table. Every new business
-- starts at prefix 'A-' / seq 1 by default, which collides head-on with any
-- existing business already issuing 'A-1', 'A-2', ...
--
-- Fix in two parts: rescope the constraint to (business_id, invoice_number),
-- and make finalize_invoice tolerate a stale/misconfigured counter instead
-- of trusting it blindly, so a hand-edited next_invoice_seq (Settings lets
-- the owner set this directly) can never wedge invoice creation again.

alter table invoices drop constraint invoices_invoice_number_key;

-- Postgres unique indexes ignore NULLs, so multiple drafts per business
-- (invoice_number is null until finalize_invoice runs) stay unaffected.
create unique index invoices_business_number_key
  on invoices (business_id, invoice_number);

create or replace function finalize_invoice(inv_id uuid)
returns text
language plpgsql
security invoker
as $$
declare
  num text;
  biz_id uuid;
  pref text;
  seq int;
  attempts int := 0;
begin
  select business_id into biz_id from invoices where id = inv_id;
  if biz_id is null then
    raise exception 'invoice % not found', inv_id;
  end if;

  select invoice_prefix, next_invoice_seq into pref, seq
    from businesses where id = biz_id for update;

  loop
    attempts := attempts + 1;
    if attempts > 1000 then
      raise exception 'could not find a free invoice number for business % after 1000 attempts', biz_id;
    end if;
    num := pref || seq::text;
    seq := seq + 1;
    exit when not exists (
      select 1 from invoices where business_id = biz_id and invoice_number = num
    );
  end loop;

  update businesses set next_invoice_seq = seq where id = biz_id;

  update invoices
     set invoice_number = num, status = 'unpaid', updated_at = now()
   where id = inv_id and status = 'draft';

  if not found then
    raise exception 'invoice % is not a draft', inv_id;
  end if;

  return num;
end;
$$;
