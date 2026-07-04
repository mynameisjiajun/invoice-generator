import { createClient } from "@/lib/supabase/client";
import { subtotalCents, totalCents } from "@/lib/money";
import type { Customer, Invoice, Preset, Settings } from "@/lib/types";

const db = () => createClient();

function ok<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export async function getSettings(): Promise<Settings> {
  return ok(await db().from("settings").select("*").eq("id", 1).single());
}
export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  ok(await db().from("settings").update(patch).eq("id", 1).select().single());
}

export async function listCustomers(): Promise<Customer[]> {
  return ok(await db().from("customers").select("*").order("name"));
}
export async function createCustomer(c: Omit<Customer, "id">): Promise<Customer> {
  return ok(await db().from("customers").insert(c).select().single());
}
export async function updateCustomer(id: number, patch: Partial<Customer>): Promise<void> {
  ok(await db().from("customers").update(patch).eq("id", id).select().single());
}

export async function listPresets(): Promise<Preset[]> {
  return ok(await db().from("presets").select("*").order("name"));
}
export async function createPreset(p: Omit<Preset, "id">): Promise<Preset> {
  return ok(await db().from("presets").insert(p).select().single());
}
export async function deletePreset(id: string): Promise<void> {
  ok(await db().from("presets").delete().eq("id", id).select());
}

const INVOICE_SELECT = "*, customers(*)";

export async function listInvoices(): Promise<Invoice[]> {
  return ok(await db().from("invoices").select(INVOICE_SELECT).order("created_at", { ascending: false }));
}
export async function getInvoice(id: string): Promise<Invoice> {
  return ok(await db().from("invoices").select(INVOICE_SELECT).eq("id", id).single());
}

export type DraftInput = Pick<Invoice,
  "issue_date" | "customer_id" | "job_event" | "job_date" | "job_location" |
  "line_items" | "discount_type" | "discount_value"> & { id?: string };

export async function saveInvoiceDraft(draft: DraftInput): Promise<Invoice> {
  const computed = {
    ...draft,
    subtotal_cents: subtotalCents(draft.line_items),
    total_cents: totalCents(draft.line_items, draft.discount_type, draft.discount_value),
    updated_at: new Date().toISOString(),
  };
  if (draft.id) {
    return ok(await db().from("invoices").update(computed).eq("id", draft.id).select(INVOICE_SELECT).single());
  }
  return ok(await db().from("invoices").insert(computed).select(INVOICE_SELECT).single());
}

export async function finalizeInvoice(id: string): Promise<string> {
  return ok(await db().rpc("finalize_invoice", { inv_id: id }));
}

export async function setPaid(id: string, paid: boolean): Promise<void> {
  ok(await db().from("invoices").update({
    status: paid ? "paid" : "unpaid",
    paid_date: paid ? new Date().toISOString().slice(0, 10) : null,
  }).eq("id", id).select().single());
}

export async function deleteInvoice(id: string): Promise<void> {
  ok(await db().from("invoices").delete().eq("id", id).select());
}
