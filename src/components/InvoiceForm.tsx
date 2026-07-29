"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCustomer, finalizeInvoice, getInvoice, listCustomers, listPresets, saveInvoiceDraft,
} from "@/lib/db";
import { clearForm, emptyForm, loadForm, storeForm, type FormState } from "@/lib/formStorage";
import { plusDaysIso } from "@/lib/date";
import { formatSgPhone } from "@/lib/phone";
import { discountCents, formatSGD, subtotalCents, totalCents } from "@/lib/money";
import type { Customer, Preset } from "@/lib/types";
import { IconClose } from "@/components/icons";
import { useBusiness } from "@/lib/businessContext";

type NewCustomerKey = "name" | "company" | "phone" | "email" | "uen" | "address";
const NEW_CUSTOMER_FIELDS: {
  k: NewCustomerKey; label: string; type: string; ac: string; placeholder?: string;
}[] = [
  { k: "name", label: "Name", type: "text", ac: "name" },
  { k: "company", label: "Company name (optional)", type: "text", ac: "organization" },
  { k: "phone", label: "Phone", type: "tel", ac: "tel", placeholder: "+65 9123 4567" },
  { k: "email", label: "Email", type: "email", ac: "email" },
  { k: "uen", label: "UEN (optional)", type: "text", ac: "off" },
  { k: "address", label: "Address (optional)", type: "text", ac: "street-address" },
];

