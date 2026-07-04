"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { deleteInvoice, listInvoices, setPaid } from "@/lib/db";
import { formatSGD } from "@/lib/money";
import { isOverdue, type Invoice } from "@/lib/types";

export default function Dashboard() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listInvoices()
      .then(setInvoices)
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Something went wrong");
      });
  }, []);

  if (error) {
    return <p className="p-6 text-red-600">Error: {error}</p>;
  }

  if (!invoices) return <p className="p-6">Loading…</p>;

  const outstanding = invoices
    .filter((i) => i.status === "unpaid")
    .reduce((s, i) => s + i.total_cents, 0);

  async function togglePaid(inv: Invoice) {
    try {
      const paid = inv.status !== "paid";
      await setPaid(inv.id, paid);
      setInvoices(invoices!.map((i) => i.id === inv.id
        ? { ...i, status: paid ? "paid" : "unpaid", paid_date: paid ? new Date().toISOString().slice(0, 10) : null }
        : i));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  async function removeDraft(inv: Invoice) {
    if (!confirm("Delete this draft?")) return;
    try {
      await deleteInvoice(inv.id);
      setInvoices(invoices!.filter((i) => i.id !== inv.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  function badge(inv: Invoice) {
    if (inv.status === "draft") return <span className="text-xs rounded-full bg-gray-200 px-2 py-1">Draft</span>;
    if (inv.status === "paid") return <span className="text-xs rounded-full bg-green-100 text-green-700 px-2 py-1">Paid</span>;
    if (isOverdue(inv)) return <span className="text-xs rounded-full bg-red-100 text-red-700 px-2 py-1">Overdue</span>;
    return <span className="text-xs rounded-full bg-amber-100 text-amber-700 px-2 py-1">Unpaid</span>;
  }

  return (
    <main className="max-w-xl mx-auto p-4 space-y-4 text-sm">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">Invoices</h1>
        <p className="text-gray-500">Outstanding: <span className="font-semibold text-black">{formatSGD(outstanding)}</span></p>
      </div>

      {invoices.length === 0 && (
        <p className="text-gray-500">No invoices yet. <Link className="underline" href="/invoices/new">Create your first one.</Link></p>
      )}

      {invoices.map((inv) => (
        <div key={inv.id} className="border rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Link href={inv.status === "draft" ? `/invoices/new?draft=${inv.id}` : `/invoices/${inv.id}`}
              className="flex-1 min-w-0">
              <div className="font-semibold truncate">
                {inv.invoice_number ?? "Draft"} · {inv.customers?.name ?? "—"}
              </div>
              <div className="text-gray-500 truncate">{inv.job_event || "No event"} · {inv.issue_date}</div>
            </Link>
            <div className="font-semibold">{formatSGD(inv.total_cents)}</div>
            {badge(inv)}
          </div>
          <div className="flex gap-3 text-xs text-gray-600">
            {inv.status !== "draft" && (
              <button onClick={() => togglePaid(inv)} className="underline">
                {inv.status === "paid" ? "Mark unpaid" : "Mark paid"}
              </button>
            )}
            <Link href={`/invoices/new?duplicate=${inv.id}`} className="underline">Duplicate</Link>
            {inv.status === "draft" && (
              <button onClick={() => removeDraft(inv)} className="underline text-red-600">Delete</button>
            )}
          </div>
        </div>
      ))}
    </main>
  );
}
