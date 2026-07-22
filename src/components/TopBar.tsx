"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useBusiness } from "@/lib/businessContext";
import { IconCamera, IconCheck, IconChevronDown } from "@/components/icons";

export default function TopBar() {
  const pathname = usePathname();
  const { businesses, activeBusiness, setActiveBusinessId } = useBusiness();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  if (pathname === "/invoices_login") return null;

  const active = businesses.filter((b) => !b.archived_at);
  const canSwitch = active.length > 1;

  return (
    <>
      <header className="app-bar">
        <button
          className="app-bar-brand"
          onClick={() => canSwitch && setSwitcherOpen(true)}
          aria-label={canSwitch ? "Switch business" : undefined}
          style={{ cursor: canSwitch ? "pointer" : "default" }}
        >
          <IconCamera size={19} />
          <span>{activeBusiness?.name ?? "…"}</span>
          {canSwitch && <IconChevronDown size={15} className="app-bar-caret" />}
        </button>
      </header>

      {switcherOpen && (
        <div className="sheet-backdrop" onClick={() => setSwitcherOpen(false)} role="dialog" aria-modal="true">
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-title">Switch business</div>
            <div className="sheet-actions">
              {active.map((b) => (
                <button
                  key={b.id}
                  className={`sheet-option ${b.id === activeBusiness?.id ? "sheet-option--active" : ""}`}
                  onClick={() => { setActiveBusinessId(b.id); setSwitcherOpen(false); }}
                >
                  <span>{b.name}</span>
                  {b.id === activeBusiness?.id && <IconCheck size={16} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
