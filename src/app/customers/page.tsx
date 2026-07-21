"use client";
import { useEffect, useState } from "react";
import { useBusiness } from "@/lib/businessContext";
import { createCustomer, listCustomers, updateCustomer, updateCustomerNumber } from "@/lib/db";
import { formatSgPhone } from "@/lib/phone";
import type { Customer } from "@/lib/types";
import { IconAdd, IconCheck, IconEdit } from "@/components/icons";

type Draft = {
  number: string; name: string; company: string; phone: string; email: string; uen: string; address: string;
};

const emptyDraft = (): Draft => ({ number: "", name: "", company: "", phone: "", email: "", uen: "", address: "" });

const draftFrom = (c: Customer): Draft => ({
  number: String(c.id), name: c.name, company: c.company, phone: c.phone,
  email: c.email, uen: c.uen, address: c.address,
});

/** Contact fields shared by the add and edit forms, in the order:
 *  client no. + name, company, phone, email, UEN, address. */
function ClientFields({ draft, set, numberPlaceholder }: {
  draft: Draft; set: (patch: Partial<Draft>) => void; numberPlaceholder?: string;
}) {
  return (
    <>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ width: 110 }}>
          <label className="input-label">Client no.</label>
          <input className="input" inputMode="numeric" placeholder={numberPlaceholder}
            value={draft.number}
            onChange={(e) => set({ number: e.target.value.replace(/[^0-9]/g, "") })} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="input-label">Name</label>
          <input className="input" value={draft.name} onChange={(e) => set({ name: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="input-label">Company name (optional)</label>
        <input className="input" value={draft.company} onChange={(e) => set({ company: e.target.value })} />
      </div>
      <div>
        <label className="input-label">Phone</label>
        <input className="input" type="tel" placeholder="+65 9123 4567"
          value={draft.phone} onChange={(e) => set({ phone: e.target.value })} />
      </div>
      <div>
        <label className="input-label">Email</label>
        <input className="input" type="email" value={draft.email} onChange={(e) => set({ email: e.target.value })} />
      </div>
      <div>
        <label className="input-label">UEN (optional)</label>
        <input className="input" value={draft.uen} onChange={(e) => set({ uen: e.target.value })} />
      </div>
      <div>
        <label className="input-label">Address (optional)</label>
        <input className="input" value={draft.address} onChange={(e) => set({ address: e.target.value })} />
      </div>
    </>
  );
}

/** Name, phone, and email are required; returns an error message or null. */
function validateDraft(draft: Draft): string | null {
  if (!draft.name.trim()) return "Name is required";
  if (!draft.phone.trim()) return "Phone is required";
  if (!draft.email.trim()) return "Email is required";
  return null;
}

function draftToPatch(draft: Draft) {
  return {
    name: draft.name.trim(),
    company: draft.company.trim(),
    phone: formatSgPhone(draft.phone),
    email: draft.email.trim(),
    uen: draft.uen.trim(),
    address: draft.address.trim(),
  };
}

export default function CustomersPage() {
  const { activeBusiness } = useBusiness();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [adding, setAdding] = useState(false);
  const [newDraft, setNewDraft] = useState<Draft>(emptyDraft());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    if (!activeBusiness) return;
    listCustomers(activeBusiness.id)
      .then(setCustomers)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load customers"));
  }

  useEffect(() => {
    setCustomers([]);
    setEditingId(null);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusiness]);

  function startEdit(c: Customer) {
    setError(null);
    setEditingId(c.id);
    setDraft(draftFrom(c));
  }

  async function onSave(c: Customer) {
    if (!draft) return;
    const invalid = validateDraft(draft);
    if (invalid) {
      setError(invalid);
      return;
    }
    const newNumber = parseInt(draft.number, 10);
    if (!Number.isInteger(newNumber) || newNumber <= 0) {
      setError("Client number must be a positive whole number");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Change the client number first (cascades to invoices); if it's
      // taken this throws before we touch anything else.
      if (newNumber !== c.id) {
        await updateCustomerNumber(c.id, newNumber);
      }
      await updateCustomer(newNumber, draftToPatch(draft));
      setEditingId(null);
      setDraft(null);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save customer");
    }
    setBusy(false);
  }

  async function onAddClient() {
    const invalid = validateDraft(newDraft);
    if (invalid) {
      setError(invalid);
      return;
    }
    let id: number | undefined;
    if (newDraft.number.trim()) {
      const n = parseInt(newDraft.number, 10);
      if (!Number.isInteger(n) || n <= 0) {
        setError("Client number must be a positive whole number (or leave it blank to auto-assign)");
        return;
      }
      id = n;
    }
    setBusy(true);
    setError(null);
    try {
      await createCustomer({ id, ...draftToPatch(newDraft) }, activeBusiness!.id);
      setNewDraft(emptyDraft());
      setAdding(false);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add client");
    }
    setBusy(false);
  }

  if (!activeBusiness) {
    return (
      <div className="page-container">
        <div className="skeleton" style={{ height: 36, width: "40%", marginBottom: 10 }} />
        <div className="skeleton" style={{ height: 18, width: "70%", marginBottom: 24 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 74 }} />)}
        </div>
      </div>
    );
  }

  return (
    <main className="page-container animate-fade-in">
      <h1 className="page-title">Clients</h1>
      <p className="page-subtitle">Add or edit clients and their client numbers for {activeBusiness.name}</p>

      {error && (
        <div style={{
          background: "var(--warning-bg)", color: "var(--warning)", padding: "10px 14px",
          borderRadius: "var(--radius-sm)", fontSize: "0.85rem", fontWeight: 600, marginBottom: 16,
        }}>{error}</div>
      )}

      {/* Add client */}
      {adding ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-label">Add client</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <ClientFields draft={newDraft} numberPlaceholder="auto"
              set={(patch) => setNewDraft({ ...newDraft, ...patch })} />
            <p style={{ color: "var(--text-tertiary)", fontSize: "0.78rem" }}>
              Leave the client number blank to auto-assign the next one, or set it
              to import an existing client (e.g. an older client numbered 1–8).
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button onClick={() => { setAdding(false); setNewDraft(emptyDraft()); setError(null); }}
                disabled={busy} className="btn btn-secondary" style={{ flex: 1 }}>
                Cancel
              </button>
              <button onClick={onAddClient} disabled={busy} className="btn btn-primary icon-btn" style={{ flex: 1 }}>
                <IconCheck size={15} /> {busy ? "Adding…" : "Add client"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => { setAdding(true); setError(null); }}
          className="btn btn-secondary icon-btn" style={{ marginBottom: 16 }}>
          <IconAdd size={15} /> Add client
        </button>
      )}

      {customers.length === 0 && !adding && <p style={{ color: "var(--text-tertiary)" }}>No clients yet. Tap “Add client” to create one.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {customers.map((c) => (
          <div key={c.id} className="card">
            {editingId === c.id && draft ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <ClientFields draft={draft} set={(patch) => setDraft({ ...draft, ...patch })} />
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button onClick={() => { setEditingId(null); setDraft(null); setError(null); }}
                    disabled={busy} className="btn btn-secondary" style={{ flex: 1 }}>
                    Cancel
                  </button>
                  <button onClick={() => onSave(c)} disabled={busy} className="btn btn-primary icon-btn" style={{ flex: 1 }}>
                    <IconCheck size={15} /> {busy ? "Saving…" : "Save"}
                  </button>
                </div>
                {newNumberChanged(draft, c) && (
                  <p style={{ color: "var(--text-tertiary)", fontSize: "0.78rem" }}>
                    Changing the client number will update it on this client&apos;s existing invoices too.
                  </p>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>
                    {c.name} <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>#{c.id}</span>
                  </div>
                  {c.company && (
                    <div style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginTop: 1 }}>{c.company}</div>
                  )}
                  <div style={{ color: "var(--text-tertiary)", fontSize: "0.8rem", marginTop: 2 }}>
                    {[c.phone, c.email, c.uen && `UEN ${c.uen}`, c.address].filter(Boolean).join(" · ") || "No contact details"}
                  </div>
                </div>
                <button onClick={() => startEdit(c)} className="btn btn-secondary icon-btn" style={{ flexShrink: 0 }}>
                  <IconEdit size={14} /> Edit
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}

function newNumberChanged(draft: Draft, c: Customer): boolean {
  const n = parseInt(draft.number, 10);
  return Number.isInteger(n) && n !== c.id;
}
