"use client";
import { useState } from "react";
import Link from "next/link";
import type { AttentionItem } from "@/lib/attention";

const SHOWN = 4;

/** Top-of-list "Needs attention": what to chase today. Hidden when empty. */
export default function AttentionList({ items }: { items: AttentionItem[] }) {
  const [all, setAll] = useState(false);
  if (items.length === 0) return null;
  const shown = all ? items : items.slice(0, SHOWN);
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="section-label">Needs attention · {items.length}</div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {shown.map((it) => (
          <Link key={it.key} href={it.href} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "9px 0",
            borderTop: "1px solid var(--border-subtle)", textDecoration: "none", color: "inherit",
          }}>
            <span aria-hidden style={{
              width: 8, height: 8, borderRadius: 999, flex: "0 0 auto",
              background: it.tone === "warn" ? "var(--warning)" : "var(--text-tertiary)",
            }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 600, fontSize: "0.88rem" }}>{it.title}</span>
              <span style={{ display: "block", color: "var(--text-tertiary)", fontSize: "0.78rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {it.detail}
              </span>
            </span>
            <span aria-hidden style={{ color: "var(--text-tertiary)" }}>›</span>
          </Link>
        ))}
      </div>
      {items.length > SHOWN && (
        <button className="btn btn-ghost" style={{ width: "100%", marginTop: 6, fontSize: "0.8rem" }}
          onClick={() => setAll(!all)}>
          {all ? "Show less" : `Show all ${items.length}`}
        </button>
      )}
    </div>
  );
}
