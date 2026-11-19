-- 026: client PO / reference number on invoices & quotes, and the
-- business's own UEN printed under its address on the PDF.
alter table invoices add column if not exists po_number text;
alter table businesses add column if not exists uen text;
