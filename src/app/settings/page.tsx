"use client";
import { useEffect, useRef, useState } from "react";
import { getSettings, saveSettings, listPresets, createPreset, deletePreset } from "@/lib/db";
import { formatSGD } from "@/lib/money";
import type { Preset, Settings } from "@/lib/types";

const FIELDS: Array<{ key: keyof Settings; label: string }> = [
  { key: "business_name", label: "Business name" },
  { key: "address", label: "Address" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "paynow_number", label: "PayNow number (e.g. +6596561716)" },
  { key: "payee_name", label: "Payee name (for cheques)" },
  { key: "bank_details", label: "Bank details" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [saved, setSaved] = useState(false);
  const [np, setNp] = useState({ name: "", description: "", price: "", qty: "1" });
  const [error, setError] = useState<string | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getSettings().then(setSettings).catch((e) => setError(e instanceof Error ? e.message : "Failed to load settings"));
    listPresets().then(setPresets).catch((e) => setError(e instanceof Error ? e.message : "Failed to load presets"));
  }, []);

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  if (!settings) return <p className="p-6">{error ? <span className="text-red-600">{error}</span> : "Loading…"}</p>;

  async function onSave() {
    try {
      await saveSettings(settings!);
      setSaved(true);
      setError(null);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings");
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
      });
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
    <main className="max-w-xl mx-auto p-4 space-y-6">
      <h1 className="text-xl font-bold">Settings</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <section className="space-y-3">
        {FIELDS.map(({ key, label }) => (
          <label key={key} className="block text-sm">
            <span className="text-gray-500">{label}</span>
            <input className="mt-1 w-full border rounded-lg p-2"
              value={String(settings[key] ?? "")}
              onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} />
          </label>
        ))}
        <button onClick={onSave} className="rounded-lg bg-black text-white px-4 py-2">
          {saved ? "Saved ✓" : "Save settings"}
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Service presets</h2>
        {presets.map((p) => (
          <div key={p.id} className="flex items-center gap-2 border rounded-lg p-3 text-sm">
            <div className="flex-1">
              <div className="font-medium">{p.name}</div>
              <div className="text-gray-500">{p.description}</div>
            </div>
            <div>{formatSGD(p.unit_price_cents)}</div>
            <button onClick={() => onDeletePreset(p)}
              className="text-red-600 px-2">Delete</button>
          </div>
        ))}
        <div className="border rounded-lg p-3 space-y-2 text-sm">
          <input className="w-full border rounded p-2" placeholder="Name (e.g. Photo & Video, no edit)"
            value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} />
          <input className="w-full border rounded p-2" placeholder="Description"
            value={np.description} onChange={(e) => setNp({ ...np, description: e.target.value })} />
          <div className="flex gap-2">
            <input className="flex-1 border rounded p-2" placeholder="Unit price ($)" inputMode="decimal"
              value={np.price} onChange={(e) => setNp({ ...np, price: e.target.value })} />
            <input className="w-24 border rounded p-2" placeholder="Qty" inputMode="decimal"
              value={np.qty} onChange={(e) => setNp({ ...np, qty: e.target.value })} />
          </div>
          <button onClick={onAddPreset} disabled={!np.name || !np.price}
            className="rounded-lg bg-black text-white px-4 py-2 disabled:opacity-50">Add preset</button>
        </div>
      </section>
    </main>
  );
}
