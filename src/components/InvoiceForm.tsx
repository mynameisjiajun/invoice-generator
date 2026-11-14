"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCustomer, finalizeInvoice, finalizeQuote, getInvoice, listCustomers, listInvoicesForCustomer, listPresets,
  saveInvoiceDraft,
} from "@/lib/db";
import {
  clearForm, defaultDueDays, emptyForm, followShootDate, loadForm, storeForm, type FormState,
} from "@/lib/formStorage";
import DepositField from "@/components/DepositField";
import { parseLooseDate } from "@/lib/calendar";
import ContractField from "@/components/ContractField";
import type { DocType } from "@/lib/types";
import { plusDaysIso, todayLocalIso } from "@/lib/date";
import { formatSgPhone } from "@/lib/phone";
import { discountCents, formatSGD, subtotalCents, totalCents } from "@/lib/money";
import { isPrintBusiness, type Customer, type Invoice, type Preset } from "@/lib/types";
import { EXPRESS_CENTS_PER_PLATE, emptyPrintSpec, formatJobDate } from "@/lib/printRates";
import { PrintLineItem, PrintProjectFields } from "@/components/PrintInvoiceFields";
import { RentalDetailsFields, RentalLineItem, RentalModeChips } from "@/components/RentalInvoiceFields";
import {
  fromRentalLines, newRentalLine, rentalDays, rentalPeriodError, syncRentalDays, toRentalLines,
} from "@/lib/rental";
import { IconClose } from "@/components/icons";
import NumberInput from "@/components/NumberInput";
import ConfirmSheet from "@/components/ConfirmSheet";
import Toast from "@/components/Toast";
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

/** Starting values for a brand-new invoice (e.g. from a website enquiry). */
export type InvoicePrefill = { customerId: number; jobEvent?: string; jobDate?: string };

