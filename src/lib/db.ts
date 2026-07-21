import { createClient } from "@/lib/supabase/client";
import { subtotalCents, totalCents } from "@/lib/money";
import type {
  Business, Customer, Invoice, InvoiceEvent, InvoiceEventKind,
  Preset, PrintPricingSettings, PrintQuote, PrintQuoteStatus,
} from "@/lib/types";

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
/** Create a customer. Pass `id` to assign a specific client number (for
 *  importing existing clients); omit it to auto-assign the next number.
 *  A taken number surfaces a friendly error. */
export async function createCustomer(
  c: Omit<Customer, "id" | "business_id" | "company" | "uen"> & { id?: number; company?: string; uen?: string },
  businessId: string,
): Promise<Customer> {
  const { id, ...rest } = c;
  const payload = { ...rest, business_id: businessId, ...(id != null ? { id } : {}) };
  const res = await db().from("customers").insert(payload).select().single();
  if (res.error) {
    if (res.error.code === "23505" || /duplicate key|unique/i.test(res.error.message)) {
      throw new Error(`Client number ${id} is already in use`);
    }
    throw new Error(res.error.message);
  }
  return res.data as Customer;
}
export async function updateCustomer(id: number, patch: Partial<Customer>): Promise<void> {
  ok(await db().from("customers").update(patch).eq("id", id).select().single());
}
/** Change a customer's client number (primary key). Cascades to that
 *  customer's invoices via the ON UPDATE CASCADE FK (migration 005).
 *  Throws a friendly error if the target number is already taken. */
export async function updateCustomerNumber(oldId: number, newId: number): Promise<void> {
  const res = await db().from("customers").update({ id: newId }).eq("id", oldId).select().single();
  if (res.error) {
    if (res.error.code === "23505" || /duplicate key|unique/i.test(res.error.message)) {
      throw new Error(`Client number ${newId} is already in use`);
    }
    throw new Error(res.error.message);
  }
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

/** Best-effort activity log — never throws; a lost event must not fail the action. */
async function logEvent(invoiceId: string, businessId: string, kind: InvoiceEventKind) {
  try {
    await db().from("invoice_events").insert({ invoice_id: invoiceId, business_id: businessId, kind });
  } catch { /* ignore */ }
}

export async function listEvents(invoiceId: string): Promise<InvoiceEvent[]> {
  return ok(await db().from("invoice_events").select("*")
    .eq("invoice_id", invoiceId).order("created_at"));
}

export async function finalizeInvoice(id: string, businessId: string): Promise<string> {
  const num: string = ok(await db().rpc("finalize_invoice", { inv_id: id }));
  await logEvent(id, businessId, "created");
  return num;
}

export async function setPaid(id: string, paid: boolean, businessId: string): Promise<void> {
  ok(await db().from("invoices").update({
    status: paid ? "paid" : "unpaid",
    paid_date: paid ? new Date().toISOString().slice(0, 10) : null,
  }).eq("id", id).select().single());
  await logEvent(id, businessId, paid ? "paid" : "unpaid");
}

/** Stamp first-send time. No-op if already sent (first send wins). */
export async function markSent(id: string, businessId: string): Promise<void> {
  const res = ok<Invoice[]>(await db().from("invoices")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", id).is("sent_at", null).select());
  if (res.length > 0) await logEvent(id, businessId, "sent");
}

/** Deletes an invoice. If it held the most recently issued number, the
 *  sequence rewinds so that number is reused. Returns true when rewound. */
export async function deleteInvoice(id: string): Promise<boolean> {
  return ok(await db().rpc("delete_invoice_rewind", { inv_id: id }));
}

export async function getPricingSettings(businessId: string): Promise<PrintPricingSettings | null> {
  const res = await db().from("print_pricing_settings").select("*").eq("business_id", businessId).maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export async function savePricingSettings(settings: PrintPricingSettings): Promise<PrintPricingSettings> {
  return ok(await db().from("print_pricing_settings")
    .upsert({ ...settings, updated_at: new Date().toISOString() })
    .select().single());
}

export async function listPrintQuotes(businessId: string): Promise<PrintQuote[]> {
  return ok(await db().from("print_quotes").select("*").eq("business_id", businessId).order("created_at", { ascending: false }));
}

export async function updatePrintQuoteStatus(id: string, status: PrintQuoteStatus): Promise<void> {
  ok(await db().from("print_quotes").update({ status }).eq("id", id).select().single());
}

export type SubmitQuoteInput = Omit<PrintQuote, "id" | "created_at" | "status">;

export async function submitPrintQuote(input: SubmitQuoteInput): Promise<PrintQuote> {
  return ok(await db().from("print_quotes").insert(input).select().single());
}

export async function uploadPrintQuoteFile(businessId: string, file: File): Promise<string> {
  const path = `${businessId}/${crypto.randomUUID()}.stl`;
  const res = await db().storage.from("print-quote-files").upload(path, file);
  if (res.error) throw new Error(res.error.message);
  return path;
}

export async function getPrintQuoteFileUrl(path: string): Promise<string> {
  const res = await db().storage.from("print-quote-files").createSignedUrl(path, 3600);
  if (res.error) throw new Error(res.error.message);
  return res.data.signedUrl;
}
