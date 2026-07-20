"use client";
import { useState } from "react";
import { parseSTL, estimateQuote, type QuoteEstimate } from "@/lib/stlQuote";
import { submitPrintQuote, uploadPrintQuoteFile } from "@/lib/db";
import { formatSGD } from "@/lib/money";
import type { PrintPricingSettings } from "@/lib/types";
import { IconSend, IconWarning } from "@/components/icons";

const MAX_FILE_BYTES = 25 * 1024 * 1024;

type BusinessSummary = { id: string; name: string; slug: string };

export default function QuoteCalculator({ business, settings }: { business: BusinessSummary; settings: PrintPricingSettings }) {
  const [file, setFile] = useState<File | null>(null);
  const [volumeCm3, setVolumeCm3] = useState<number | null>(null);
  const [materialName, setMaterialName] = useState(settings.materials[0]?.name ?? "");
  const [multiColour, setMultiColour] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const material = settings.materials.find((m) => m.name === materialName) ?? null;
  const estimate: QuoteEstimate | null =
    volumeCm3 !== null && material ? estimateQuote(volumeCm3, material, multiColour, settings) : null;

  async function onFileChange(f: File | null) {
    setFile(f);
    setVolumeCm3(null);
    setSubmitted(false);
    setError(null);
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".stl")) {
      setError("Please upload a .stl file");
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setError("File is too large (max 25MB)");
      return;
    }
    setParsing(true);
    try {
      const buffer = await f.arrayBuffer();
      const { volumeCm3: v } = parseSTL(buffer);
      setVolumeCm3(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that STL file");
    } finally {
      setParsing(false);
    }
  }

  async function onMessageOnTelegram() {
    if (!file || !material || !estimate) return;
    try {
      const filePath = await uploadPrintQuoteFile(business.id, file);
      await submitPrintQuote({
        business_id: business.id,
        material: material.name,
        volume_cm3: estimate.volumeCm3,
        weight_g: estimate.weightG,
        estimated_hours: estimate.hours,
        price_cents: estimate.priceCents,
        file_path: filePath,
        multi_colour: multiColour,
        notes,
      });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your quote — you can still message us directly");
    }
    const summary =
      `Hi! I'd like a quote for a 3D print.\n` +
      `File: ${file.name}\n` +
      `Material: ${material.name}${multiColour ? " (multi-colour/AMS)" : ""}\n` +
      `Estimated weight: ${estimate.weightG.toFixed(1)}g, ~${estimate.hours.toFixed(1)}h\n` +
      `Estimated price: ${formatSGD(estimate.priceCents)}` +
      (notes ? `\nNotes: ${notes}` : "");
    const handle = settings.telegram_handle.replace(/^@/, "");
    window.open(`https://t.me/${handle}?text=${encodeURIComponent(summary)}`, "_blank");
  }

  return (
    <main className="page-container animate-fade-in">
      <h1 className="page-title">{business.name} — 3D Print Quote</h1>
      <p className="page-subtitle">Upload an STL to get an instant estimated price</p>

      <div className="card" style={{ marginBottom: 16 }}>
        <label className="input-label">STL file</label>
        <input className="input" type="file" accept=".stl"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)} />

        {error && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginTop: 12,
            background: "var(--warning-bg)", color: "var(--warning)", padding: "10px 14px",
            borderRadius: "var(--radius-sm)", fontSize: "0.85rem", fontWeight: 600,
          }}>
            <IconWarning size={15} /> {error}
          </div>
        )}

        {parsing && <p style={{ marginTop: 12, color: "var(--text-tertiary)" }}>Reading file…</p>}

        {volumeCm3 !== null && (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label className="input-label">Material</label>
              <select className="input" value={materialName} onChange={(e) => setMaterialName(e.target.value)}>
                {settings.materials.map((m) => (
                  <option key={m.name} value={m.name}>{m.name} — {formatSGD(m.cost_per_gram_cents)}/g</option>
                ))}
              </select>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem" }}>
              <input type="checkbox" checked={multiColour} onChange={(e) => setMultiColour(e.target.checked)} />
              Multi-colour print (AMS)
            </label>

            <div>
              <label className="input-label">Notes (optional — colour, quantity, etc.)</label>
              <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {estimate && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-label">Estimated Price</div>
          <div className="money" style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 8 }}>
            {formatSGD(estimate.priceCents)}
          </div>
          <p style={{ color: "var(--text-tertiary)", fontSize: "0.82rem", marginBottom: 14 }}>
            ~{estimate.weightG.toFixed(1)}g · ~{estimate.hours.toFixed(1)}h print time.
            This is an estimate only — {business.name} confirms the final price after actually slicing your file.
          </p>
          {submitted ? (
            <p style={{ color: "var(--success)", fontWeight: 600, fontSize: "0.85rem" }}>
              Saved! Continue the conversation on Telegram.
            </p>
          ) : (
            <button onClick={onMessageOnTelegram} className="btn btn-primary icon-btn" disabled={!settings.telegram_handle}>
              <IconSend size={15} /> Message on Telegram to Order
            </button>
          )}
        </div>
      )}
    </main>
  );
}
