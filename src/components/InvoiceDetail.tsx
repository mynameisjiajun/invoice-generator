"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getInvoice, getSettings } from "@/lib/db";
import { formatSGD } from "@/lib/money";
import { paynowPayload } from "@/lib/paynow";
import { qrDataUrl } from "@/lib/qr";
import type { Invoice, Settings } from "@/lib/types";

export default function InvoiceDetail({ id }: { id: string }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getInvoice(id).then(setInvoice).catch((e) => setError(e.message));
    getSettings().then(setSettings).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (!invoice || !settings) return <p className="p-6">Loading…</p>;

  async function sharePdf() {
    setBusy(true);
    try {
      const inv = invoice!; const st = settings!;
      const payload = paynowPayload({
        mobile: st.paynow_number,
        amountCents: inv.total_cents,
        reference: inv.invoice_number ?? "",
        merchantName: st.payee_name.toUpperCase(),
      });
      const qr = await qrDataUrl(payload);
      const { pdf } = await import("@react-pdf/renderer");
      const { default: InvoicePdf } = await import("@/components/InvoicePdf");
      const blob = await pdf(<InvoicePdf invoice={inv} settings={st} qr={qr} />).toBlob();
      const file = new File([blob], `Invoice ${inv.invoice_number ?? "DRAFT"}.pdf`, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Invoice ${inv.invoice_number ?? "DRAFT"}` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement("a"), { href: url, download: file.name });
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <main className="max-w-xl mx-auto p-4 space-y-4 text-sm">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{invoice.invoice_number ?? "Draft"}</h1>
        <span className="text-gray-500">{invoice.status.toUpperCase()}</span>
      </div>
      <div className="border rounded-xl p-4 space-y-1">
        <p className="font-semibold">{invoice.customers?.name}</p>
        <p>{invoice.job_event}</p>
        <p className="text-gray-500">{invoice.job_date} · {invoice.job_location}</p>
        <p className="text-lg font-bold pt-2">{formatSGD(invoice.total_cents)}</p>
      </div>
      <button onClick={sharePdf} disabled={busy}
        className="w-full rounded-lg bg-black text-white p-3 disabled:opacity-50">
        {busy ? "Generating…" : "Download / Share PDF"}
      </button>
      <Link href={`/invoices/new?duplicate=${invoice.id}`} className="block text-center underline">
        Duplicate this invoice
      </Link>
    </main>
  );
}
