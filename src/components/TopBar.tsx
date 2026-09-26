"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBusiness } from "@/lib/businessContext";
import { IconCamera, IconCheck, IconChevronDown, IconGlobe, IconInbox } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

export default function TopBar() {
  const pathname = usePathname();
  const { businesses, activeBusiness, setActiveBusinessId } = useBusiness();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [newEnquiries, setNewEnquiries] = useState(0);

  // Re-count on navigation so the badge clears after visiting the inbox.
  useEffect(() => {
    if (pathname === "/invoices_login") return;
    createClient().from("enquiries").select("id", { count: "exact", head: true }).eq("status", "new")
      .then(({ count }) => setNewEnquiries(count ?? 0));
  }, [pathname]);

  if (pathname === "/invoices_login") return null;

  const active = businesses.filter((b) => !b.archived_at);
  const canSwitch = active.length > 1;
  const onWebsite = pathname.startsWith("/invoices_login/portfolio");
  const onEnquiries = pathname.startsWith("/invoices_login/enquiries");

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
        <Link href="/invoices_login/enquiries"
          aria-label={newEnquiries ? `Enquiries, ${newEnquiries} new` : "Enquiries"}
          aria-current={onEnquiries ? "page" : undefined}
          className={`app-bar-action app-bar-badge-host ${onEnquiries ? "app-bar-action--active" : ""}`}>
          <IconInbox size={19} />
          {newEnquiries > 0 && <span className="app-bar-badge">{newEnquiries > 9 ? "9+" : newEnquiries}</span>}
        </Link>
        <Link href="/invoices_login/portfolio" aria-label="Edit website"
          aria-current={onWebsite ? "page" : undefined}
          className={`app-bar-action app-bar-action--labelled ${onWebsite ? "app-bar-action--active" : ""}`}>
          <IconGlobe size={18} />
          <span>Website</span>
        </Link>
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
