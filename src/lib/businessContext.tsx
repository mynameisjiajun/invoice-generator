"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { listBusinesses } from "@/lib/db";
import type { Business } from "@/lib/types";

const STORAGE_KEY = "jjv.activeBusinessId";

type BusinessContextValue = {
  businesses: Business[];
  activeBusiness: Business | null;
  setActiveBusinessId: (id: string) => void;
  reloadBusinesses: () => Promise<void>;
};

const BusinessContext = createContext<BusinessContextValue | null>(null);

export function BusinessProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBusinessId, setActiveBusinessIdState] = useState<string | null>(null);

  async function reloadBusinesses() {
    const list = await listBusinesses();
    setBusinesses(list);
    setActiveBusinessIdState((current) => {
      const active = list.filter((b) => !b.archived_at);
      if (current && active.some((b) => b.id === current)) return current;
      const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (stored && active.some((b) => b.id === stored)) return stored;
      return active[0]?.id ?? null;
    });
  }

  useEffect(() => {
    if (pathname === "/invoices_login" || pathname.startsWith("/invoices_login/quote/")) return;
    reloadBusinesses().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname === "/invoices_login" || pathname.startsWith("/invoices_login/quote/")]);

  function setActiveBusinessId(id: string) {
    setActiveBusinessIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }

  const activeBusiness = businesses.find((b) => b.id === activeBusinessId) ?? null;

  return (
    <BusinessContext.Provider value={{ businesses, activeBusiness, setActiveBusinessId, reloadBusinesses }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness(): BusinessContextValue {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error("useBusiness must be used within BusinessProvider");
  return ctx;
}
