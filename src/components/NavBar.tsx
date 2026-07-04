"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
  if (pathname.startsWith("/login")) return null;

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="nav">
      <span className="nav-brand">
        <IconCamera size={18} />
        <span className="hidden sm:inline">JJ Visuals</span>
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
