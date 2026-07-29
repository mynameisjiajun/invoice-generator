-- supabase/migrations/015_invoice_customer_same_business.sql
-- Nothing stopped an invoice from referencing a customer belonging to a
-- *different* business: invoices.customer_id pointed at customers(id) alone,
-- with no tie back to invoices.business_id. This was not theoretical — a
-- draft under "JJ Gears & Prints" was found pointing at a "JJ Visuals"
-- client, produced by the autosaved new-invoice form surviving a business
-- switch (fixed client-side in src/lib/formStorage.ts loadForm()).
--
-- Enforce the invariant in the schema so no client bug can reintroduce it.

-- 1) Clear the customer on any invoice whose customer belongs to another
--    business. Written as a set-based statement rather than against a
--    hardcoded id so it also catches anything created between auditing and
--    running this. These are recoverable: the invoice, its line items and
--    totals are untouched, and the owner re-picks the client in the UI
--    (finalize is already blocked while no customer is selected).
update invoices i
   set customer_id = null
  from customers c
 where c.id = i.customer_id
   and c.business_id <> i.business_id;

-- 2) A composite FK needs a matching unique key on the referenced side.
--    customers.id is already the PK, so this is a redundant-but-required
--    uniqueness declaration, not a new constraint on the data.
alter table customers add constraint customers_id_business_key
  unique (id, business_id);

-- 3) Replace the single-column FK with a composite one. ON UPDATE CASCADE is
--    carried over from 005_customer_number_cascade.sql, which added it so the
--    owner can renumber a client and have their invoices follow.
--    MATCH SIMPLE (the default) means the constraint is satisfied whenever
--    any referencing column is NULL, so customer-less drafts still work.
alter table invoices drop constraint invoices_customer_id_fkey;
alter table invoices add constraint invoices_customer_business_fkey
  foreign key (customer_id, business_id)
  references customers (id, business_id) on update cascade;

-- 4) Index the referencing columns so the ON UPDATE CASCADE stays cheap.
--    customer_id leads, so this also serves listInvoicesForCustomer()'s
--    customer_id-only filter, making the old single-column index redundant.
create index invoices_customer_business_idx on invoices (customer_id, business_id);
drop index if exists invoices_customer_id_idx;
