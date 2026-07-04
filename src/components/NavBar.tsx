"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/", label: "Invoices", icon: "📄" },
  { href: "/invoices/new", label: "New", icon: "✚" },
  { href: "/stats", label: "Stats", icon: "📊" },
  { href: "/settings", label: "Settings", icon: "⚙" },
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
      {links.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href}
            className={`nav-link ${active ? "nav-link-active" : ""}`}>
            {l.label}
          </Link>
        );
      })}
      <button onClick={signOut} className="btn-ghost ml-auto">
        Sign out
      </button>
    </nav>
  );
}
