"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCustomer, finalizeInvoice, getInvoice, listCustomers, listPresets, saveInvoiceDraft,
} from "@/lib/db";
import { clearForm, emptyForm, loadForm, plusDays, storeForm, type FormState } from "@/lib/formStorage";
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
  const { activeBusiness } = useBusiness();
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

  // Resolves which business this form belongs to and loads its initial
  // content. For a brand-new invoice, this intentionally does NOT list
  // `activeBusiness` in its dependency array — it captures whichever
  // business is active at the moment this effect first runs (component
  // mount, or draftId/duplicateId changing to load a *different* existing
  // invoice) and then ignores later nav switches, so an in-progress draft's
  // business can never change out from under the owner mid-edit. See the
  // Task 10 header note above for the reasoning.
  useEffect(() => {
    (async () => {
      if (draftId) {
        const inv = await getInvoice(draftId);
        setFormBusinessId(inv.business_id);
        setLoadedStatus(inv.status);
        setLoadedNumber(inv.invoice_number);
        setDueTouched(true); // an existing invoice's due date is explicit, not a default to auto-follow
        setForm({
          invoiceId: inv.id, issueDate: inv.issue_date,
          dueDate: inv.due_date ?? plusDays(inv.issue_date, 30),
          customerId: inv.customer_id,
          newCustomer: null, jobEvent: inv.job_event, jobDate: inv.job_date,
          jobLocation: inv.job_location, lineItems: inv.line_items,
          discountType: inv.discount_type, discountValue: inv.discount_value,
        });
      } else if (duplicateId) {
        const inv = await getInvoice(duplicateId);
        setFormBusinessId(inv.business_id);
        setForm({
          ...emptyForm(), customerId: inv.customer_id, jobEvent: inv.job_event,
          jobDate: inv.job_date, jobLocation: inv.job_location,
          lineItems: inv.line_items, discountType: inv.discount_type,
          discountValue: inv.discount_value,
        });
      } else {
        if (!activeBusiness) return;
        setFormBusinessId(activeBusiness.id);
        setForm(loadForm() ?? emptyForm());
      }
    })().catch((e) => setError(e instanceof Error ? e.message : "Failed to load invoice"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, duplicateId]);

  // If activeBusiness wasn't ready yet on first mount (still loading from
  // BusinessProvider), pick it up once it arrives — but only for a
  // brand-new invoice that hasn't resolved a business yet at all.
  useEffect(() => {
    if (draftId || duplicateId) return;
    if (formBusinessId || !activeBusiness) return;
    setFormBusinessId(activeBusiness.id);
    setForm((prev) => prev ?? loadForm() ?? emptyForm());
  }, [draftId, duplicateId, formBusinessId, activeBusiness]);

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
  const set = (patch: Partial<FormState>) => setForm({ ...f, ...patch });

  async function persistDraft(): Promise<string> {
    if (!formBusinessId) throw new Error("No business selected");
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
                  set({ issueDate, dueDate: dueTouched ? f.dueDate : plusDays(issueDate, 30) });
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
        <div className="action-bar">
          <button onClick={onSaveDraft} disabled={busy !== ""} className="btn btn-secondary" style={{ flex: 1 }}>
            {busy === "draft" ? "Saving…" : "Save Draft"}
          </button>
          <button onClick={onFinalize}
            disabled={busy !== "" || totals.total <= 0 || (!f.customerId && !f.newCustomer?.name.trim())}
            className="btn btn-primary" style={{ flex: 1 }}>
            {busy === "final" ? "Finalizing…" : "Finalize Invoice"}
          </button>
        </div>
      )}
    </main>
  );
}
