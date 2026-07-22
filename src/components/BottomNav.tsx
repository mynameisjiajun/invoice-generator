"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconAdd, IconCamera, IconReceipt, IconSettings, IconUser } from "@/components/icons";

const isQuotePublic = (p: string) => p.startsWith("/invoices_login/quote/");

const tabs = [
  { href: "/invoices_login/invoices", label: "Invoices", Icon: IconCamera,
    match: (p: string) => p.startsWith("/invoices_login/invoices") && p !== "/invoices_login/invoices/new" },
  { href: "/invoices_login/quotes", label: "Quotes", Icon: IconReceipt, match: (p: string) => p.startsWith("/invoices_login/quotes") },
  { href: "/invoices_login/customers", label: "Clients", Icon: IconUser, match: (p: string) => p.startsWith("/invoices_login/customers") },
  { href: "/invoices_login/settings", label: "Settings", Icon: IconSettings, match: (p: string) => p.startsWith("/invoices_login/settings") },
];

export default function BottomNav() {
  const pathname = usePathname();
  if (pathname === "/invoices_login" || isQuotePublic(pathname)) return null;

  const left = tabs.slice(0, 2);
  const right = tabs.slice(2);
  const newActive = pathname === "/invoices_login/invoices/new";

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {left.map((t) => <Tab key={t.href} t={t} active={t.match(pathname)} />)}
      <Link href="/invoices_login/invoices/new" aria-label="New invoice"
        className={`bottom-nav-fab ${newActive ? "bottom-nav-fab--active" : ""}`}>
        <IconAdd size={24} />
      </Link>
      {right.map((t) => <Tab key={t.href} t={t} active={t.match(pathname)} />)}
    </nav>
  );
}

function Tab({ t, active }: { t: (typeof tabs)[number]; active: boolean }) {
  return (
    <Link href={t.href} aria-label={t.label} aria-current={active ? "page" : undefined}
      className={`bottom-nav-tab ${active ? "bottom-nav-tab--active" : ""}`}>
      <t.Icon size={22} />
      <span>{t.label}</span>
    </Link>
  );
}
