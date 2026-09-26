"use client";
import Image from "next/image";
import type { ProjectType } from "@/components/portfolio/projects";

export function TypePicker({ value, onChange }: { value: ProjectType; onChange: (t: ProjectType) => void }) {
  return (
    <div>
      <label className="input-label">Type</label>
      <div className="chip-row" style={{ paddingBottom: 0 }}>
        {(["photo", "video"] as const).map((t) => (
          <button key={t} type="button" onClick={() => onChange(t)}
            className={`chip ${value === t ? "chip-active" : ""}`}>
            {t === "photo" ? "Photo shoot" : "Video"}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Thumb({ src, alt, tall = false }: { src?: string; alt: string; tall?: boolean }) {
  const w = tall ? 54 : 84;
  const h = tall ? 72 : 56;
  return (
    <div style={{
      position: "relative", width: w, height: h, flexShrink: 0, overflow: "hidden",
      borderRadius: "var(--radius-sm)", background: "var(--bg-surface-hover)",
    }}>
      {src && <Image src={src} alt={alt} fill sizes="84px" style={{ objectFit: "cover" }} />}
    </div>
  );
}
