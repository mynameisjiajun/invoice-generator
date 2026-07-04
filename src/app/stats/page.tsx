"use client";
import { useEffect, useState } from "react";
import { listInvoices } from "@/lib/db";
import { formatSGD } from "@/lib/money";
import { clientStats, monthlyStats, yearlyStats } from "@/lib/stats";
import type { Invoice } from "@/lib/types";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export default function StatsPage() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => { listInvoices().then(setInvoices); }, []);
  if (!invoices) return <p className="p-6">Loading…</p>;

  const years = yearlyStats(invoices);
  const months = monthlyStats(invoices, year);
  const clients = clientStats(invoices);
  const max = Math.max(...months.map((m) => m.invoicedCents), 1);
  const outstanding = invoices.filter((i) => i.status === "unpaid").reduce((s, i) => s + i.total_cents, 0);

  return (
    <main className="max-w-xl mx-auto p-4 space-y-6 text-sm">
      <h1 className="text-xl font-bold">Stats</h1>
      <p>Outstanding (unpaid): <span className="font-bold">{formatSGD(outstanding)}</span></p>

      <section>
        <h2 className="font-semibold mb-2">By year</h2>
        {years.map((y) => (
          <button key={y.year} onClick={() => setYear(y.year)}
            className={`w-full flex justify-between border rounded-lg p-3 mb-2 ${y.year === year ? "border-black" : ""}`}>
            <span>{y.year}</span>
            <span>Invoiced {formatSGD(y.invoicedCents)} · Collected {formatSGD(y.collectedCents)}</span>
          </button>
        ))}
        {years.length === 0 && <p className="text-gray-500">No finalized invoices yet.</p>}
      </section>

      <section>
        <h2 className="font-semibold mb-2">{year} by month</h2>
        <div className="flex items-end gap-1 h-32">
          {months.map((m) => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full bg-gray-200 rounded-t relative" style={{ height: `${(m.invoicedCents / max) * 100}%` }}>
                <div className="absolute bottom-0 w-full bg-black rounded-t"
                  style={{ height: m.invoicedCents ? `${(m.collectedCents / m.invoicedCents) * 100}%` : 0 }} />
              </div>
              <span className="text-[10px] text-gray-500">{MONTHS[m.month - 1]}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1">Grey = invoiced · Black = collected</p>
      </section>

      <section>
        <h2 className="font-semibold mb-2">By client</h2>
        {clients.map((c) => (
          <div key={c.name} className="flex justify-between border-b py-2">
            <span>{c.name}</span><span>{formatSGD(c.invoicedCents)}</span>
          </div>
        ))}
      </section>
    </main>
  );
}
