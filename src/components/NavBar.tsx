"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useBusiness } from "@/lib/businessContext";
import { IconAdd, IconCamera, IconChart, IconSettings, IconSignOut } from "@/components/icons";

const links = [
  { href: "/", label: "Invoices", Icon: IconCamera },
  { href: "/invoices/new", label: "New", Icon: IconAdd },
  { href: "/stats", label: "Stats", Icon: IconChart },
  { href: "/settings", label: "Settings", Icon: IconSettings },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { businesses, activeBusiness, setActiveBusinessId } = useBusiness();
  if (pathname.startsWith("/login") || pathname.startsWith("/quote")) return null;

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const activeBusinesses = businesses.filter((b) => !b.archived_at);

  return (
    <nav className="nav">
      <span className="nav-brand">
        <IconCamera size={18} />
        {activeBusinesses.length > 1 ? (
          <select
            className="nav-business-switcher"
            aria-label="Active business"
            value={activeBusiness?.id ?? ""}
            onChange={(e) => {
              if (e.target.value === "__add__") router.push("/settings");
              else setActiveBusinessId(e.target.value);
            }}
          >
            {activeBusinesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            <option value="__add__">+ Add business…</option>
          </select>
        ) : (
          <span className="hidden sm:inline">{activeBusiness?.name ?? "…"}</span>
        )}
      </span>
      {links.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} aria-label={l.label}
            className={`nav-link icon-btn ${active ? "nav-link-active" : ""}`}>
            <l.Icon size={15} />
            <span className="hidden sm:inline">{l.label}</span>
          </Link>
        );
      })}
      <button onClick={signOut} className="btn-ghost icon-btn ml-auto" aria-label="Sign out">
        <IconSignOut size={16} />
        <span className="hidden sm:inline">Sign out</span>
      </button>
    </nav>
  );
}
