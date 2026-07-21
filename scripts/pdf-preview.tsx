// Dev-only: render a sample invoice PDF to inspect the design.
// Run: npx tsx scripts/pdf-preview.tsx <output.pdf>
import React from "react";
import path from "path";
import { renderToFile, Font } from "@react-pdf/renderer";
import QRCode from "qrcode";
import InvoicePdf from "../src/components/InvoicePdf";
import { paynowPayload } from "../src/lib/paynow";
import type { Business, Invoice } from "../src/lib/types";

// InvoicePdf.tsx registers Montserrat with browser paths (/fonts/...) since
// it's bundled for the client; that registration already ran when the
// import above was evaluated. Font.register is additive per-family (it
// pushes sources, doesn't replace them), so drop just the Montserrat entry
// before re-registering it with real file paths — Font.clear() would also
// wipe react-pdf's built-in Helvetica/Times/Courier registrations.
delete (Font as unknown as { fontFamilies: Record<string, unknown> }).fontFamilies.Montserrat;
const fontsDir = path.join(__dirname, "..", "public", "fonts");
Font.register({
  family: "Montserrat",
  fonts: [
    { src: path.join(fontsDir, "Montserrat-Regular.ttf"), fontWeight: 400 },
    { src: path.join(fontsDir, "Montserrat-SemiBold.ttf"), fontWeight: 600 },
    { src: path.join(fontsDir, "Montserrat-Bold.ttf"), fontWeight: 700 },
    { src: path.join(fontsDir, "Montserrat-ExtraBold.ttf"), fontWeight: 800 },
  ],
});

const business: Business = {
  id: "preview-business",
  name: "JJ Visuals",
  slug: "photography",
  address: "Blk 296A Compassvale Crescent #10-293, S541296",
  phone: "+65 9656 1716",
  email: "chuajiajun2705@gmail.com",
  paynow_number: "+6596561716",
  payee_name: "Chua Jia Jun",
  bank_details: "Bank Name: DBS",
  payment_terms: "paynow within 30 days of invoice",
  invoice_prefix: "A-",
  next_invoice_seq: 31,
  archived_at: null,
  email_template: "",
  whatsapp_template: "",
};

const invoice: Invoice = {
  id: "preview",
  business_id: business.id,
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
  sent_at: null,
  customers: {
    id: 8,
    business_id: business.id,
    name: "Jordan Chia Zi Yi",
    company: "Jordan Media Pte Ltd",
    phone: "+65 9698 6338",
    email: "jordaniswhoiam@live.com",
    uen: "202512345A",
    address: "Block 185 Edgefield Plains #07-294 Singapore 820185",
  },
};

async function main() {
  const out = process.argv[2] ?? "/tmp/invoice-preview.pdf";
  const payload = paynowPayload({
    mobile: business.paynow_number,
    amountCents: invoice.total_cents,
    reference: invoice.invoice_number!,
    merchantName: business.payee_name.toUpperCase(),
  });
  const qr = await QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 1, width: 512 });
  let logo: string | null = null;
  const logoPath = decodeURIComponent(new URL("../public/logo.png", import.meta.url).pathname);
  const fs = await import("fs");
  if (fs.existsSync(logoPath)) {
    logo = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
  }
  const variant = (process.argv[3] as "invoice" | "receipt") ?? "invoice";
  const inv = variant === "receipt"
    ? { ...invoice, status: "paid" as const, paid_date: "2026-07-04" }
    : invoice;
  await renderToFile(<InvoicePdf invoice={inv} business={business} qr={qr} logo={logo} variant={variant} />, out);
  console.log("wrote", out, logo ? "(with logo)" : "(no logo yet)");
}

main();
