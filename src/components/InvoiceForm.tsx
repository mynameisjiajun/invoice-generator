"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCustomer, finalizeInvoice, getInvoice, listCustomers, listPresets, saveInvoiceDraft,
} from "@/lib/db";
import { clearForm, emptyForm, loadForm, storeForm, type FormState } from "@/lib/formStorage";
import { discountCents, formatSGD, subtotalCents, totalCents } from "@/lib/money";
import type { Customer, Preset } from "@/lib/types";

export default function InvoiceForm({ duplicateId, draftId }: { duplicateId?: string; draftId?: string }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [busy, setBusy] = useState<"" | "draft" | "final">("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCustomers().then(setCustomers).catch((e) => setError(e instanceof Error ? e.message : "Failed to load customers"));
    listPresets().then(setPresets).catch((e) => setError(e instanceof Error ? e.message : "Failed to load presets"));
    (async () => {
      if (draftId) {
        const inv = await getInvoice(draftId);
        setForm({
          invoiceId: inv.id, issueDate: inv.issue_date, customerId: inv.customer_id,
          newCustomer: null, jobEvent: inv.job_event, jobDate: inv.job_date,
          jobLocation: inv.job_location, lineItems: inv.line_items,
          discountType: inv.discount_type, discountValue: inv.discount_value,
        });
      } else if (duplicateId) {
        const inv = await getInvoice(duplicateId);
        setForm({
          ...emptyForm(), customerId: inv.customer_id, jobEvent: inv.job_event,
          jobDate: inv.job_date, jobLocation: inv.job_location,
          lineItems: inv.line_items, discountType: inv.discount_type,
          discountValue: inv.discount_value,
        });
      } else {
        setForm(loadForm() ?? emptyForm());
      }
    })().catch((e) => setError(e instanceof Error ? e.message : "Failed to load invoice"));
  }, [draftId, duplicateId]);

  // autosave locally on every change (not for DB drafts being resumed — those too, harmless)
  useEffect(() => { if (form) storeForm(form); }, [form]);

  const totals = useMemo(() => {
    if (!form) return { sub: 0, disc: 0, total: 0 };
    const sub = subtotalCents(form.lineItems);
    return {
      sub,
      disc: discountCents(sub, form.discountType, form.discountValue),
      total: totalCents(form.lineItems, form.discountType, form.discountValue),
    };
  }, [form]);

  if (!form) return <p className="p-6">{error ? <span className="text-red-600">{error}</span> : "Loading…"}</p>;
  const f = form;
  const set = (patch: Partial<FormState>) => setForm({ ...f, ...patch });

  async function persistDraft(): Promise<string> {
    let customerId = f.customerId;
    if (f.newCustomer && f.newCustomer.name.trim()) {
      const c = await createCustomer(f.newCustomer);
      customerId = c.id;
      setCustomers([...customers, c]);
      set({ customerId: c.id, newCustomer: null });
    }
    const inv = await saveInvoiceDraft({
      id: f.invoiceId, issue_date: f.issueDate, customer_id: customerId,
      job_event: f.jobEvent, job_date: f.jobDate, job_location: f.jobLocation,
      line_items: f.lineItems.filter((li) => li.description.trim() !== ""),
      discount_type: f.discountType, discount_value: f.discountValue,
    });
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
      await finalizeInvoice(id);
      clearForm();
      router.push(`/invoices/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to finalize invoice");
      setBusy("");
    }
  }

  const inputCls = "w-full border rounded-lg p-2";
  return (
    <main className="max-w-xl mx-auto p-4 space-y-5 text-sm">
      <h1 className="text-xl font-bold">{f.invoiceId ? "Edit draft" : "New invoice"}</h1>

      <section className="space-y-2">
        <h2 className="font-semibold">Customer</h2>
        <select className={inputCls} value={f.newCustomer ? "new" : f.customerId ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "new") set({ newCustomer: { name: "", phone: "", email: "", address: "" }, customerId: null });
            else set({ customerId: v ? Number(v) : null, newCustomer: null });
          }}>
          <option value="">— pick customer —</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name} (#{c.id})</option>)}
          <option value="new">+ New customer</option>
        </select>
        {f.newCustomer && (
          <div className="space-y-2 border rounded-lg p-3">
            {(["name", "phone", "email", "address"] as const).map((k) => (
              <input key={k} className={inputCls} placeholder={k[0].toUpperCase() + k.slice(1)}
                value={f.newCustomer![k]}
                onChange={(e) => set({ newCustomer: { ...f.newCustomer!, [k]: e.target.value } })} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Job</h2>
        <input className={inputCls} placeholder="Event name (e.g. Jordan Birthday Party Shoot)"
          value={f.jobEvent} onChange={(e) => set({ jobEvent: e.target.value })} />
        <input className={inputCls} placeholder="Event date & time (e.g. 20 June 2026, 7-9PM)"
          value={f.jobDate} onChange={(e) => set({ jobDate: e.target.value })} />
        <input className={inputCls} placeholder="Location"
          value={f.jobLocation} onChange={(e) => set({ jobLocation: e.target.value })} />
        <label className="block">
          <span className="text-gray-500">Invoice date</span>
          <input type="date" className={inputCls} value={f.issueDate}
            onChange={(e) => set({ issueDate: e.target.value })} />
        </label>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Line items</h2>
          {presets.length > 0 && (
            <select className="border rounded-lg p-2" value=""
              onChange={(e) => {
                const p = presets.find((x) => x.id === e.target.value);
                if (p) set({
                  lineItems: [...f.lineItems.filter((li) => li.description || li.unitPriceCents),
                    { description: `${p.name}${p.description ? `\n${p.description}` : ""}`,
                      qty: p.default_qty, unitPriceCents: p.unit_price_cents }],
                });
              }}>
              <option value="">+ preset</option>
              {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>
        {f.lineItems.map((li, i) => (
          <div key={i} className="border rounded-lg p-3 space-y-2">
            <textarea className={inputCls} rows={3} placeholder="Description (event, time, shoot type, location)"
              value={li.description}
              onChange={(e) => set({ lineItems: f.lineItems.map((x, j) => j === i ? { ...x, description: e.target.value } : x) })} />
            <div className="flex gap-2 items-center">
              <input className="w-20 border rounded p-2" inputMode="decimal" placeholder="Qty"
                value={li.qty || ""}
                onChange={(e) => set({ lineItems: f.lineItems.map((x, j) => j === i ? { ...x, qty: parseFloat(e.target.value) || 0 } : x) })} />
              <input className="flex-1 border rounded p-2" inputMode="decimal" placeholder="Unit price ($)"
                value={li.unitPriceCents ? li.unitPriceCents / 100 : ""}
                onChange={(e) => set({ lineItems: f.lineItems.map((x, j) => j === i ? { ...x, unitPriceCents: Math.round((parseFloat(e.target.value) || 0) * 100) } : x) })} />
              <span className="w-20 text-right">{formatSGD(Math.round(li.qty * li.unitPriceCents))}</span>
              <button className="text-red-600 px-1" onClick={() => set({ lineItems: f.lineItems.filter((_, j) => j !== i) })}>✕</button>
            </div>
          </div>
        ))}
        <button className="border rounded-lg px-3 py-2"
          onClick={() => set({ lineItems: [...f.lineItems, { description: "", qty: 1, unitPriceCents: 0 }] })}>
          + Add line
        </button>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Discount</h2>
        <div className="flex gap-2">
          <select className="border rounded-lg p-2" value={f.discountType}
            onChange={(e) => set({ discountType: e.target.value as FormState["discountType"] })}>
            <option value="none">None</option>
            <option value="amount">Amount ($)</option>
            <option value="percent">Percent (%)</option>
          </select>
          {f.discountType !== "none" && (
            <input className="flex-1 border rounded-lg p-2" inputMode="decimal"
              value={f.discountValue || ""}
              onChange={(e) => set({ discountValue: parseFloat(e.target.value) || 0 })} />
          )}
        </div>
      </section>

      <section className="border-t pt-3 space-y-1 text-right">
        <p>Subtotal: {formatSGD(totals.sub)}</p>
        {totals.disc > 0 && <p>Discount: −{formatSGD(totals.disc)}</p>}
        <p className="text-lg font-bold">Total due: {formatSGD(totals.total)}</p>
      </section>

      {error && <p className="text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onSaveDraft} disabled={busy !== ""} className="flex-1 border rounded-lg p-3 disabled:opacity-50">
          {busy === "draft" ? "Saving…" : "Save draft"}
        </button>
        <button onClick={onFinalize} disabled={busy !== "" || totals.total <= 0 || (!f.customerId && !f.newCustomer?.name.trim())}
          className="flex-1 rounded-lg bg-black text-white p-3 disabled:opacity-50">
          {busy === "final" ? "Finalizing…" : "Finalize invoice"}
        </button>
      </div>
    </main>
  );
}
