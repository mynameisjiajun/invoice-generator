"use client";
import { useEffect } from "react";

export default function ConfirmSheet({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="sheet-backdrop" onClick={onCancel} role="dialog" aria-modal="true">
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-title">{title}</div>
        {message && <div className="sheet-message">{message}</div>}
        <div className="sheet-actions">
          <button
            className="btn btn-primary"
            style={danger ? { background: "var(--accent)", color: "#fff" } : undefined}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
