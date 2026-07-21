-- supabase/migrations/008_infill_percent.sql
-- The quote calculator estimated weight from the model's SOLID volume (as if
-- printed 100% full), which over-quotes real prints that use ~15% infill.
-- Add an average infill % so the weight/material estimate reflects how much
-- plastic a print actually uses.
alter table print_pricing_settings
  add column infill_percent numeric not null default 15;