export default function InvoiceForm({ duplicateId, draftId }: { duplicateId?: string; draftId?: string }) {
  const router = useRouter();
  const { businesses, activeBusiness } = useBusiness();
  const [form, setForm] = useState<FormState | null>(null);
  const [formBusinessId, setFormBusinessId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [busy, setBusy] = useState<"" | "draft" | "final">("");
  const [error, setError] = useState<string | null>(null);
  const [loadedStatus, setLoadedStatus] = useState<"draft" | "unpaid" | "paid">("draft");
  const [loadedNumber, setLoadedNumber] = useState<string | null>(null);
  // Whether the user has manually edited the due date — until then it
  // follows issue date + 30 automatically.
  const [dueTouched, setDueTouched] = useState(false);
  // Which draft/duplicate id (or "new") has already been loaded — see the
  // effect below.
  const loadedRef = useRef<string | null>(null);

  // Resolves which business this form belongs to and loads its initial
  // content, exactly once per thing-being-edited. `loadedRef` holds the key
  // already loaded: a draft/duplicate id, or the constant "new".
  //
  // For a brand-new invoice the key never changes, so once a business has
  // been captured, later nav switches are ignored and an in-progress draft's
  // business can never change out from under the owner mid-edit. A new
  // invoice still has to *wait* for `activeBusiness` (BusinessProvider may
  // not have loaded on first mount), which is why activeBusiness is in the
  // dependency list — the "new" key guard, not the deps, is what freezes it.
  useEffect(() => {
    const key = draftId ?? duplicateId ?? "new";
    if (loadedRef.current === key) return;
    if (!draftId && !duplicateId && !activeBusiness) return; // wait for a business
    loadedRef.current = key;
    (async () => {
      if (draftId) {
        const inv = await getInvoice(draftId);
        setFormBusinessId(inv.business_id);
        setLoadedStatus(inv.status);
        setLoadedNumber(inv.invoice_number);
        setDueTouched(true); // an existing invoice's due date is explicit, not a default to auto-follow
        setForm({
          invoiceId: inv.id, businessId: inv.business_id, issueDate: inv.issue_date,
          dueDate: inv.due_date ?? plusDaysIso(inv.issue_date, 30),
          customerId: inv.customer_id,
          newCustomer: null, jobEvent: inv.job_event, jobDate: inv.job_date,
          jobLocation: inv.job_location, lineItems: inv.line_items,
          discountType: inv.discount_type, discountValue: inv.discount_value,
        });
      } else if (duplicateId) {
        const inv = await getInvoice(duplicateId);
        setFormBusinessId(inv.business_id);
        setForm({
          ...emptyForm(), businessId: inv.business_id, customerId: inv.customer_id, jobEvent: inv.job_event,
          jobDate: inv.job_date, jobLocation: inv.job_location,
          lineItems: inv.line_items, discountType: inv.discount_type,
          discountValue: inv.discount_value,
        });
      } else {
        const bizId = activeBusiness!.id;
        setFormBusinessId(bizId);
        setForm(loadForm(bizId) ?? { ...emptyForm(), businessId: bizId });
      }
    })().catch((e) => {
      loadedRef.current = null; // let a retry re-attempt the failed load
      setError(e instanceof Error ? e.message : "Failed to load invoice");
    });
  }, [draftId, duplicateId, activeBusiness]);

  useEffect(() => {
    if (!formBusinessId) return;
    listCustomers(formBusinessId).then(setCustomers).catch((e) => setError(e instanceof Error ? e.message : "Failed to load customers"));
    listPresets(formBusinessId).then(setPresets).catch((e) => setError(e instanceof Error ? e.message : "Failed to load presets"));
  }, [formBusinessId]);

  // Autosave to localStorage — but never for finalized invoices being edited,
  // so a finalized edit can't resurface later as a stray "new invoice" form.
  useEffect(() => { if (form && loadedStatus === "draft") storeForm(form); }, [form, loadedStatus]);

  const totals = useMemo(() => {
    if (!form) return { sub: 0, disc: 0, total: 0 };
    const sub = subtotalCents(form.lineItems);
    return {
      sub,
      disc: discountCents(sub, form.discountType, form.discountValue),
      total: totalCents(form.lineItems, form.discountType, form.discountValue),
    };
  }, [form]);

  if (!form) return (
    <div className="page-container">
      <p style={{ color: error ? "var(--warning)" : "var(--text-tertiary)" }}>
        {error || "Loading…"}
      </p>
    </div>
  );

  const f = form;
  const formBusiness = businesses.find((b) => b.id === formBusinessId);
  // Functional updater: merges onto the latest state rather than the `f`
  // snapshot closed over at render time. persistDraft() below calls set()
  // twice across an await boundary (once after creating a new customer,
  // once after saving the draft) — merging onto a stale `f` would let the
  // second call silently undo the first, leaving newCustomer un-cleared and
  // risking a duplicate customer being created if the user retries after a
  // failure (e.g. a finalize that errors after the draft save).
  const set = (patch: Partial<FormState>) => setForm((prev) => (prev ? { ...prev, ...patch } : prev));

  async function persistDraft(): Promise<string> {
    if (!formBusinessId) throw new Error("No business selected");
    // Saving drops lines with no description (see the filter below) — a
    // priced line with a blank description would otherwise be counted in
    // the on-screen total but silently vanish from what's actually saved.
    if (f.lineItems.some((li) => li.description.trim() === "" && li.qty * li.unitPriceCents !== 0)) {
      throw new Error("A line item has a price but no description — add one or remove the line");
    }
    let customerId = f.customerId;
    if (f.newCustomer && f.newCustomer.name.trim()) {
      const c = await createCustomer({ ...f.newCustomer, phone: formatSgPhone(f.newCustomer.phone) }, formBusinessId);
      customerId = c.id;
      setCustomers([...customers, c]);
      set({ customerId: c.id, newCustomer: null });
    }
    const inv = await saveInvoiceDraft({
      id: f.invoiceId, issue_date: f.issueDate, due_date: f.dueDate, customer_id: customerId,
      job_event: f.jobEvent, job_date: f.jobDate, job_location: f.jobLocation,
      line_items: f.lineItems.filter((li) => li.description.trim() !== ""),
      discount_type: f.discountType, discount_value: f.discountValue,
    }, formBusinessId);
    if (!f.invoiceId) set({ invoiceId: inv.id });
    return inv.id;
  }

  async function onSaveDraft() {
    setBusy("draft"); setError(null);
    try {
      await persistDraft();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save draft");
    }
    setBusy("");
  }

  async function onFinalize() {
    setBusy("final"); setError(null);
    try {
      const id = await persistDraft();
      // persistDraft() throws before this point if formBusinessId is null.
      await finalizeInvoice(id, formBusinessId!);
      clearForm();
      router.push(`/invoices_login/invoices/${id}?just=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to finalize invoice");
      setBusy("");
    }
  }

  async function onSaveChanges() {
    setBusy("final"); setError(null);
    try {
      const id = await persistDraft();
      router.push(`/invoices_login/invoices/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save changes");
      setBusy("");
    }
  }

  const editingFinalized = loadedStatus !== "draft";

  return (
    <main className="page-container animate-fade-in">
      <h1 className="page-title">
        {editingFinalized ? `Edit ${loadedNumber}` : f.invoiceId ? "Edit Draft" : "New Invoice"}
      </h1>
      <p className="page-subtitle">
        {editingFinalized
          ? `Fix details on this invoice — its number (${loadedNumber}) stays the same`
          : "Fill in the details below"}
      </p>

      <div className="invoice-form-grid">
      <div>
      {/* Customer section */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-label">Customer</div>
        <select className="input" value={f.newCustomer ? "new" : f.customerId ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "new") set({ newCustomer: { name: "", company: "", phone: "", email: "", uen: "", address: "" }, customerId: null });
            else set({ customerId: v ? Number(v) : null, newCustomer: null });
          }}>
          <option value="">— Select customer —</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name} (#{c.id})</option>)}
          <option value="new">+ New customer</option>
        </select>
        {f.newCustomer && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {NEW_CUSTOMER_FIELDS.map(({ k, label, type, ac, placeholder }) => (
              <div key={k}>
                <label className="input-label">{label}</label>
                <input className="input" placeholder={placeholder ?? label}
                  type={type} autoComplete={ac}
                  value={f.newCustomer![k]}
                  onChange={(e) => set({ newCustomer: { ...f.newCustomer!, [k]: e.target.value } })} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Job section */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-label">Job Details</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label className="input-label">Event name</label>
            <input className="input" placeholder="e.g. Jordan Birthday Party Shoot"
              value={f.jobEvent} onChange={(e) => set({ jobEvent: e.target.value })} />
          </div>
          <div>
            <label className="input-label">Event date & time</label>
            <input className="input" placeholder="e.g. 20 June 2026, 7-9PM"
              value={f.jobDate} onChange={(e) => set({ jobDate: e.target.value })} />
          </div>
          <div>
            <label className="input-label">Location</label>
            <input className="input" placeholder="e.g. Marina Bay Sands"
              value={f.jobLocation} onChange={(e) => set({ jobLocation: e.target.value })} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="input-label">Invoice date</label>
              <input type="date" className="input" value={f.issueDate}
                onChange={(e) => {
                  const issueDate = e.target.value;
                  set({ issueDate, dueDate: dueTouched ? f.dueDate : plusDaysIso(issueDate, 30) });
                }} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="input-label">Due date</label>
              <input type="date" className="input" value={f.dueDate}
                onChange={(e) => { setDueTouched(true); set({ dueDate: e.target.value }); }} />
            </div>
          </div>
        </div>
      </div>
      </div>

      <div>
      {/* Line items */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div className="section-label" style={{ marginBottom: 0 }}>Line Items</div>
          {presets.length > 0 && (
            <select className="input" style={{ width: "auto", padding: "6px 32px 6px 10px", fontSize: "0.8rem" }} value=""
              onChange={(e) => {
                const p = presets.find((x) => x.id === e.target.value);
                if (p) set({
                  lineItems: [...f.lineItems.filter((li) => li.description || li.unitPriceCents),
                    { description: `${p.name}${p.description ? `\n${p.description}` : ""}`,
                      qty: p.default_qty, unitPriceCents: p.unit_price_cents }],
                });
              }}>
              <option value="">+ Add preset</option>
              {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {f.lineItems.map((li, i) => (
            <div key={i} style={{
              background: "var(--bg-primary)",
              borderRadius: "var(--radius-md)",
              padding: 14,
              border: "1px solid var(--border-subtle)",
            }}>
              <textarea className="input" rows={2} placeholder="Description (event, time, shoot type, location)"
                style={{ marginBottom: 10, minHeight: 60 }}
                value={li.description}
                onChange={(e) => set({ lineItems: f.lineItems.map((x, j) => j === i ? { ...x, description: e.target.value } : x) })} />
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ width: 72 }}>
                  <label className="input-label">Qty</label>
                  <input className="input" inputMode="decimal" placeholder="1"
                    style={{ textAlign: "center" }}
                    value={li.qty || ""}
                    onChange={(e) => set({ lineItems: f.lineItems.map((x, j) => j === i ? { ...x, qty: parseFloat(e.target.value) || 0 } : x) })} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="input-label">Unit price ($)</label>
                  <input className="input" inputMode="decimal" placeholder="0.00"
                    value={li.unitPriceCents ? li.unitPriceCents / 100 : ""}
                    onChange={(e) => set({ lineItems: f.lineItems.map((x, j) => j === i ? { ...x, unitPriceCents: Math.round((parseFloat(e.target.value) || 0) * 100) } : x) })} />
                </div>
                <div style={{ textAlign: "right", minWidth: 80, paddingTop: 20 }}>
                  <span className="money" style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                    {formatSGD(Math.round(li.qty * li.unitPriceCents))}
                  </span>
                </div>
                <button className="btn-danger" style={{ marginTop: 16 }} aria-label="Remove line"
                  onClick={() => set({ lineItems: f.lineItems.filter((_, j) => j !== i) })}>
                  <IconClose size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <button className="btn btn-ghost" style={{ marginTop: 12, width: "100%" }}
          onClick={() => set({ lineItems: [...f.lineItems, { description: "", qty: 1, unitPriceCents: 0 }] })}>
          + Add line item
        </button>
      </div>

      {/* Discount */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-label">Discount</div>
        <div style={{ display: "flex", gap: 10 }}>
          <select className="input" style={{ width: "auto", flex: "0 0 auto" }} value={f.discountType}
            onChange={(e) => set({ discountType: e.target.value as FormState["discountType"] })}>
            <option value="none">None</option>
            <option value="amount">Amount ($)</option>
            <option value="percent">Percent (%)</option>
          </select>
          {f.discountType !== "none" && (
            <input className="input" inputMode="decimal" placeholder={f.discountType === "amount" ? "0.00" : "10"}
              style={{ flex: 1 }}
              value={f.discountValue || ""}
              onChange={(e) => set({ discountValue: parseFloat(e.target.value) || 0 })} />
          )}
        </div>
      </div>

      {/* Totals */}
      <div className="totals-section" style={{ marginBottom: 20 }}>
        <div className="total-row">
          <span>Subtotal</span>
          <span className="money" style={{ fontWeight: 600 }}>{formatSGD(totals.sub)}</span>
        </div>
        {totals.disc > 0 && (
          <div className="total-row">
            <span>Discount</span>
            <span style={{ color: "var(--warning)", fontWeight: 600 }}>−{formatSGD(totals.disc)}</span>
          </div>
        )}
        <div className="total-row-final">
          <span>Total Due</span>
          <span>{formatSGD(totals.total)}</span>
        </div>
      </div>
      </div>
      </div>

      {error && (
        <div style={{
          background: "var(--warning-bg)",
          color: "var(--warning)",
          padding: "10px 14px",
          borderRadius: "var(--radius-sm)",
          fontSize: "0.85rem",
          fontWeight: 600,
          marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {editingFinalized ? (
        <div className="action-bar">
          <button onClick={() => router.push(`/invoices_login/invoices/${f.invoiceId}`)} disabled={busy !== ""}
            className="btn btn-secondary" style={{ flex: 1 }}>
            Cancel
          </button>
          <button onClick={onSaveChanges}
            disabled={busy !== "" || totals.total <= 0}
            className="btn btn-primary" style={{ flex: 2 }}>
            {busy === "final" ? "Saving…" : "Save Changes"}
          </button>
        </div>
      ) : (
        <div className="action-bar" style={{ flexDirection: "column" }}>
          {formBusiness && (
            <p style={{ color: "var(--text-tertiary)", fontSize: "0.78rem", margin: "0 0 8px", width: "100%" }}>
              This will be invoice{" "}
              <span className="money" style={{ fontWeight: 600 }}>
                {formBusiness.invoice_prefix}{formBusiness.next_invoice_seq}
              </span>.
            </p>
          )}
          <div style={{ display: "flex", gap: 10, width: "100%" }}>
          <button onClick={onSaveDraft} disabled={busy !== ""} className="btn btn-secondary" style={{ flex: 1 }}>
            {busy === "draft" ? "Saving…" : "Save Draft"}
          </button>
          <button onClick={onFinalize}
            disabled={busy !== "" || totals.total <= 0 || (!f.customerId && !f.newCustomer?.name.trim())}
            className="btn btn-primary" style={{ flex: 1 }}>
            {busy === "final" ? "Finalizing…" : "Finalize Invoice"}
          </button>
          </div>
        </div>
      )}
    </main>
  );
}
