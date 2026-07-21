"use client";
import { useEffect, useState } from "react";
import { useBusiness } from "@/lib/businessContext";
import { listCustomers, updateCustomer, updateCustomerNumber } from "@/lib/db";
import type { Customer } from "@/lib/types";
import { IconCheck, IconEdit } from "@/components/icons";

type Draft = { name: string; phone: string; email: string; address: string; number: string };

export default function CustomersPage() {
  const { activeBusiness } = useBusiness();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
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
    setDraft({ name: c.name, phone: c.phone, email: c.email, address: c.address, number: String(c.id) });
  }

  async function onSave(c: Customer) {
    if (!draft) return;
    if (!draft.name.trim()) {
      setError("Name can't be empty");
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
      await updateCustomer(newNumber, {
        name: draft.name.trim(),
        phone: draft.phone.trim(),
        email: draft.email.trim(),
        address: draft.address.trim(),
      });
      setEditingId(null);
      setDraft(null);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save customer");
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
      <p className="page-subtitle">Edit contact details and client numbers for {activeBusiness.name}</p>

      {error && (
        <div style={{
          background: "var(--warning-bg)", color: "var(--warning)", padding: "10px 14px",
          borderRadius: "var(--radius-sm)", fontSize: "0.85rem", fontWeight: 600, marginBottom: 16,
        }}>{error}</div>
      )}

      {customers.length === 0 && <p style={{ color: "var(--text-tertiary)" }}>No clients yet. Add one when you create an invoice.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {customers.map((c) => (
          <div key={c.id} className="card">
            {editingId === c.id && draft ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ width: 110 }}>
                    <label className="input-label">Client no.</label>
                    <input className="input" inputMode="numeric" value={draft.number}
                      onChange={(e) => setDraft({ ...draft, number: e.target.value.replace(/[^0-9]/g, "") })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="input-label">Name</label>
                    <input className="input" value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="input-label">Phone</label>
                  <input className="input" type="tel" value={draft.phone}
                    onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
                </div>
                <div>
                  <label className="input-label">Email</label>
                  <input className="input" type="email" value={draft.email}
                    onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
                </div>
                <div>
                  <label className="input-label">Address</label>
                  <input className="input" value={draft.address}
                    onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
                </div>
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
                  <div style={{ color: "var(--text-tertiary)", fontSize: "0.8rem", marginTop: 2 }}>
                    {[c.phone, c.email, c.address].filter(Boolean).join(" · ") || "No contact details"}
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
