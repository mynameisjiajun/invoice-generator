import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { discountCents, formatSGD, lineTotalCents } from "@/lib/money";
import type { Invoice, Settings } from "@/lib/types";

/* Montserrat (Proxima Nova-style geometric sans). Files live in public/fonts;
   the browser fetches them from the site root, the pdf-preview script (node)
   reads them from the filesystem. */
const fontSrc = (file: string) =>
  typeof window === "undefined"
    ? `${process.cwd()}/public/fonts/${file}`
    : `/fonts/${file}`;

Font.register({
  family: "Montserrat",
  fonts: [
    { src: fontSrc("Montserrat-Regular.ttf"), fontWeight: 400 },
    { src: fontSrc("Montserrat-SemiBold.ttf"), fontWeight: 600 },
    { src: fontSrc("Montserrat-Bold.ttf"), fontWeight: 700 },
    { src: fontSrc("Montserrat-ExtraBold.ttf"), fontWeight: 800 },
  ],
});

// Keep names/addresses whole — no hyphenation
Font.registerHyphenationCallback((word) => [word]);

/* ── colour palette ─────────────────────────────────── */
const C = {
  black: "#0F0F0F",
  dark: "#1A1A2E",
  accent: "#16213E",
  mid: "#5A5A7A",
  light: "#9494B8",
  faint: "#E8E8F0",
  white: "#FFFFFF",
  highlight: "#F7F7FB",
  gold: "#C8A951",
};

