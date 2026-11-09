// Dev-only: render a sample invoice PDF to inspect the design.
// Run: npx tsx scripts/pdf-preview.tsx <output.pdf> [invoice|receipt|rental|rental-receipt|rental-noterms]
// PREVIEW_LOGO=/path/to/logo.png overrides public/logo.png.
import React from "react";
import path from "path";
import { renderToFile, Font } from "@react-pdf/renderer";
import QRCode from "qrcode";
import InvoicePdf from "../src/components/InvoicePdf";
import { paynowPayload } from "../src/lib/paynow";
import type { Business, Invoice } from "../src/lib/types";
import { subtotalCents } from "../src/lib/money";

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
  name: "Apex Cinematics",
  slug: "photography",
  address: "Blk 296A Compassvale Crescent #10-293, S541296",
  phone: "+65 8905 5027",
  email: "contact@apexcinematics.tech",
  paynow_number: "+6596561716",
  payee_name: "Chua Jia Jun",
  bank_details: "Bank Name: DBS",
  payment_terms: "paynow within 30 days of invoice",
  invoice_prefix: "A-",
  next_invoice_seq: 31,
  archived_at: null,
  email_template: "",
  whatsapp_template: "",
  logo_data_url: null,
};

const invoice: Invoice = {
  id: "preview",
  business_id: business.id,
  invoice_number: "A-30",
  status: "unpaid",
  issue_date: "2026-07-04",
  due_date: "2026-08-03",
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

// Equipment rental sample (Apex Cinematics): per item, per day.
const rentalLines: Invoice["line_items"] = [
  { description: "Sony FX3 Cinema Line body", qty: 1, unitPriceCents: 8000, rental: { days: 3, replacementCents: 550000 } },
  { description: "Sony FE 24-70mm f/2.8 GM II", qty: 1, unitPriceCents: 4500, rental: { days: 3, replacementCents: 320000 } },
  { description: "Aputure 300d II light kit", qty: 2, unitPriceCents: 3500, rental: { days: 3, replacementCents: 110000 } },
  { description: "V-mount battery 150Wh", qty: 4, unitPriceCents: 800, rental: { days: 3, replacementCents: 28000 } },
  { description: "Delivery & collection", qty: 1, unitPriceCents: 4000 },
];
const rentalSub = subtotalCents(rentalLines);
const rentalInvoice: Invoice = {
  ...invoice,
  invoice_number: "A-31",
  is_rental: true,
  rental_start: "2026-11-14T10:00",
  rental_end: "2026-11-17T10:00",
  job_event: "Short film — Night Market",
  job_date: "",
  job_location: "Self-collect & return: Blk 296A Compassvale Crescent #10-293, S541296",
  line_items: rentalLines,
  discount_type: "none",
  discount_value: 0,
  subtotal_cents: rentalSub,
  total_cents: rentalSub,
};

async function main() {
  const out = process.argv[2] ?? "/tmp/invoice-preview.pdf";
  const mode = process.argv[3] ?? "invoice";
  const isRental = mode.startsWith("rental");
  const base = mode === "rental-noterms"
    ? { ...rentalInvoice, rental_terms: false }
    : isRental ? rentalInvoice : invoice;
  const payload = paynowPayload({
    mobile: business.paynow_number,
    amountCents: base.total_cents,
    reference: base.invoice_number!,
  });
  const qr = await QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 1, width: 512 });
  let logo: string | null = null;
  const logoPath = process.env.PREVIEW_LOGO
    ?? decodeURIComponent(new URL("../public/logo.png", import.meta.url).pathname);
  const fs = await import("fs");
  if (fs.existsSync(logoPath)) {
    logo = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
  }
  const variant: "invoice" | "receipt" = mode.endsWith("receipt") ? "receipt" : "invoice";
  const inv = variant === "receipt"
    ? { ...base, status: "paid" as const, paid_date: "2026-07-04" }
    : base;
  await renderToFile(<InvoicePdf invoice={inv} business={business} qr={qr} logo={logo} variant={variant} />, out);
  console.log("wrote", out, logo ? "(with logo)" : "(no logo yet)");
}

main();
