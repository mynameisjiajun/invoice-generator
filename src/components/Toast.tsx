"use client";
import { useEffect } from "react";

export default function Toast({ message, onUndo, onDismiss }:
  { message: string; onUndo?: () => void; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="toast" role="status">
      <span>{message}</span>
      {onUndo && <button className="toast-undo" onClick={() => { onUndo(); onDismiss(); }}>Undo</button>}
    </div>
  );
}
