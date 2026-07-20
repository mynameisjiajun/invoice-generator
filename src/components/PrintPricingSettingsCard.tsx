"use client";
import { useEffect, useState } from "react";
import { getPricingSettings, savePricingSettings } from "@/lib/db";
import type { PrintMaterial, PrintPricingSettings } from "@/lib/types";
import { IconAdd, IconCheck, IconTrash } from "@/components/icons";

const DEFAULT_MATERIALS: PrintMaterial[] = [
  { name: "PLA Basic", density_g_cm3: 1.24, cost_per_gram_cents: 3 },
  { name: "PETG", density_g_cm3: 1.27, cost_per_gram_cents: 3 },
  { name: "PLA+ (Tough)", density_g_cm3: 1.24, cost_per_gram_cents: 4 },
  { name: "PLA Matte", density_g_cm3: 1.24, cost_per_gram_cents: 4 },
  { name: "PLA Galaxy", density_g_cm3: 1.24, cost_per_gram_cents: 5 },
  { name: "TPU", density_g_cm3: 1.21, cost_per_gram_cents: 6 },
];

function emptySettings(businessId: string): PrintPricingSettings {
  return {
    business_id: businessId,
    materials: DEFAULT_MATERIALS,
    print_speed_cm3_per_hour: 0,
    cost_per_hour_cents: 200,
    waste_percent: 0,
    multi_colour_time_surcharge_percent: 20,
    multi_colour_waste_percent: 0,
    minimum_price_cents: null,
    telegram_handle: "",
  };
}

export default function PrintPricingSettingsCard({ businessId }: { businessId: string }) {
  const [form, setForm] = useState<PrintPricingSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(null);
    getPricingSettings(businessId)
      .then((row) => setForm(row ?? emptySettings(businessId)))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load pricing settings"));
  }, [businessId]);

  if (!form) {
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-label">3D Print Pricing</div>
        <p style={{ color: "var(--text-tertiary)" }}>{error || "Loading…"}</p>
      </div>
    );
  }

  function updateMaterial(index: number, patch: Partial<PrintMaterial>) {
    setForm({ ...form!, materials: form!.materials.map((m, i) => (i === index ? { ...m, ...patch } : m)) });
  }

  function addMaterial() {
    setForm({ ...form!, materials: [...form!.materials, { name: "", density_g_cm3: 1.24, cost_per_gram_cents: 3 }] });
  }

  function removeMaterial(index: number) {
    setForm({ ...form!, materials: form!.materials.filter((_, i) => i !== index) });
  }

  async function onSave() {
    if (!form!.print_speed_cm3_per_hour || form!.print_speed_cm3_per_hour <= 0) {
      setError("Print speed (cm³/hour) is required — check a couple of real slices in Bambu Studio to calibrate this.");
      return;
    }
    if (form!.materials.length === 0 || form!.materials.some((m) => !m.name.trim())) {
      setError("Add at least one material, and give every material a name");
      return;
    }
    try {
      const result = await savePricingSettings(form!);
      setForm(result);
      setSaved(true);
      setError(null);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save pricing settings");
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="section-label">3D Print Pricing</div>

      {error && (
        <div style={{
          background: "var(--warning-bg)", color: "var(--warning)", padding: "10px 14px",
          borderRadius: "var(--radius-sm)", fontSize: "0.85rem", fontWeight: 600, marginBottom: 14,
        }}>{error}</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        {form.materials.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input className="input" placeholder="Material name" style={{ flex: 2 }}
              value={m.name} onChange={(e) => updateMaterial(i, { name: e.target.value })} />
            <input className="input" placeholder="Density g/cm³" inputMode="decimal" style={{ flex: 1 }}
              value={m.density_g_cm3} onChange={(e) => updateMaterial(i, { density_g_cm3: parseFloat(e.target.value) || 0 })} />
            <input className="input" placeholder="$/g" inputMode="decimal" style={{ flex: 1 }}
              value={(m.cost_per_gram_cents / 100).toFixed(2)}
              onChange={(e) => updateMaterial(i, { cost_per_gram_cents: Math.round((parseFloat(e.target.value) || 0) * 100) })} />
            <button onClick={() => removeMaterial(i)} className="btn-danger icon-btn" aria-label={`Remove ${m.name || "material"}`}>
              <IconTrash size={14} />
            </button>
          </div>
        ))}
        <button onClick={addMaterial} className="btn btn-secondary icon-btn" style={{ alignSelf: "flex-start" }}>
          <IconAdd size={15} /> Add Material
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div>
          <label className="input-label">Print speed (cm³/hour)</label>
          <input className="input" inputMode="decimal" value={form.print_speed_cm3_per_hour || ""}
            onChange={(e) => setForm({ ...form, print_speed_cm3_per_hour: parseFloat(e.target.value) || 0 })} />
        </div>
        <div>
          <label className="input-label">Cost per hour ($)</label>
          <input className="input" inputMode="decimal" value={(form.cost_per_hour_cents / 100).toFixed(2)}
            onChange={(e) => setForm({ ...form, cost_per_hour_cents: Math.round((parseFloat(e.target.value) || 0) * 100) })} />
        </div>
        <div>
          <label className="input-label">Waste % (all prints)</label>
          <input className="input" inputMode="decimal" value={form.waste_percent}
            onChange={(e) => setForm({ ...form, waste_percent: parseFloat(e.target.value) || 0 })} />
        </div>
        <div>
          <label className="input-label">Minimum price ($, optional)</label>
          <input className="input" inputMode="decimal" value={form.minimum_price_cents ? (form.minimum_price_cents / 100).toFixed(2) : ""}
            onChange={(e) => setForm({ ...form, minimum_price_cents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null })} />
        </div>
        <div>
          <label className="input-label">Multi-colour time surcharge %</label>
          <input className="input" inputMode="decimal" value={form.multi_colour_time_surcharge_percent}
            onChange={(e) => setForm({ ...form, multi_colour_time_surcharge_percent: parseFloat(e.target.value) || 0 })} />
        </div>
        <div>
          <label className="input-label">Multi-colour extra waste %</label>
          <input className="input" inputMode="decimal" value={form.multi_colour_waste_percent}
            onChange={(e) => setForm({ ...form, multi_colour_waste_percent: parseFloat(e.target.value) || 0 })} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="input-label">Telegram handle (for the &quot;Message me&quot; button)</label>
          <input className="input" placeholder="mynameisjiajun" value={form.telegram_handle}
            onChange={(e) => setForm({ ...form, telegram_handle: e.target.value.replace(/^@/, "") })} />
        </div>
      </div>

      <button onClick={onSave} className={`btn icon-btn ${saved ? "btn-accent" : "btn-primary"}`}>
        {saved && <IconCheck size={15} />} {saved ? "Saved" : "Save Pricing"}
      </button>
    </div>
  );
}
