"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/", label: "Invoices" },
  { href: "/invoices/new", label: "New" },
  { href: "/stats", label: "Stats" },
  { href: "/settings", label: "Settings" },
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
    <nav className="sticky top-0 z-10 bg-white border-b flex items-center gap-1 px-3 py-2 text-sm">
      {links.map((l) => (
        <Link key={l.href} href={l.href}
          className={`px-3 py-2 rounded-lg ${pathname === l.href ? "bg-black text-white" : "hover:bg-gray-100"}`}>
          {l.label}
        </Link>
      ))}
      <button onClick={signOut} className="ml-auto px-3 py-2 rounded-lg text-gray-500 hover:bg-gray-100">
        Sign out
      </button>
    </nav>
  );
}
