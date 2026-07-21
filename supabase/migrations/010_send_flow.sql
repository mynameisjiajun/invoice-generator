-- supabase/migrations/010_send_flow.sql
-- Message templates are per-business so each business keeps its own voice.
-- Empty string means "use the app default" (defaults live in src/lib/templates.ts,
-- not here, so copy tweaks don't need a migration).
alter table businesses
  add column if not exists email_template text not null default '',
  add column if not exists whatsapp_template text not null default '';

alter table invoices
  add column if not exists sent_at timestamptz;
