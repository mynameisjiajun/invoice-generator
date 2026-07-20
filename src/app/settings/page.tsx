"use client";
import { useEffect, useRef, useState } from "react";
import { createBusiness, archiveBusiness, updateBusiness, listPresets, createPreset, deletePreset } from "@/lib/db";
import { useBusiness } from "@/lib/businessContext";
import { slugify } from "@/lib/slug";
import { formatSGD } from "@/lib/money";
import type { Business, Preset } from "@/lib/types";
import { IconAdd, IconCheck, IconTrash } from "@/components/icons";

const FIELDS: Array<{ key: keyof Business; label: string }> = [
  { key: "name", label: "Business name" },
  { key: "address", label: "Address" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "paynow_number", label: "PayNow number" },
  { key: "payee_name", label: "Payee name (for cheques)" },
  { key: "bank_details", label: "Bank details" },
];

export default function SettingsPage() {
  const { businesses, activeBusiness, setActiveBusinessId, reloadBusinesses } = useBusiness();
  const [form, setForm] = useState<Business | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [saved, setSaved] = useState(false);
  const [np, setNp] = useState({ name: "", description: "", price: "", qty: "1" });
  const [newBizName, setNewBizName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setForm(activeBusiness);
    if (activeBusiness) {
      listPresets(activeBusiness.id).then(setPresets).catch((e) => setError(e instanceof Error ? e.message : "Failed to load presets"));
    }
  }, [activeBusiness]);

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  if (!activeBusiness || !form) return (
    <div className="page-container">
      <p style={{ color: error ? "var(--warning)" : "var(--text-tertiary)" }}>
        {error || "Loading…"}
      </p>
    </div>
  );

  async function onSave() {
    try {
      await updateBusiness(form!.id, form!);
      await reloadBusinesses();
      setSaved(true);
      setError(null);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings");
    }
  }

  async function onAddBusiness() {
    if (!newBizName.trim()) return;
    try {
      const b = await createBusiness({ name: newBizName.trim(), slug: slugify(newBizName) });
      setNewBizName("");
      await reloadBusinesses();
      setActiveBusinessId(b.id);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add business");
    }
  }

  async function onArchiveBusiness(b: Business) {
    if (!confirm(`Archive "${b.name}"? Its invoices stay accessible, but it'll drop out of the switcher.`)) return;
    try {
      await archiveBusiness(b.id);
      await reloadBusinesses();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to archive business");
    }
  }

  async function onAddPreset() {
    const price = parseFloat(np.price || "0");
    const qty = parseFloat(np.qty || "1");
    if (Number.isNaN(price) || price < 0) {
      setError("Unit price must be a valid non-negative number");
      return;
    }
    if (Number.isNaN(qty) || qty <= 0) {
      setError("Quantity must be a valid positive number");
      return;
    }
    try {
      const p = await createPreset({
        name: np.name, description: np.description,
        unit_price_cents: Math.round(price * 100),
        default_qty: qty,
      }, activeBusiness!.id);
      setPresets([...presets, p]);
      setNp({ name: "", description: "", price: "", qty: "1" });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add preset");
    }
  }

  async function onDeletePreset(p: Preset) {
    if (!confirm(`Delete preset "${p.name}"?`)) return;
    try {
      await deletePreset(p.id);
      setPresets(presets.filter((x) => x.id !== p.id));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete preset");
    }
  }

  return (
    <main className="page-container animate-fade-in">
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">Manage your businesses, profile, and service presets</p>

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

      {/* Businesses */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-label">Businesses</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {businesses.filter((b) => !b.archived_at).map((b) => (
            <div key={b.id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: "var(--radius-md)",
              background: "var(--bg-primary)",
              border: b.id === activeBusiness.id ? "1px solid var(--accent)" : "1px solid var(--border-subtle)",
            }}>
              <span style={{ flex: 1, fontWeight: 600, fontSize: "0.9rem" }}>{b.name}</span>
              {b.id !== activeBusiness.id && (
                <button onClick={() => setActiveBusinessId(b.id)} className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: "0.78rem" }}>
                  Switch to
                </button>
              )}
              {businesses.filter((x) => !x.archived_at).length > 1 && (
                <button onClick={() => onArchiveBusiness(b)} className="btn-danger icon-btn" aria-label={`Archive ${b.name}`}>
                  <IconTrash size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="input" placeholder="New business name (e.g. 3D Printing)"
            value={newBizName} onChange={(e) => setNewBizName(e.target.value)} />
          <button onClick={onAddBusiness} disabled={!newBizName.trim()} className="btn btn-secondary icon-btn">
            <IconAdd size={15} /> Add
          </button>
        </div>
      </div>

      {/* Business info */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-label">Business Information — {activeBusiness.name}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label className="input-label">{label}</label>
              <input className="input"
                value={String(form[key] ?? "")}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            </div>
          ))}
        </div>
        <button onClick={onSave} className={`btn icon-btn ${saved ? "btn-accent" : "btn-primary"}`}
          style={{ marginTop: 16 }}>
          {saved && <IconCheck size={15} />} {saved ? "Saved" : "Save Settings"}
        </button>
      </div>

      {/* Service presets */}
      <div className="card">
        <div className="section-label">Service Presets — {activeBusiness.name}</div>

        {presets.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {presets.map((p) => (
              <div key={p.id} style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                borderRadius: "var(--radius-md)",
                background: "var(--bg-primary)",
                border: "1px solid var(--border-subtle)",
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{p.name}</div>
                  {p.description && (
                    <div style={{ color: "var(--text-tertiary)", fontSize: "0.8rem", marginTop: 2 }}>
                      {p.description}
                    </div>
                  )}
                </div>
                <div className="money" style={{ fontWeight: 700, fontSize: "0.9rem", whiteSpace: "nowrap" }}>
                  {formatSGD(p.unit_price_cents)}
                </div>
                <button onClick={() => onDeletePreset(p)} className="btn-danger icon-btn" aria-label={`Delete preset ${p.name}`}>
                  <IconTrash size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* New preset form */}
        <div style={{
          background: "var(--bg-primary)",
          border: "1px dashed var(--border-default)",
          borderRadius: "var(--radius-md)",
          padding: 16,
        }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12 }}>
            Add new preset
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input className="input" placeholder="Name (e.g. Photo & Video, no edit)"
              value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} />
            <input className="input" placeholder="Description (optional)"
              value={np.description} onChange={(e) => setNp({ ...np, description: e.target.value })} />
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label className="input-label">Unit price ($)</label>
                <input className="input" placeholder="0.00" inputMode="decimal"
                  value={np.price} onChange={(e) => setNp({ ...np, price: e.target.value })} />
              </div>
              <div style={{ width: 100 }}>
                <label className="input-label">Default qty</label>
                <input className="input" placeholder="1" inputMode="decimal"
                  value={np.qty} onChange={(e) => setNp({ ...np, qty: e.target.value })} />
              </div>
            </div>
            <button onClick={onAddPreset} disabled={!np.name || !np.price}
              className="btn btn-secondary icon-btn" style={{ alignSelf: "flex-start" }}>
              <IconAdd size={15} /> Add Preset
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