export default function InvoiceForm({ duplicateId, draftId, prefill, docType: newDocType = "invoice" }: {
  duplicateId?: string; draftId?: string; prefill?: InvoicePrefill;
  /** For a brand-new form: invoice or quote. Drafts and duplicates take the
   *  type of the document they were loaded from. */
  docType?: DocType;
}) {
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
  // Whether the invoice being edited was saved as a rental — so switching it
  // back to a shoot still writes is_rental = false.
  const [loadedRental, setLoadedRental] = useState(false);
  // Same idea for the contract column (migration 024).
  const [loadedContract, setLoadedContract] = useState(false);
  const [loadedShootDate, setLoadedShootDate] = useState(false);
  const [confirmingFinalize, setConfirmingFinalize] = useState(false);
  // "Finalize & email": finalize, then send it straight from the invoice page.
  const [emailAfter, setEmailAfter] = useState(false);
  // The selected client's most recent invoice, for "Same as last time".
  const [lastJob, setLastJob] = useState<Invoice | null>(null);
  const [toast, setToast] = useState<string | null>(null);
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
    const key = draftId ?? duplicateId ?? (prefill ? `prefill:${prefill.customerId}:${newDocType}` : `new:${newDocType}`);
    if (loadedRef.current === key) return;
    if (!draftId && !duplicateId && !activeBusiness) return; // wait for a business
    loadedRef.current = key;
    (async () => {
      if (draftId) {
        const inv = await getInvoice(draftId);
        setFormBusinessId(inv.business_id);
        setLoadedStatus(inv.status);
        setLoadedNumber(inv.invoice_number);
        setLoadedRental(inv.is_rental === true);
        setLoadedContract(!!inv.contract);
        setLoadedShootDate(!!inv.shoot_date);
        setForm({
          invoiceId: inv.id, businessId: inv.business_id, issueDate: inv.issue_date,
          dueDate: inv.due_date ?? plusDaysIso(inv.issue_date, defaultDueDays(inv.doc_type)),
          // An existing invoice's dates are explicit, not defaults to roll forward.
          issueTouched: true, dueTouched: true,
          customerId: inv.customer_id,
          newCustomer: null, jobEvent: inv.job_event, jobDate: inv.job_date,
          jobLocation: inv.job_location, lineItems: inv.line_items,
          discountType: inv.discount_type, discountValue: inv.discount_value,
          isRental: inv.is_rental ?? false, rentalStart: inv.rental_start ?? "", rentalEnd: inv.rental_end ?? "",
          rentalTerms: inv.rental_terms !== false,
          docType: inv.doc_type ?? "invoice", depositPercent: inv.deposit_percent ?? 0,
          contract: inv.contract ?? null,
          shootDate: inv.shoot_date ?? "",
          // A draft with no date yet (e.g. just converted from a quote) gets today's.
          ...(inv.status === "draft" && !inv.shoot_date && !inv.job_date?.trim() && !inv.is_rental
            ? { shootDate: todayLocalIso(), jobDate: formatJobDate(todayLocalIso()) } : {}),
        });
      } else if (duplicateId) {
        const inv = await getInvoice(duplicateId);
        setFormBusinessId(inv.business_id);
        setForm({
          // A duplicate is a new job: its date starts as today, not the old one.
          ...emptyForm(inv.doc_type ?? "invoice"), businessId: inv.business_id, customerId: inv.customer_id, jobEvent: inv.job_event,
          jobLocation: inv.job_location,
          lineItems: inv.line_items, discountType: inv.discount_type,
          discountValue: inv.discount_value,
          // A duplicated rental keeps its gear list and period, ready to re-date.
          isRental: inv.is_rental ?? false, rentalStart: inv.rental_start ?? "", rentalEnd: inv.rental_end ?? "",
          rentalTerms: inv.rental_terms !== false,
          depositPercent: inv.deposit_percent ?? 0,
          contract: inv.contract ?? null,
        });
      } else {
        const bizId = activeBusiness!.id;
        setFormBusinessId(bizId);
        // A prefilled invoice starts fresh rather than restoring an unrelated autosaved form.
        const start = prefill
          ? (() => {
              // An enquiry's shoot date becomes the shoot date when readable.
              const base = { ...emptyForm(newDocType), businessId: bizId, customerId: prefill.customerId, jobEvent: prefill.jobEvent ?? "" };
              const day = parseLooseDate(prefill.jobDate);
              return day ? { ...base, ...followShootDate(base, day), shootTouched: true }
                : prefill.jobDate ? { ...base, jobDate: prefill.jobDate } : base;
            })()
          : loadForm(bizId, newDocType) ?? { ...emptyForm(newDocType), businessId: bizId };
        // A print shop's blank starter line opens as a print card.
        setForm(isPrintBusiness(activeBusiness) ? {
          ...start,
          lineItems: start.lineItems.map((li) =>
            !li.print && !li.description.trim() && !li.unitPriceCents ? { ...li, print: emptyPrintSpec() } : li),
        } : start);
      }
    })().catch((e) => {
      loadedRef.current = null; // let a retry re-attempt the failed load
      setError(e instanceof Error ? e.message : "Failed to load invoice");
    });
    // prefill is fixed per page visit (it comes from the URL), so it needn't be a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, duplicateId, activeBusiness]);

  useEffect(() => {
    if (!formBusinessId) return;
    listCustomers(formBusinessId).then(setCustomers).catch((e) => setError(e instanceof Error ? e.message : "Failed to load customers"));
    listPresets(formBusinessId).then(setPresets).catch((e) => setError(e instanceof Error ? e.message : "Failed to load presets"));
  }, [formBusinessId]);

  const pickedCustomer = form?.customerId ?? null;
  useEffect(() => {
    if (!pickedCustomer) return;
    listInvoicesForCustomer(pickedCustomer)
      .then((list) => setLastJob(list.find((i) => i.status !== "draft") ?? null))
      .catch(() => {});
  }, [pickedCustomer]);

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
  const isPrint = isPrintBusiness(formBusiness);
  // Equipment rental is a photo-business option (Apex Cinematics).
  const isRental = !isPrint && f.isRental === true;
  const docType: DocType = f.docType ?? "invoice";
  const isQuoteDoc = docType === "quote";
  // Deposits are for shoots: rentals are paid in full before collection.
  const showDeposit = !isPrint && !isRental;
  const depositPercent = showDeposit ? f.depositPercent ?? 0 : 0;
  const depositNow = Math.round((totals.total * depositPercent) / 100);
  const contract = showDeposit ? f.contract ?? null : null;
  const dueDays = defaultDueDays(docType);
  const periodDays = rentalDays(f.rentalStart, f.rentalEnd);

  // Rentals are paid before collection (T&C 2.1), so an untouched due date
  // follows the collection date; a hand-set due date is left alone.
  function rentalDue(start: string | undefined): Partial<FormState> {
    const day = (start ?? "").slice(0, 10);
    return !f.dueTouched && /^\d{4}-\d{2}-\d{2}$/.test(day) ? { dueDate: day } : {};
  }

  function setRental(on: boolean) {
    if (on) {
      // Dates only, defaulting to a 1-day hire from today.
      const start = f.rentalStart || todayLocalIso();
      const end = f.rentalEnd || plusDaysIso(start.slice(0, 10), 1);
      set({
        ...rentalDue(start),
        isRental: true,
        rentalStart: start,
        rentalEnd: end,
        lineItems: toRentalLines(f.lineItems, rentalDays(start, end) ?? 1),
        jobLocation: f.jobLocation.trim()
          ? f.jobLocation
          : formBusiness?.address ? `Self-collect & return: ${formBusiness.address}` : "",
      });
    } else {
      set({
        isRental: false,
        lineItems: fromRentalLines(f.lineItems),
        ...(f.dueTouched ? {} : { dueDate: plusDaysIso(f.issueDate, dueDays) }),
      });
    }
  }

  const linesBlank = f.lineItems.every((li) => !li.description.trim() && !li.unitPriceCents);
  const clientEmail = f.newCustomer?.email.trim()
    || customers.find((c) => c.id === f.customerId)?.email?.trim() || "";

  // Repeat client: copy their last job's items, pricing and terms; dates stay
  // as today (a rental keeps its length, starting today).
  function copyLastJob() {
    const j = lastJob!;
    const start = todayLocalIso();
    const rental = j.is_rental && !isPrint;
    const days = rental ? rentalDays(j.rental_start, j.rental_end) ?? 1 : 0;
    set({
      lineItems: j.line_items,
      discountType: j.discount_type, discountValue: j.discount_value,
      depositPercent: j.deposit_percent ?? 0,
      contract: j.contract ?? null,
      jobEvent: f.jobEvent.trim() ? f.jobEvent : j.job_event,
      jobLocation: f.jobLocation.trim() ? f.jobLocation : j.job_location,
      ...(rental ? {
        ...rentalDue(start), isRental: true, rentalStart: start,
        rentalEnd: plusDaysIso(start, days), rentalTerms: j.rental_terms !== false,
      } : {}),
    });
  }

  // A new collection/return time re-counts the days on every item still on
  // the old count; items whose days were changed by hand keep theirs.
  function setRentalDetails(patch: { jobEvent?: string; rentalStart?: string; rentalEnd?: string; jobLocation?: string }) {
    const start = patch.rentalStart ?? f.rentalStart ?? "";
    const end = patch.rentalEnd ?? f.rentalEnd ?? "";
    const next = rentalDays(start, end);
    const due = patch.rentalStart !== undefined ? rentalDue(patch.rentalStart) : {};
    set(next === null ? { ...patch, ...due } : { ...patch, ...due, lineItems: syncRentalDays(f.lineItems, periodDays ?? 1, next) });
  }
  // Functional updater: merges onto the latest state rather than the `f`
  // snapshot closed over at render time. persistDraft() below calls set()
  // twice across an await boundary (once after creating a new customer,
  // once after saving the draft) — merging onto a stale `f` would let the
  // second call silently undo the first, leaving newCustomer un-cleared and
  // risking a duplicate customer being created if the user retries after a
  // failure (e.g. a finalize that errors after the draft save).
  const set = (patch: Partial<FormState>) => setForm((prev) => (prev ? { ...prev, ...patch } : prev));

  // Fee lines are plain items (no print specs). Blank untouched lines are
  // dropped first so a fee doesn't land after an empty starter card; the
  // new line's price is focused so a blank fee can be typed straight in.
  function addFee(item: { description: string; qty: number; unitPriceCents: number }) {
    const kept = f.lineItems.filter((li) => li.description.trim() || li.unitPriceCents);
    set({ lineItems: [...kept, item] });
    requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>(`[aria-label="Unit price for line ${kept.length + 1}"]`)?.focus();
    });
  }

  /** `complete`: finalizing or editing a finalized invoice, where a rental
   *  must have its full period; a draft may be saved half-filled. */
  async function persistDraft(complete = false): Promise<string> {
    if (!formBusinessId) throw new Error("No business selected");
    if (isRental) {
      const problem = rentalPeriodError(f.rentalStart ?? "", f.rentalEnd ?? "", complete);
      if (problem) throw new Error(problem);
    }
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
      doc_type: docType,
      deposit_percent: depositPercent,
      // Only written when a contract is (or was) attached, so invoices keep
      // saving on a database without migration 024.
      ...(contract || loadedContract ? { contract } : {}),
      // Shoot date (migration 025): only sent once one is set.
      ...(f.shootDate ? { shoot_date: f.shootDate } : loadedShootDate ? { shoot_date: null } : {}),
      // Rental columns are only written when they matter, so ordinary
      // invoices keep saving even on a database without migration 020.
      ...(isRental || loadedRental ? {
        is_rental: isRental,
        rental_start: isRental ? f.rentalStart ?? "" : "",
        rental_end: isRental ? f.rentalEnd ?? "" : "",
        rental_terms: f.rentalTerms !== false,
      } : {}),
    }, formBusinessId);
    if (!f.invoiceId) set({ invoiceId: inv.id });
    return inv.id;
  }

  async function onSaveDraft() {
    setBusy("draft"); setError(null);
    try {
      await persistDraft();
      // Nothing else on screen changes when a draft saves — without this the
      // only feedback is the button label flicking back from "Saving…", which
      // is indistinguishable from nothing having happened.
      setToast("Draft saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save draft");
    }
    setBusy("");
  }

  async function onFinalize() {
    setConfirmingFinalize(false);
    setBusy("final"); setError(null);
    try {
      const id = await persistDraft(true);
      // persistDraft() throws before this point if formBusinessId is null.
      if (isQuoteDoc) await finalizeQuote(id);
      else await finalizeInvoice(id, formBusinessId!);
      clearForm(docType);
      // email=1: the invoice page sends it as soon as it opens.
      router.push(`/invoices_login/invoices/${id}?just=1${emailAfter ? "&email=1" : ""}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to finalize invoice");
      setBusy("");
    }
  }

  async function onSaveChanges() {
    setBusy("final"); setError(null);
    try {
      const id = await persistDraft(true);
      router.push(`/invoices_login/invoices/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save changes");
      setBusy("");
    }
  }

  const editingFinalized = loadedStatus !== "draft";
  // Who the invoice is for, whether they're an existing client or one being
  // created alongside this invoice.
  const customerLabel =
    f.newCustomer?.name.trim() ||
    customers.find((c) => c.id === f.customerId)?.name ||
    "No client";

  return (
    <main className="page-container animate-fade-in">
      <h1 className="page-title">
        {editingFinalized ? `Edit ${loadedNumber}` : f.invoiceId ? (isQuoteDoc ? "Edit Quote Draft" : "Edit Draft") : isQuoteDoc ? "New Quote" : "New Invoice"}
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
        {!f.newCustomer && lastJob && lastJob.customer_id === f.customerId && linesBlank && (
          <button type="button" className="btn btn-secondary" style={{ width: "100%", marginTop: 10, fontSize: "0.85rem" }}
            onClick={copyLastJob}>
            ↺ Same as last time: {lastJob.job_event || lastJob.invoice_number} · {formatSGD(lastJob.total_cents)}
          </button>
        )}
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
        <div className="section-label">{isPrint ? "Project" : isRental ? "Rental" : "Job Details"}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {!isPrint && <RentalModeChips isRental={isRental} onChange={setRental} />}
          {isPrint ? (
            <PrintProjectFields project={f.jobEvent} readyBy={f.jobDate} location={f.jobLocation}
              customerAddress={f.newCustomer?.address ?? customers.find((c) => c.id === f.customerId)?.address ?? ""}
              onChange={set} />
          ) : isRental ? (
            <RentalDetailsFields project={f.jobEvent} start={f.rentalStart ?? ""} end={f.rentalEnd ?? ""}
              location={f.jobLocation} attachTerms={f.rentalTerms !== false}
              onChange={setRentalDetails} onAttachTermsChange={(on) => set({ rentalTerms: on })} />
          ) : (<>
          <div>
            <label className="input-label">Event name</label>
            <input className="input" placeholder="e.g. Jordan Birthday Party Shoot"
              value={f.jobEvent} onChange={(e) => set({ jobEvent: e.target.value })} />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "0 0 160px" }}>
              <label className="input-label">Shoot date</label>
              {/* Puts the job on the calendar; fills the printed line if it's empty. */}
              <input type="date" className="input" aria-label="Shoot date" value={f.shootDate ?? ""}
                onChange={(e) => set({ ...followShootDate(f, e.target.value), shootTouched: true })} />
            </div>
            <div style={{ flex: "1 1 180px" }}>
              <label className="input-label">Date on invoice</label>
              <input className="input" placeholder="e.g. 20 Jun 2026"
                value={f.jobDate} onChange={(e) => set({ jobDate: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="input-label">Location</label>
            <input className="input" placeholder="e.g. Marina Bay Sands"
              value={f.jobLocation} onChange={(e) => set({ jobLocation: e.target.value })} />
          </div>
          </>)}
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="input-label">Invoice date</label>
              <input type="date" className="input" value={f.issueDate}
                onChange={(e) => {
                  const issueDate = e.target.value;
                  set({
                    issueDate,
                    issueTouched: true,
                    dueDate: f.dueTouched ? f.dueDate : plusDaysIso(issueDate, dueDays),
                  });
                }} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="input-label">{isQuoteDoc ? "Valid until" : "Due date"}</label>
              <input type="date" className="input" value={f.dueDate}
                onChange={(e) => set({ dueDate: e.target.value, dueTouched: true })} />
            </div>
          </div>
        </div>
      </div>
      </div>

      <div>
      {/* Line items */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div className="section-label" style={{ marginBottom: 0 }}>{isPrint ? "Prints" : isRental ? "Equipment" : "Line Items"}</div>
        </div>
        {/* Saved services / gear as one-tap buttons. */}
        {presets.length > 0 && (
          <div className="chip-row" style={{ paddingBottom: 0, marginBottom: 12 }} role="group" aria-label="Add a saved item">
            {presets.map((p) => (
              <button key={p.id} type="button" className="chip"
                onClick={() => set({
                  lineItems: [...f.lineItems.filter((li) => li.description || li.unitPriceCents),
                    { description: `${p.name}${p.description ? `\n${p.description}` : ""}`,
                      qty: p.default_qty, unitPriceCents: p.unit_price_cents,
                      // In a rental the preset's price is that item's day rate.
                      ...(isRental ? { rental: {
                        days: periodDays ?? 1,
                        ...(p.replacement_cents ? { replacementCents: p.replacement_cents } : {}),
                      } } : {}) }],
                })}>
                + {p.name}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {f.lineItems.map((li, i) => isPrint && li.print ? (
            <PrintLineItem key={i} item={li} index={i}
              onChange={(item) => set({ lineItems: f.lineItems.map((x, j) => j === i ? item : x) })}
              onRemove={() => set({ lineItems: f.lineItems.filter((_, j) => j !== i) })} />
          ) : isRental && li.rental ? (
            <RentalLineItem key={i} item={li} index={i}
              onChange={(item) => set({ lineItems: f.lineItems.map((x, j) => j === i ? item : x) })}
              onRemove={() => set({ lineItems: f.lineItems.filter((_, j) => j !== i) })} />
          ) : (
            <div key={i} style={{
              background: "var(--bg-primary)",
              borderRadius: "var(--radius-md)",
              padding: 14,
              border: "1px solid var(--border-subtle)",
            }}>
              <textarea className="input" rows={2}
                placeholder={isPrint ? "Description" : "Description (event, time, shoot type, location)"}
                style={{ marginBottom: 10, minHeight: 60 }}
                value={li.description}
                onChange={(e) => set({ lineItems: f.lineItems.map((x, j) => j === i ? { ...x, description: e.target.value } : x) })} />
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ width: 72 }}>
                  <label className="input-label">Qty</label>
                  <NumberInput placeholder="1"
                    aria-label={`Quantity for line ${i + 1}`}
                    style={{ textAlign: "center" }}
                    value={li.qty}
                    onValueChange={(n) => set({ lineItems: f.lineItems.map((x, j) => j === i ? { ...x, qty: n } : x) })} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="input-label">Unit price ($)</label>
                  <NumberInput placeholder="0.00"
                    aria-label={`Unit price for line ${i + 1}`}
                    value={li.unitPriceCents / 100}
                    onValueChange={(n) => set({ lineItems: f.lineItems.map((x, j) => j === i ? { ...x, unitPriceCents: Math.round(n * 100) } : x) })} />
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

        {isPrint ? (
          <>
            <button className="btn btn-ghost" style={{ marginTop: 12, width: "100%" }}
              onClick={() => set({ lineItems: [...f.lineItems, { description: "", qty: 1, unitPriceCents: 0, print: emptyPrintSpec() }] })}>
              + Add print
            </button>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn btn-ghost" style={{ flex: 1, fontSize: "0.8rem" }}
                onClick={() => addFee({ description: "Design / modelling", qty: 1, unitPriceCents: 0 })}>
                + Design fee
              </button>
              <button className="btn btn-ghost" style={{ flex: 1, fontSize: "0.8rem" }}
                onClick={() => addFee({ description: "Express (1–2 days), per build plate", qty: 1, unitPriceCents: EXPRESS_CENTS_PER_PLATE })}>
                + Express
              </button>
            </div>
          </>
        ) : isRental ? (
          <>
            <button className="btn btn-ghost" style={{ marginTop: 12, width: "100%" }}
              onClick={() => set({ lineItems: [...f.lineItems, newRentalLine(periodDays ?? 1)] })}>
              + Add item
            </button>
            <button className="btn btn-ghost" style={{ marginTop: 8, width: "100%", fontSize: "0.8rem" }}
              onClick={() => addFee({ description: "Delivery & collection", qty: 1, unitPriceCents: 0 })}>
              + Delivery or other fee
            </button>
          </>
        ) : (
        <button className="btn btn-ghost" style={{ marginTop: 12, width: "100%" }}
          onClick={() => set({ lineItems: [...f.lineItems, { description: "", qty: 1, unitPriceCents: 0 }] })}>
          + Add line item
        </button>
        )}
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
            <NumberInput placeholder={f.discountType === "amount" ? "0.00" : "10"}
              aria-label={f.discountType === "amount" ? "Discount amount in dollars" : "Discount percentage"}
              style={{ flex: 1 }}
              value={f.discountValue}
              onValueChange={(n) => set({ discountValue: n })} />
          )}
        </div>
      </div>

      {showDeposit && (
        <DepositField percent={depositPercent} totalCents={totals.total}
          onChange={(p) => set({ depositPercent: p })} />
      )}
      {showDeposit && (
        <ContractField contract={contract} depositPercent={depositPercent}
          onChange={(c) => set({ contract: c })} />
      )}

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
          <span>{isQuoteDoc ? "Total" : "Total Due"}</span>
          <span>{formatSGD(totals.total)}</span>
        </div>
        {depositPercent > 0 && depositPercent < 100 && totals.total > 0 && (
          <div className="total-row" style={{ marginTop: 6 }}>
            <span>Deposit now ({depositPercent}%)</span>
            <span className="money" style={{ fontWeight: 600 }}>{formatSGD(depositNow)}</span>
          </div>
        )}
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
              This will be {isQuoteDoc ? "quote" : "invoice"}{" "}
              <span className="money" style={{ fontWeight: 600 }}>
                {isQuoteDoc ? `Q-${formBusiness.next_quote_seq ?? 1}` : `${formBusiness.invoice_prefix}${formBusiness.next_invoice_seq}`}
              </span>.
            </p>
          )}
          <div style={{ display: "flex", gap: 10, width: "100%" }}>
          <button onClick={onSaveDraft} disabled={busy !== ""} className="btn btn-secondary" style={{ flex: 1 }}>
            {busy === "draft" ? "Saving…" : "Save Draft"}
          </button>
          <button onClick={() => { setEmailAfter(false); setConfirmingFinalize(true); }}
            disabled={busy !== "" || totals.total <= 0 || (!f.customerId && !f.newCustomer?.name.trim())}
            className="btn btn-primary" style={{ flex: 1 }}>
            {busy === "final" ? (isQuoteDoc ? "Issuing…" : "Finalizing…") : isQuoteDoc ? "Issue Quote" : "Finalize Invoice"}
          </button>
          </div>
          {clientEmail && (
            <button onClick={() => { setEmailAfter(true); setConfirmingFinalize(true); }}
              disabled={busy !== "" || totals.total <= 0}
              className="btn btn-accent" style={{ width: "100%", marginTop: 10 }}>
              {isQuoteDoc ? "Issue & email quote" : "Finalize & email"} to {clientEmail}
            </button>
          )}
        </div>
      )}
      <ConfirmSheet
        open={confirmingFinalize}
        title={emailAfter
          ? `${isQuoteDoc ? "Issue" : "Finalize"} and email to ${clientEmail}?`
          : isQuoteDoc ? "Issue this quote?" : "Finalize this invoice?"}
        message={
          `${customerLabel} · ${formBusiness ? (isQuoteDoc ? `Q-${formBusiness.next_quote_seq ?? 1}` : `${formBusiness.invoice_prefix}${formBusiness.next_invoice_seq}`) : "next number"} · ${formatSGD(totals.total)}` +
          (isQuoteDoc
            ? "\n\nThis gives the quote its number so you can send it. You can still turn it into an invoice later."
            : "\n\nThis assigns the invoice number and locks it in. Check the total reads what you expect.")
        }
        confirmLabel={emailAfter ? (isQuoteDoc ? "Issue & email" : "Finalize & email") : isQuoteDoc ? "Issue quote" : "Finalize"}
        onConfirm={onFinalize}
        onCancel={() => setConfirmingFinalize(false)}
      />

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </main>
  );
}
