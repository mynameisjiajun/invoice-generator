-- supabase/migrations/007_core_indexes.sql
-- Speed: the core tables had no index on business_id, yet every
-- business-scoped list query filters on it. These are the app's hottest
-- paths (dashboard invoice list, invoice-form customer/preset lists).

-- Dashboard: listInvoices filters business_id, orders created_at desc.
create index if not exists invoices_business_created_idx
  on invoices (business_id, created_at desc);

-- Invoice list joins customers(*) and the FK column was unindexed, which
-- also slows the ON UPDATE CASCADE from a client-number change.
create index if not exists invoices_customer_id_idx
  on invoices (customer_id);

-- Invoice form: listCustomers filters business_id, orders name.
create index if not exists customers_business_name_idx
  on customers (business_id, name);

-- Invoice form: listPresets filters business_id, orders name.
create index if not exists presets_business_name_idx
  on presets (business_id, name);
