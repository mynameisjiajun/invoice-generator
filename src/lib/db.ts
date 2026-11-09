import { createClient } from "@/lib/supabase/client";
import { subtotalCents, totalCents } from "@/lib/money";
import { plusDaysIso, todayLocalIso } from "@/lib/date";
import { paidCents } from "@/lib/payments";
import type {
  Business, Customer, DocType, Invoice, InvoiceEvent, InvoiceEventKind, Payment, Preset,
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
export async function createBusiness(
  input: { name: string; slug: string; invoice_prefix: string },
): Promise<Business> {
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
/** Deletes a client. The invoices FK has no ON DELETE action (deliberately —
 *  see 005_customer_number_cascade.sql), so the database refuses to delete a
 *  client that still has invoices rather than orphaning or cascading them.
 *  That refusal is surfaced as a readable message; the UI checks up front too,
 *  this is the backstop for a client invoiced between check and confirm. */
export async function deleteCustomer(id: number): Promise<void> {
  const res = await db().from("customers").delete().eq("id", id).select();
  if (res.error) {
    if (res.error.code === "23503" || /foreign key|violates/i.test(res.error.message)) {
      throw new Error("This client still has invoices — delete those first");
    }
    throw new Error(res.error.message);
  }
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
  // Only send replacement_cents when set, so presets still save on a
  // database without migration 022.
  const { replacement_cents, ...rest } = p;
  const row = replacement_cents ? { ...rest, replacement_cents } : rest;
  return ok(await db().from("presets").insert({ ...row, business_id: businessId }).select().single());
}
export async function deletePreset(id: string): Promise<void> {
  ok(await db().from("presets").delete().eq("id", id).select());
}

// payments(*) needs migration 023. Payments sort oldest first for receipts.
const INVOICE_SELECT = "*, customers(*), payments(*)";

function sortPayments(inv: Invoice): Invoice {
  if (inv.payments?.length) {
    inv.payments = [...inv.payments].sort((a, b) =>
      a.paid_on.localeCompare(b.paid_on) || a.created_at.localeCompare(b.created_at));
  }
  return inv;
}

async function listDocs(docType: DocType | null, businessId?: string): Promise<Invoice[]> {
  let q = db().from("invoices").select(INVOICE_SELECT).order("created_at", { ascending: false });
  if (businessId) q = q.eq("business_id", businessId);
  if (docType) q = q.eq("doc_type", docType);
  return ok<Invoice[]>(await q).map(sortPayments);
}

/** Invoices only (never quotes). Omit businessId to list across every
 *  business (used by the Stats "All businesses" view). */
export async function listInvoices(businessId?: string): Promise<Invoice[]> {
  return listDocs("invoice", businessId);
}

export async function listQuotes(businessId: string): Promise<Invoice[]> {
  return listDocs("quote", businessId);
}
export async function getInvoice(id: string): Promise<Invoice> {
  return sortPayments(ok(await db().from("invoices").select(INVOICE_SELECT).eq("id", id).single()));
}

export async function listInvoicesForCustomer(customerId: number): Promise<Invoice[]> {
  return ok<Invoice[]>(await db().from("invoices").select(INVOICE_SELECT)
    .eq("customer_id", customerId).eq("doc_type", "invoice")
    .order("created_at", { ascending: false })).map(sortPayments);
}

export type DraftInput = Pick<Invoice,
  "issue_date" | "due_date" | "customer_id" | "job_event" | "job_date" | "job_location" |
  "line_items" | "discount_type" | "discount_value" |
  "is_rental" | "rental_start" | "rental_end" | "rental_terms" |
  "doc_type" | "deposit_percent" | "contract"> & { id?: string };

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

/** Issues a draft quote: assigns its Q-number. */
export async function finalizeQuote(id: string): Promise<string> {
  return ok(await db().rpc("finalize_quote", { q_id: id }));
}

/** Turns a quote into an invoice draft carrying the same client, job, items,
 *  discount, deposit and rental details, and marks the quote accepted.
 *  Converting again returns the invoice made the first time. */
export async function convertQuote(quoteId: string): Promise<string> {
  const q = await getInvoice(quoteId);
  if (q.converted_invoice_id) return q.converted_invoice_id;
  const today = todayLocalIso();
  const collection = (q.rental_start ?? "").slice(0, 10);
  const draft = await saveInvoiceDraft({
    doc_type: "invoice",
    issue_date: today,
    due_date: q.is_rental && /^\d{4}-\d{2}-\d{2}$/.test(collection) ? collection : plusDaysIso(today, 30),
    customer_id: q.customer_id,
    job_event: q.job_event, job_date: q.job_date, job_location: q.job_location,
    line_items: q.line_items,
    discount_type: q.discount_type, discount_value: q.discount_value,
    deposit_percent: q.deposit_percent ?? 0,
    ...(q.contract ? { contract: q.contract } : {}),
    ...(q.is_rental ? {
      is_rental: true, rental_start: q.rental_start ?? "", rental_end: q.rental_end ?? "",
      rental_terms: q.rental_terms !== false,
    } : {}),
  }, q.business_id);
  ok(await db().from("invoices").update({ converted_invoice_id: draft.id }).eq("id", quoteId).select().single());
  return draft.id;
}

/** Records money received. Once the total is covered the invoice becomes
 *  paid (dated the day the last payment arrived). Returns the fresh invoice. */
export async function recordPayment(
  inv: Invoice, p: { amount_cents: number; paid_on: string; note: string },
): Promise<Invoice> {
  if (!(p.amount_cents > 0)) throw new Error("Enter an amount above $0");
  ok(await db().from("payments").insert({
    invoice_id: inv.id, business_id: inv.business_id,
    amount_cents: Math.round(p.amount_cents), paid_on: p.paid_on, note: p.note.trim(),
  }).select().single());
  const fresh = await getInvoice(inv.id);
  if (fresh.status !== "paid" && paidCents(fresh) >= fresh.total_cents) {
    ok(await db().from("invoices").update({ status: "paid", paid_date: p.paid_on })
      .eq("id", inv.id).select().single());
    await logEvent(inv.id, inv.business_id, "paid");
    return getInvoice(inv.id);
  }
  return fresh;
}

/** Removes a recorded payment; an invoice that is no longer covered goes
 *  back to unpaid. Returns the fresh invoice. */
export async function deletePayment(inv: Invoice, paymentId: Payment["id"]): Promise<Invoice> {
  ok(await db().from("payments").delete().eq("id", paymentId).select());
  const fresh = await getInvoice(inv.id);
  const sum = (fresh.payments ?? []).reduce((s, x) => s + x.amount_cents, 0);
  if (fresh.status === "paid" && sum < fresh.total_cents && sum > 0) {
    ok(await db().from("invoices").update({ status: "unpaid", paid_date: null })
      .eq("id", inv.id).select().single());
    await logEvent(inv.id, inv.business_id, "unpaid");
    return getInvoice(inv.id);
  }
  return fresh;
}

export async function finalizeInvoice(id: string, businessId: string): Promise<string> {
  const num: string = ok(await db().rpc("finalize_invoice", { inv_id: id }));
  await logEvent(id, businessId, "created");
  return num;
}

/** Record (or clear) that the renter's signed T&C acknowledgement is back. */
export async function setRentalSigned(id: string, signed: boolean): Promise<string | null> {
  const at = signed ? new Date().toISOString() : null;
  ok(await db().from("invoices").update({ rental_signed_at: at }).eq("id", id).select().single());
  return at;
}

export async function setPaid(id: string, paid: boolean, businessId: string): Promise<void> {
  ok(await db().from("invoices").update({
    status: paid ? "paid" : "unpaid",
    paid_date: paid ? todayLocalIso() : null,
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
export async function deleteInvoice(id: string, docType: DocType = "invoice"): Promise<boolean> {
  // Quotes use their own Q- counter; the rewind RPC only knows invoice numbers.
  if (docType === "quote") {
    ok(await db().from("invoices").delete().eq("id", id).select());
    return false;
  }
  return ok(await db().rpc("delete_invoice_rewind", { inv_id: id }));
}

/** Full JSON backup — everything needed to reconstruct the business if
 *  Supabase is ever lost. */
export async function exportAllData() {
  const [businesses, invoices] = await Promise.all([listBusinesses(), listDocs(null)]);
  const perBiz = await Promise.all(businesses.map(async (b) => ({
    customers: await listCustomers(b.id),
    presets: await listPresets(b.id),
  })));
  return {
    exported_at: new Date().toISOString(),
    businesses: businesses.map((b, i) => ({ ...b, ...perBiz[i] })),
    invoices,
  };
}
