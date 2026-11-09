-- supabase/migrations/024_shoot_contract.sql
-- Shoot agreement (phase 2): which clauses apply to this invoice/quote, set
-- per client in the form. null = no contract attached. Shape:
-- { "preset": "standard"|"strict"|"custom", "on": [clause ids],
--   "revisions": n, "deliveryDays": n } — see src/lib/shootTerms.ts.

alter table invoices
  add column if not exists contract jsonb;
