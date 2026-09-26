"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { createCustomer } from "@/lib/db";
import { useBusiness } from "@/lib/businessContext";
import { formatSgPhone, normalizeSgMobile } from "@/lib/phone";
import type { Enquiry, EnquiryStatus } from "@/lib/enquiry";
import { IconAdd, IconCheck, IconMail, IconUser, IconWhatsApp } from "@/components/icons";

const db = () => createClient();

const TABS: { key: "open" | EnquiryStatus; label: string }[] = [
  { key: "open", label: "To do" },
  { key: "booked", label: "Booked" },
  { key: "archived", label: "Archived" },
];

const STATUS_LABEL: Record<EnquiryStatus, string> = {
  new: "New", replied: "Replied", booked: "Booked", archived: "Archived",
};

/** "20 June 2026" — the format the invoice's event-date field uses. */
function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" });
}

function received(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return `Today, ${d.toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit" })}`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
}

export default function EnquiriesPage() {
  const { activeBusiness } = useBusiness();
  const [enquiries, setEnquiries] = useState<Enquiry[] | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("open");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    db().from("enquiries").select("*").order("created_at", { ascending: false })
      .then(({ data, error: e }) => {
        if (e) setError(e.message);
        else setEnquiries(data as Enquiry[]);
      });
  }, []);

  async function patch(e: Enquiry, change: Partial<Enquiry>) {
    setBusyId(e.id);
    setError(null);
    const { error: err } = await db().from("enquiries").update(change).eq("id", e.id);
    if (err) setError(err.message);
    else setEnquiries((list) => list?.map((x) => (x.id === e.id ? { ...x, ...change } : x)) ?? null);
    setBusyId(null);
  }

  async function saveAsClient(e: Enquiry) {
    if (!activeBusiness) return;
    setBusyId(e.id);
    setError(null);
    try {
      const c = await createCustomer(
        { name: e.name, company: "", phone: e.phone ? formatSgPhone(e.phone) : "", email: e.email, uen: "", address: "" },
        activeBusiness.id,
      );
      await patch(e, { customer_id: c.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the client");
      setBusyId(null);
    }
  }

  if (!enquiries) {
    return (
      <div className="page-container">
        {error ? <p style={{ color: "var(--warning)" }}>{error}</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="skeleton" style={{ height: 36, width: "40%", marginBottom: 14 }} />
            {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 120 }} />)}
          </div>
        )}
      </div>
    );
  }

  const shown = enquiries.filter((e) => (tab === "open" ? e.status === "new" || e.status === "replied" : e.status === tab));
  const newCount = enquiries.filter((e) => e.status === "new").length;

  return (
    <main className="page-container animate-fade-in">
      <h1 className="page-title">Enquiries</h1>
      <p className="page-subtitle">
        From the form on apexcinematics.tech{newCount > 0 ? ` · ${newCount} new` : ""}
      </p>

      {error && (
        <div style={{
          background: "var(--warning-bg)", color: "var(--warning)", padding: "10px 14px",
          borderRadius: "var(--radius-sm)", fontSize: "0.85rem", fontWeight: 600, marginBottom: 16,
        }}>{error}</div>
      )}

      <div className="chip-row" style={{ marginBottom: 12 }}>
        {TABS.map((t) => (
          <button key={t.key} className={`chip ${tab === t.key ? "chip-active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <p style={{ color: "var(--text-tertiary)" }}>
          {tab === "open" ? "Nothing waiting. New enquiries from the website land here." : `No ${TABS.find((t) => t.key === tab)!.label.toLowerCase()} enquiries.`}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {shown.map((e) => {
          const busy = busyId === e.id;
          const wa = e.phone ? normalizeSgMobile(e.phone) : null;
          const mail = `mailto:${e.email}?subject=${encodeURIComponent(`Re: your ${e.shoot_type ? e.shoot_type.toLowerCase() : "shoot"} enquiry`)}`;
          const invoiceHref = e.customer_id
            ? `/invoices_login/invoices/new?${new URLSearchParams({
              customer: String(e.customer_id),
              ...(e.shoot_type ? { job: e.shoot_type } : {}),
              ...(e.shoot_date ? { jobDate: longDate(e.shoot_date) } : {}),
            })}`
            : null;
          return (
            <div key={e.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                <div style={{ fontWeight: 600 }}>{e.name}</div>
                <span className={`badge ${e.status === "new" ? "badge-unpaid" : e.status === "booked" ? "badge-paid" : "badge-draft"}`}>
                  {STATUS_LABEL[e.status]}
                </span>
              </div>
              <div style={{ color: "var(--text-tertiary)", fontSize: "0.8rem", marginTop: 2 }}>
                {received(e.created_at)}
              </div>

              <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: "0.85rem", margin: "12px 0" }}>
                {e.shoot_type && (<><dt style={{ color: "var(--text-tertiary)" }}>Shoot</dt><dd>{e.shoot_type}</dd></>)}
                {e.shoot_date && (<><dt style={{ color: "var(--text-tertiary)" }}>Date</dt><dd>{longDate(e.shoot_date)}</dd></>)}
                {e.budget && (<><dt style={{ color: "var(--text-tertiary)" }}>Budget</dt><dd>{e.budget}</dd></>)}
                <dt style={{ color: "var(--text-tertiary)" }}>Email</dt><dd style={{ overflowWrap: "anywhere" }}>{e.email}</dd>
                {e.phone && (<><dt style={{ color: "var(--text-tertiary)" }}>Phone</dt><dd>{formatSgPhone(e.phone)}</dd></>)}
              </dl>
              <p style={{ whiteSpace: "pre-wrap", fontSize: "0.9rem", lineHeight: 1.5, color: "var(--text-secondary)" }}>{e.message}</p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                <a className="btn btn-secondary icon-btn" href={mail}
                  onClick={() => e.status === "new" && patch(e, { status: "replied" })}>
                  <IconMail size={14} /> Email
                </a>
                {wa?.isMobile && wa.e164 && (
                  <a className="btn btn-whatsapp icon-btn" href={`https://wa.me/${wa.e164}`} target="_blank" rel="noopener noreferrer"
                    onClick={() => e.status === "new" && patch(e, { status: "replied" })}>
                    <IconWhatsApp size={14} /> WhatsApp
                  </a>
                )}
                {e.customer_id ? (
                  <Link className="btn btn-primary icon-btn" href={invoiceHref!}>
                    <IconAdd size={14} /> Create invoice
                  </Link>
                ) : (
                  <button className="btn btn-secondary icon-btn" disabled={busy || !activeBusiness} onClick={() => saveAsClient(e)}>
                    <IconUser size={14} /> Save as client
                  </button>
                )}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 12, fontSize: "0.82rem" }}>
                {e.status !== "booked" && (
                  <button className="btn-ghost icon-btn" disabled={busy} onClick={() => patch(e, { status: "booked" })}>
                    <IconCheck size={13} /> Mark booked
                  </button>
                )}
                {e.status === "new" && (
                  <button className="btn-ghost" disabled={busy} onClick={() => patch(e, { status: "replied" })}>Mark replied</button>
                )}
                {e.status !== "archived" ? (
                  <button className="btn-ghost" disabled={busy} onClick={() => patch(e, { status: "archived" })}>Archive</button>
                ) : (
                  <button className="btn-ghost" disabled={busy} onClick={() => patch(e, { status: "replied" })}>Move back to To do</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
