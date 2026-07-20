import { createClient } from "@/lib/supabase/client";
import { subtotalCents, totalCents } from "@/lib/money";
import type { Business, Customer, Invoice, Preset } from "@/lib/types";

const db = () => createClient();

function ok<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export async function listBusinesses(): Promise<Business[]> {
  return ok(await db().from("businesses").select("*").order("created_at"));
}
export async function getBusiness(id: string): Promise<Business> {
  return ok(await db().from("businesses").select("*").eq("id", id).single());
}
export async function createBusiness(input: { name: string; slug: string }): Promise<Business> {
  return ok(await db().from("businesses").insert(input).select().single());
}
export async function updateBusiness(id: string, patch: Partial<Business>): Promise<void> {
  ok(await db().from("businesses").update(patch).eq("id", id).select().single());
}
export async function archiveBusiness(id: string): Promise<void> {
  ok(await db().from("businesses").update({ archived_at: new Date().toISOString() }).eq("id", id).select().single());
}

export async function listCustomers(businessId: string): Promise<Customer[]> {
  return ok(await db().from("customers").select("*").eq("business_id", businessId).order("name"));
}
export async function createCustomer(c: Omit<Customer, "id" | "business_id">, businessId: string): Promise<Customer> {
  return ok(await db().from("customers").insert({ ...c, business_id: businessId }).select().single());
}
export async function updateCustomer(id: number, patch: Partial<Customer>): Promise<void> {
  ok(await db().from("customers").update(patch).eq("id", id).select().single());
}

export async function listPresets(businessId: string): Promise<Preset[]> {
  return ok(await db().from("presets").select("*").eq("business_id", businessId).order("name"));
}
export async function createPreset(p: Omit<Preset, "id" | "business_id">, businessId: string): Promise<Preset> {
  return ok(await db().from("presets").insert({ ...p, business_id: businessId }).select().single());
}
export async function deletePreset(id: string): Promise<void> {
  ok(await db().from("presets").delete().eq("id", id).select());
}

const INVOICE_SELECT = "*, customers(*)";

/** Omit businessId to list invoices across every business (used by the
 *  Stats "All businesses" view). */
export async function listInvoices(businessId?: string): Promise<Invoice[]> {
  let q = db().from("invoices").select(INVOICE_SELECT).order("created_at", { ascending: false });
  if (businessId) q = q.eq("business_id", businessId);
  return ok(await q);
}
export async function getInvoice(id: string): Promise<Invoice> {
  return ok(await db().from("invoices").select(INVOICE_SELECT).eq("id", id).single());
}

export type DraftInput = Pick<Invoice,
  "issue_date" | "customer_id" | "job_event" | "job_date" | "job_location" |
  "line_items" | "discount_type" | "discount_value"> & { id?: string };

/** businessId is required when creating a new draft (draft.id is unset);
 *  ignored when updating an existing one, since an invoice's business
 *  never changes after creation. */
export async function saveInvoiceDraft(draft: DraftInput, businessId: string): Promise<Invoice> {
  const computed = {
    ...draft,
    subtotal_cents: subtotalCents(draft.line_items),
    total_cents: totalCents(draft.line_items, draft.discount_type, draft.discount_value),
    updated_at: new Date().toISOString(),
  };
  if (draft.id) {
    return ok(await db().from("invoices").update(computed).eq("id", draft.id).select(INVOICE_SELECT).single());
  }
  return ok(await db().from("invoices").insert({ ...computed, business_id: businessId }).select(INVOICE_SELECT).single());
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

/** Deletes an invoice. If it held the most recently issued number, the
 *  sequence rewinds so that number is reused. Returns true when rewound. */
export async function deleteInvoice(id: string): Promise<boolean> {
  return ok(await db().rpc("delete_invoice_rewind", { inv_id: id }));
}
