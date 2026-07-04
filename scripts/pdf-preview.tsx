// Dev-only: render a sample invoice PDF to inspect the design.
// Run: npx tsx scripts/pdf-preview.tsx <output.pdf>
import React from "react";
import { renderToFile } from "@react-pdf/renderer";
import QRCode from "qrcode";
import InvoicePdf from "../src/components/InvoicePdf";
import { paynowPayload } from "../src/lib/paynow";
import type { Invoice, Settings } from "../src/lib/types";

const settings: Settings = {
  id: 1,
  business_name: "JJ Visuals",
  address: "Blk 296A Compassvale Crescent #10-293, S541296",
  phone: "+65 9656 1716",
  email: "chuajiajun2705@gmail.com",
  paynow_number: "+6596561716",
  payee_name: "Chua Jia Jun",
  bank_details: "Bank Name: DBS",
  payment_terms: "paynow within 30 days of invoice",
  invoice_prefix: "A-",
  next_invoice_seq: 31,
};

const invoice: Invoice = {
  id: "preview",
  invoice_number: "A-30",
  status: "unpaid",
  issue_date: "2026-07-04",
  customer_id: 8,
  job_event: "Jordan Birthday Party Shoot",
  job_date: "20 June 2026, 7-9PM (2 Hours)",
  job_location: "62 Ubi Rd 1, #01-23 Oxley Bizhub 2, Singapore 408734",
  line_items: [
    {
      description:
        "Jordan Birthday Party Shoot\n20 June 2026, 7-9PM (2 Hours)\nPhoto & Video Shoot without Edit\n62 Ubi Rd 1, #01-23 Oxley Bizhub 2, Singapore 408734",
      qty: 1,
      unitPriceCents: 50000,
    },
    { description: "Extra shooting hour", qty: 1, unitPriceCents: 15000 },
  ],
  discount_type: "percent",
  discount_value: 10,
  subtotal_cents: 65000,
  total_cents: 58500,
  paid_date: null,
  customers: {
    id: 8,
    name: "Jordan Chia Zi Yi",
    phone: "+65 9698 6338",
    email: "jordaniswhoiam@live.com",
    address: "9 Bedok South Ave 2 #20-530",
  },
};

async function main() {
  const out = process.argv[2] ?? "/tmp/invoice-preview.pdf";
  const payload = paynowPayload({
    mobile: settings.paynow_number,
    amountCents: invoice.total_cents,
    reference: invoice.invoice_number!,
    merchantName: settings.payee_name.toUpperCase(),
  });
  const qr = await QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 1, width: 512 });
  let logo: string | null = null;
  const logoPath = decodeURIComponent(new URL("../public/logo.png", import.meta.url).pathname);
  const fs = await import("fs");
  if (fs.existsSync(logoPath)) {
    logo = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
  }
  await renderToFile(<InvoicePdf invoice={invoice} settings={settings} qr={qr} logo={logo} />, out);
  console.log("wrote", out, logo ? "(with logo)" : "(no logo yet)");
}

main();
