-- Delete an invoice and, if it holds the most recently issued number,
-- rewind the sequence so that number is reused by the next invoice.
create or replace function delete_invoice_rewind(inv_id uuid)
returns boolean
language plpgsql
security invoker
as $$
declare
  num text;
  pref text;
  seq int;
  rewound boolean := false;
begin
  select invoice_number into num from invoices where id = inv_id for update;

  if not found then
    raise exception 'invoice % not found', inv_id;
  end if;

  delete from invoices where id = inv_id;

  if num is not null then
    select invoice_prefix, next_invoice_seq into pref, seq
      from settings where id = 1 for update;
    if num = pref || (seq - 1)::text then
      update settings set next_invoice_seq = seq - 1 where id = 1;
      rewound := true;
    end if;
  end if;

  return rewound;
end;
$$;
