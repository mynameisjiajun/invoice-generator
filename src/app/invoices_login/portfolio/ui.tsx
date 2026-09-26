"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { ProjectType } from "@/components/portfolio/projects";
import { IconAdd } from "@/components/icons";

const IMAGE_NAME = /\.(jpe?g|png|webp|avif|heic|heif)$/i;
const isImage = (f: File) => f.type.startsWith("image/") || IMAGE_NAME.test(f.name);

/** Splits dropped/picked files into images and the names of anything else. */
export function splitImages(list: FileList | File[] | null | undefined): { images: File[]; skipped: string[] } {
  const files = Array.from(list ?? []);
  return { images: files.filter(isImage), skipped: files.filter((f) => !isImage(f)).map((f) => f.name) };
}

const hasFiles = (e: DragEvent | React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");

/** True while files are being dragged anywhere over the window. With
 *  `onDrop`, a drop anywhere on the page is caught too — so missing the drop
 *  zone uploads instead of the browser opening the photo in a new tab. */
export function useWindowFileDrag(onDrop?: (files: FileList) => void, enabled = true): boolean {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const dropRef = useRef(onDrop);
  useEffect(() => { dropRef.current = onDrop; });

  useEffect(() => {
    if (!enabled) return;
    const enter = (e: DragEvent) => { if (hasFiles(e)) { depth.current++; setDragging(true); } };
    const leave = (e: DragEvent) => { if (hasFiles(e) && --depth.current <= 0) { depth.current = 0; setDragging(false); } };
    const over = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      // Always clear the drag state; only upload if a drop zone didn't
      // already handle this drop (it calls preventDefault first).
      const handled = e.defaultPrevented;
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      if (!handled && e.dataTransfer?.files.length) dropRef.current?.(e.dataTransfer.files);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, [enabled]);

  return enabled && dragging;
}

/** Dashed drop area that also opens the file picker when tapped. */
export function PhotoDropZone({ onFiles, disabled, status, multiple = true, highlight = false }: {
  onFiles: (files: FileList) => void;
  disabled?: boolean;
  status?: string | null;
  multiple?: boolean;
  highlight?: boolean;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const [over, setOver] = useState(false);
  const active = (over || highlight) && !disabled;

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={multiple ? "Add photos: drop them here or choose files" : "Change photo: drop it here or choose a file"}
      onClick={() => !disabled && input.current?.click()}
      onKeyDown={(e) => { if (!disabled && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); input.current?.click(); } }}
      onDragOver={(e) => { if (hasFiles(e)) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault(); // tells the page-wide catcher this drop is handled
        setOver(false);
        if (!disabled && e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
      }}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
        padding: "22px 16px", marginBottom: 12, textAlign: "center",
        border: `2px dashed ${active ? "var(--accent)" : "var(--border-default)"}`,
        borderRadius: "var(--radius-md)",
        background: active ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "var(--bg-surface)",
        color: active ? "var(--accent)" : "var(--text-secondary)",
        cursor: disabled ? "default" : "pointer", opacity: disabled && !status ? 0.6 : 1,
        transition: "border-color 0.15s ease, background 0.15s ease",
      }}
    >
      <input ref={input} type="file" accept="image/*" multiple={multiple} hidden
        onChange={(e) => { if (e.target.files?.length) onFiles(e.target.files); e.target.value = ""; }} />
      {status ? (
        <span style={{ fontWeight: 600 }}>{status}</span>
      ) : (
        <>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
            <IconAdd size={16} /> {active ? (multiple ? "Drop to upload" : "Drop to replace") : (multiple ? "Add photos" : "Change photo")}
          </span>
          <span style={{ fontSize: "0.78rem", color: "var(--text-tertiary)" }}>
            Drag {multiple ? "photos" : "a photo"} here, or tap to choose
          </span>
        </>
      )}
    </div>
  );
}

/** Full-page hint shown while files are dragged over the window. */
export function DropOverlay({ label }: { label: string }) {
  return (
    <div aria-hidden style={{
      position: "fixed", inset: 0, zIndex: 80, pointerEvents: "none",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "color-mix(in srgb, var(--bg-primary) 70%, transparent)",
      border: "3px dashed var(--accent)",
    }}>
      <div className="card" style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--accent)" }}>{label}</div>
    </div>
  );
}

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