/* ── styles ─────────────────────────────────────────── */
const s = StyleSheet.create({
  page: {
    padding: 0,
    fontSize: 9.5,
    fontFamily: "Montserrat",
    color: C.dark,
    backgroundColor: C.white,
  },

  /* ── top accent bar ── */
  topBar: {
    height: 6,
    backgroundColor: C.dark,
  },

  /* ── header area ── */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 48,
    paddingTop: 36,
    paddingBottom: 28,
  },
  businessName: {
    fontSize: 22,
    fontFamily: "Montserrat",
    fontWeight: 700,
    letterSpacing: 3,
    color: C.dark,
  },
  businessDetail: {
    fontSize: 8.5,
    color: C.mid,
    marginTop: 2,
    lineHeight: 1.5,
  },
  invoiceBadge: {
    backgroundColor: C.dark,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 3,
    marginBottom: 8,
  },
  invoiceBadgeText: {
    color: C.white,
    fontSize: 11,
    fontFamily: "Montserrat",
    fontWeight: 700,
    letterSpacing: 3,
  },
  invoiceMeta: {
    fontSize: 9,
    color: C.mid,
    textAlign: "right",
    marginTop: 2,
  },
  invoiceNumber: {
    fontSize: 13,
    fontFamily: "Montserrat",
    fontWeight: 700,
    color: C.dark,
    textAlign: "right",
    marginTop: 4,
  },

  /* ── divider ── */
  divider: {
    height: 1,
    backgroundColor: C.faint,
    marginHorizontal: 48,
  },
  dividerAccent: {
    height: 2,
    backgroundColor: C.dark,
    marginHorizontal: 48,
  },

  /* ── info cards ── */
  infoRow: {
    flexDirection: "row",
    paddingHorizontal: 48,
    paddingTop: 24,
    paddingBottom: 20,
    gap: 32,
  },
  infoCard: {
    flex: 1,
    backgroundColor: C.highlight,
    borderRadius: 6,
    padding: 14,
  },
  label: {
    fontSize: 7,
    fontFamily: "Montserrat",
    fontWeight: 700,
    color: C.light,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  infoName: {
    fontSize: 11,
    fontFamily: "Montserrat",
    fontWeight: 700,
    color: C.dark,
    marginBottom: 3,
  },
  infoDetail: {
    fontSize: 8.5,
    color: C.mid,
    lineHeight: 1.5,
  },

  /* ── table ── */
  tableContainer: {
    paddingHorizontal: 48,
    marginTop: 8,
  },
  tableHead: {
    flexDirection: "row",
    backgroundColor: C.dark,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  tableHeadText: {
    fontFamily: "Montserrat",
    fontWeight: 700,
    fontSize: 7.5,
    color: C.white,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: C.faint,
  },
  tableRowAlt: {
    backgroundColor: C.highlight,
  },
  cellDesc: { flex: 5 },
  cellQty: { flex: 1, textAlign: "right" },
  cellAmt: { flex: 1.5, textAlign: "right" },
  cellTot: { flex: 1.5, textAlign: "right" },
  cellText: { fontSize: 9.5, color: C.dark },
  cellTextBold: { fontSize: 9.5, fontFamily: "Montserrat",
    fontWeight: 700, color: C.dark },

  /* ── totals ── */
  totalsContainer: {
    paddingHorizontal: 48,
    marginTop: 12,
    alignItems: "flex-end",
  },
  totalsBox: {
    width: 220,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  totalRowFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: C.dark,
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  totalLabel: { fontSize: 9, color: C.mid },
  totalValue: { fontSize: 9, color: C.dark },
  totalLabelFinal: {
    fontSize: 11,
    fontFamily: "Montserrat",
    fontWeight: 700,
    color: C.white,
    letterSpacing: 1,
  },
  totalValueFinal: {
    fontSize: 13,
    fontFamily: "Montserrat",
    fontWeight: 700,
    color: C.white,
  },

  /* ── payment section ── */
  paymentSection: {
    flexDirection: "row",
    paddingHorizontal: 48,
    marginTop: 28,
    gap: 20,
  },
  paymentInfo: {
    flex: 1,
    backgroundColor: C.highlight,
    borderRadius: 6,
    padding: 16,
  },
  paymentLabel: {
    fontSize: 7,
    fontFamily: "Montserrat",
    fontWeight: 700,
    color: C.light,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  paymentText: {
    fontSize: 8.5,
    color: C.mid,
    lineHeight: 1.6,
  },
  paymentHighlight: {
    fontSize: 9,
    fontFamily: "Montserrat",
    fontWeight: 700,
    color: C.dark,
  },
  qrContainer: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.highlight,
    borderRadius: 6,
    padding: 16,
    width: 150,
  },
  qr: { width: 105, height: 105, borderRadius: 4 },
  qrCaption: {
    fontSize: 7,
    color: C.light,
    marginTop: 6,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  qrAmount: {
    fontSize: 10,
    fontFamily: "Montserrat",
    fontWeight: 700,
    color: C.dark,
    marginTop: 2,
    textAlign: "center",
  },

  /* ── footer ── */
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  footerBar: {
    height: 40,
    backgroundColor: C.dark,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  footerText: {
    fontSize: 8,
    color: C.light,
    letterSpacing: 2,
  },
  footerDot: {
    fontSize: 8,
    color: C.gold,
  },
});

export default function InvoicePdf({
  invoice,
  settings,
  qr,
  logo,
  variant = "invoice",
}: {
  invoice: Invoice;
  settings: Settings;
  qr: string;
  logo?: string | null;
  variant?: "invoice" | "receipt";
}) {
  const sub = invoice.subtotal_cents;
  const disc = discountCents(
    sub,
    invoice.discount_type,
    invoice.discount_value,
  );
  const isReceipt = variant === "receipt";
  const docWord = isReceipt ? "Receipt" : "Invoice";

  return (
    <Document title={`${docWord} ${invoice.invoice_number ?? "DRAFT"}`}>
      <Page size="A4" style={s.page}>
        {/* ── top accent bar ── */}
        <View style={s.topBar} />

        {/* ── header ── */}
        <View style={s.header}>
          <View>
            {logo ? (
              <Image
                src={logo}
                style={{
                  height: 72,
                  width: 220,
                  objectFit: "contain",
                  objectPosition: "left center",
                  marginBottom: 8,
                }}
              />
            ) : (
              <Text style={s.businessName}>
                {settings.business_name.toUpperCase()}
              </Text>
            )}
            <Text style={s.businessDetail}>{settings.address}</Text>
            <Text style={s.businessDetail}>
              {settings.phone} · {settings.email}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <View style={[s.invoiceBadge, isReceipt ? { backgroundColor: "#0B7A5C" } : {}]}>
              <Text style={s.invoiceBadgeText}>{isReceipt ? "RECEIPT" : "INVOICE"}</Text>
            </View>
            <Text style={s.invoiceNumber}>
              {invoice.invoice_number ?? "DRAFT"}
            </Text>
            <Text style={s.invoiceMeta}>Issued {invoice.issue_date}</Text>
            {isReceipt && invoice.paid_date && (
              <Text style={[s.invoiceMeta, { color: "#0B7A5C", fontWeight: 700 }]}>
                Paid {invoice.paid_date}
              </Text>
            )}
            {invoice.customer_id != null && (
              <Text style={s.invoiceMeta}>
                Customer ID: {invoice.customer_id}
              </Text>
            )}
          </View>
        </View>

        <View style={s.divider} />

        {/* ── bill-to + job info cards ── */}
        <View style={s.infoRow}>
          <View style={s.infoCard}>
            <Text style={s.label}>Bill To</Text>
            <Text style={s.infoName}>{invoice.customers?.name}</Text>
            {invoice.customers?.address ? (
              <Text style={s.infoDetail}>{invoice.customers.address}</Text>
            ) : null}
            {invoice.customers?.phone ? (
              <Text style={s.infoDetail}>{invoice.customers.phone}</Text>
            ) : null}
            {invoice.customers?.email ? (
              <Text style={s.infoDetail}>{invoice.customers.email}</Text>
            ) : null}
          </View>
          <View style={s.infoCard}>
            <Text style={s.label}>Job Details</Text>
            <Text style={s.infoName}>{invoice.job_event}</Text>
            {invoice.job_date ? (
              <Text style={s.infoDetail}>{invoice.job_date}</Text>
            ) : null}
            {invoice.job_location ? (
              <Text style={s.infoDetail}>{invoice.job_location}</Text>
            ) : null}
            <Text style={[s.label, { marginTop: 10 }]}>Payment Terms</Text>
            <Text style={s.infoDetail}>{settings.payment_terms}</Text>
          </View>
        </View>

        {/* ── line items table ── */}
        <View style={s.tableContainer}>
          <View style={s.tableHead}>
            <Text style={[s.tableHeadText, s.cellDesc]}>Description</Text>
            <Text style={[s.tableHeadText, s.cellQty]}>Qty</Text>
            <Text style={[s.tableHeadText, s.cellAmt]}>Unit Price</Text>
            <Text style={[s.tableHeadText, s.cellTot]}>Amount</Text>
          </View>
          {invoice.line_items.map((li, i) => (
            <View
              key={i}
              style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}
            >
              <Text style={[s.cellText, s.cellDesc]}>{li.description}</Text>
              <Text style={[s.cellText, s.cellQty]}>{li.qty}</Text>
              <Text style={[s.cellText, s.cellAmt]}>
                {formatSGD(li.unitPriceCents)}
              </Text>
              <Text style={[s.cellTextBold, s.cellTot]}>
                {formatSGD(lineTotalCents(li))}
              </Text>
            </View>
          ))}
        </View>

        {/* ── totals ── */}
        <View style={s.totalsContainer}>
          <View style={s.totalsBox}>
            {disc > 0 && (
              <>
                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>Subtotal</Text>
                  <Text style={s.totalValue}>{formatSGD(sub)}</Text>
                </View>
                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>
                    Discount
                    {invoice.discount_type === "percent"
                      ? ` (${invoice.discount_value}%)`
                      : ""}
                  </Text>
                  <Text style={[s.totalValue, { color: "#D14343" }]}>
                    -{formatSGD(disc)}
                  </Text>
                </View>
              </>
            )}
            <View style={[s.totalRowFinal, isReceipt ? { backgroundColor: "#0B7A5C" } : {}]}>
              <Text style={s.totalLabelFinal}>{isReceipt ? "TOTAL PAID" : "TOTAL DUE"}</Text>
              <Text style={s.totalValueFinal}>
                {formatSGD(invoice.total_cents)}
              </Text>
            </View>
          </View>
        </View>

        {/* ── payment info + QR (invoice) / confirmation (receipt) ── */}
        {isReceipt ? (
          <View style={s.paymentSection}>
            <View style={[s.paymentInfo, { backgroundColor: "#E8FBF5" }]}>
              <Text style={[s.paymentLabel, { color: "#0B7A5C" }]}>Payment Received</Text>
              <Text style={s.paymentText}>
                Payment of{" "}
                <Text style={s.paymentHighlight}>{formatSGD(invoice.total_cents)}</Text>
                {" "}for invoice{" "}
                <Text style={s.paymentHighlight}>{invoice.invoice_number}</Text>
                {invoice.paid_date ? ` was received on ${invoice.paid_date}.` : " has been received."}
              </Text>
              <Text style={[s.paymentText, { marginTop: 6 }]}>
                No further payment is due. Thank you!
              </Text>
            </View>
          </View>
        ) : (
        <View style={s.paymentSection}>
          <View style={s.paymentInfo}>
            <Text style={s.paymentLabel}>Payment Information</Text>
            <Text style={s.paymentText}>
              Scan the QR code to PayNow the exact amount,{"\n"}
              or PayNow directly to{" "}
              <Text style={s.paymentHighlight}>{settings.paynow_number}</Text>
            </Text>
            <Text style={[s.paymentText, { marginTop: 4 }]}>
              Reference:{" "}
              <Text style={s.paymentHighlight}>{invoice.invoice_number}</Text>
            </Text>
            <Text style={[s.paymentText, { marginTop: 8 }]}>
              Cheques crossed, payable to{" "}
              <Text style={s.paymentHighlight}>{settings.payee_name}</Text>
            </Text>
            <Text style={s.paymentText}>{settings.bank_details}</Text>
          </View>
          <View style={s.qrContainer}>
            <Image style={s.qr} src={qr} />
            <Text style={s.qrCaption}>PAYNOW</Text>
            <Text style={s.qrAmount}>{formatSGD(invoice.total_cents)}</Text>
          </View>
        </View>
        )}

        {/* ── footer ── */}
        <View style={s.footer} fixed>
          <View style={s.footerBar}>
            <Text style={s.footerText}>THANK YOU FOR YOUR BUSINESS</Text>
            <Text style={s.footerDot}>·</Text>
            <Text style={s.footerText}>
              {settings.business_name.toUpperCase()}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
