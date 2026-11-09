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
import { formatSgPhone, formatSgAddress } from "@/lib/phone";
import {
  attachesRentalTerms, invoiceDocLabel, isPrintBusiness, isRentalInvoice, type Business, type Invoice,
} from "@/lib/types";
import { daysLabel, formatRentalDateTime, rentalDays } from "@/lib/rental";
import {
  RENTAL_ACK, RENTAL_TERMS, RENTAL_TERMS_INTRO, RENTAL_TERMS_SUBTITLE, RENTAL_TERMS_TITLE,
} from "@/lib/rentalTerms";
import { formatJobDate, parseHandover, printBreakdown, printSpecLine } from "@/lib/printRates";
import { paynowDisplay } from "@/lib/paynow";

/* Montserrat (Proxima Nova-style geometric sans), served from public/fonts.
   This file is bundled for the browser (dynamically imported by
   InvoiceDetail), so it must only ever reference browser-safe URLs — no
   Node APIs like process.cwd() here. The node-only pdf-preview script
   re-registers this family with filesystem paths before rendering. */
Font.register({
  family: "Montserrat",
  fonts: [
    { src: "/fonts/Montserrat-Regular.ttf", fontWeight: 400 },
    { src: "/fonts/Montserrat-SemiBold.ttf", fontWeight: 600 },
    { src: "/fonts/Montserrat-Bold.ttf", fontWeight: 700 },
    { src: "/fonts/Montserrat-ExtraBold.ttf", fontWeight: 800 },
  ],
});

// Keep names/addresses whole — no hyphenation
Font.registerHyphenationCallback((word) => [word]);

/* ── colour palettes ────────────────────────────────────
   WARM ("darkroom / editorial"): used for print businesses (JJ Gears & Prints).
   Warm near-black ink, paper tones, safelight rust, light-meter gold.
   Key names are kept so the whole stylesheet inherits via `makeStyles`.

   APEX (Apex Cinematics): charcoal-based palette echoing the logo —
   "APEX" in orange #F65F0D, "CINEMATICS" in off-white #F4F4F4, on a
   charcoal #191919 parallelogram. Same keys as WARM plus `danger`. */

type Palette = {
  dark: string;
  mid: string;
  light: string;
  faint: string;
  white: string;
  highlight: string;
  gold: string;
  rust: string;
  sage: string;
  sageBg: string;
  danger: string;
};

const WARM: Palette = {
  dark: "#221C15",     // warm near-black ink — structural (bars, table head, totals)
  mid: "#6E6153",      // warm secondary text
  light: "#A79A85",    // warm tertiary text / labels
  faint: "#E9E0CB",    // warm hairline / borders
  white: "#FFFFFF",
  highlight: "#F7F2E8", // warm paper — card / alt-row backgrounds
  gold: "#C8A951",     // light-meter gold — money emphasis
  rust: "#B8452E",     // safelight red — brand accent, used sparingly
  sage: "#4E7A5A",     // warm success green (receipts)
  sageBg: "#E7EEE4",
  danger: "#D14343",
};

const APEX: Palette = {
  dark: "#191919",     // charcoal — logo background, structural
  mid: "#5A5A5A",      // secondary text
  light: "#767676",    // tertiary text / labels (≥4:1 on white, off-white and charcoal)
  faint: "#E4E4E4",    // hairline / borders
  white: "#FFFFFF",
  highlight: "#F4F4F4", // off-white — card / alt-row backgrounds (logo "CINEMATICS" tone)
  gold: "#F65F0D",     // logo orange — money emphasis
  rust: "#F65F0D",     // logo orange — brand accent
  sage: "#2F7D4F",     // success green (receipts)
  sageBg: "#E5F1EA",
  danger: "#B42318",   // deep red, kept distinct from the brand orange
};

/* ── styles ─────────────────────────────────────────── */
function makeStyles(C: Palette) { return StyleSheet.create({
  page: {
    padding: 0,
    // Top bars and footer are `fixed` overlays; this padding keeps flowing
    // content clear of them on every page (header padding is reduced to
    // match, so a one-page invoice lays out exactly as before).
    paddingTop: 36,
    paddingBottom: 44,
    fontSize: 10.5,
    fontFamily: "Montserrat",
    color: C.dark,
    backgroundColor: C.white,
  },

  /* ── top accent bars: ink with a thin rust "safelight" line ── */
  topBars: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  topBar: {
    height: 5,
    backgroundColor: C.dark,
  },
  topBarAccent: {
    height: 2,
    backgroundColor: C.rust,
  },

  /* ── header area ── */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 48,
    paddingTop: 7,
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
    fontSize: 9.5,
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
    fontSize: 9.5,
    color: C.mid,
    textAlign: "right",
    marginTop: 2,
  },
  invoiceNumber: {
    fontSize: 15,
    fontFamily: "Montserrat",
    fontWeight: 700,
    color: C.rust,
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
    paddingTop: 20,
    paddingBottom: 16,
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
    fontSize: 12.5,
    fontFamily: "Montserrat",
    fontWeight: 700,
    color: C.dark,
    marginBottom: 3,
  },
  infoDetail: {
    fontSize: 9.5,
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
    fontSize: 8.5,
    color: C.white,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
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
  cellText: { fontSize: 10.5, color: C.dark },
  cellSub: { fontSize: 8.5, color: C.mid, marginTop: 2 },
  cellTextBold: { fontSize: 10.5, fontFamily: "Montserrat",
    fontWeight: 700, color: C.dark },

  /* ── totals ── */
  totalsContainer: {
    paddingHorizontal: 48,
    marginTop: 8,
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
  totalLabel: { fontSize: 10, color: C.mid },
  totalValue: { fontSize: 10, color: C.dark },
  totalLabelFinal: {
    fontSize: 12.5,
    fontFamily: "Montserrat",
    fontWeight: 700,
    color: C.white,
    letterSpacing: 1,
  },
  totalValueFinal: {
    fontSize: 15,
    fontFamily: "Montserrat",
    fontWeight: 700,
    color: C.gold,
  },

  /* ── payment section ── */
  paymentSection: {
    flexDirection: "row",
    paddingHorizontal: 48,
    marginTop: 18,
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
    fontSize: 9.5,
    color: C.mid,
    lineHeight: 1.6,
  },
  paymentHighlight: {
    fontSize: 10,
    fontFamily: "Montserrat",
    fontWeight: 700,
    color: C.dark,
  },
  qrContainer: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.highlight,
    borderRadius: 6,
    padding: 14,
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
    fontSize: 11.5,
    fontFamily: "Montserrat",
    fontWeight: 700,
    color: C.dark,
    marginTop: 2,
    textAlign: "center",
  },

  /* ── rental (Apex Cinematics equipment rental) ── */
  rentalRow: { flexDirection: "row" },
  rentalKey: {
    width: 50,
    fontSize: 9.5,
    fontFamily: "Montserrat",
    fontWeight: 700,
    color: C.dark,
    lineHeight: 1.5,
  },
  termsNotice: {
    marginTop: 10,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: C.rust,
  },
  termsNoticeText: { fontSize: 8, color: C.mid, lineHeight: 1.45 },

  /* ── rental T&C pages ── */
  tcHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 48,
    paddingTop: 7,
    paddingBottom: 12,
  },
  tcEyebrow: {
    fontSize: 7,
    fontFamily: "Montserrat",
    fontWeight: 700,
    color: C.rust,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  tcTitle: {
    fontSize: 17,
    fontFamily: "Montserrat",
    fontWeight: 800,
    color: C.dark,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  tcSubtitle: {
    fontSize: 9.5,
    color: C.mid,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: 2,
  },
  tcRefNumber: {
    fontSize: 13,
    fontFamily: "Montserrat",
    fontWeight: 700,
    color: C.rust,
    textAlign: "right",
  },
  tcBody: { paddingHorizontal: 48, paddingTop: 10 },
  tcIntro: { fontSize: 8.5, color: C.mid, lineHeight: 1.5, marginBottom: 4 },
  tcSectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    marginBottom: 5,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderColor: C.faint,
  },
  tcSectionNum: {
    fontSize: 10,
    fontFamily: "Montserrat",
    fontWeight: 800,
    color: C.rust,
  },
  tcSectionTitle: {
    fontSize: 8.5,
    fontFamily: "Montserrat",
    fontWeight: 700,
    color: C.dark,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  tcClause: { flexDirection: "row", marginBottom: 3.5 },
  tcNum: {
    width: 26,
    fontSize: 8.5,
    fontFamily: "Montserrat",
    fontWeight: 700,
    color: C.dark,
    lineHeight: 1.45,
  },
  // No `flex` here: inside a column a flex basis of 0 collapses wrapped text
  // to zero height and the next line draws over it. Rows that need the text
  // to take the remaining width wrap it in `tcFill` instead.
  tcText: { fontSize: 8.5, color: C.dark, lineHeight: 1.45 },
  tcFill: { flexGrow: 1, flexShrink: 1, flexBasis: "auto", width: 0 },
  tcLead: { fontFamily: "Montserrat", fontWeight: 700 },
  tcSubRow: { flexDirection: "row", marginTop: 2 },
  tcSubNum: { width: 18, fontSize: 8.5, color: C.dark, lineHeight: 1.45 },
  tcCallout: {
    backgroundColor: C.highlight,
    borderLeftWidth: 3,
    borderLeftColor: C.rust,
    borderRadius: 3,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  tcCalloutHead: {
    fontSize: 7.5,
    fontFamily: "Montserrat",
    fontWeight: 800,
    color: C.rust,
    letterSpacing: 1.2,
    marginBottom: 3,
  },
  tcCalloutText: {
    fontSize: 8.5,
    fontFamily: "Montserrat",
    fontWeight: 600,
    color: C.dark,
    lineHeight: 1.45,
  },
  ack: {
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: C.dark,
    borderRadius: 6,
    padding: 16,
  },
  ackTitle: {
    fontSize: 11,
    fontFamily: "Montserrat",
    fontWeight: 800,
    color: C.dark,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  ackPoint: { flexDirection: "row", marginTop: 3 },
  ackBullet: { width: 12, fontSize: 8.5, color: C.rust, lineHeight: 1.45 },
  ackFields: { flexDirection: "row", gap: 24, marginTop: 16 },
  ackField: { flex: 1 },
  ackLine: { height: 22, borderBottomWidth: 1, borderColor: C.dark },
  ackSignLine: { height: 46, borderBottomWidth: 1, borderColor: C.dark },
  ackPrefilled: {
    height: 22,
    borderBottomWidth: 1,
    borderColor: C.dark,
    justifyContent: "flex-end",
    paddingBottom: 3,
  },
  ackPrefilledText: {
    fontSize: 12,
    fontFamily: "Montserrat",
    fontWeight: 700,
    color: C.rust,
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
}); }

const SHEETS = {
  warm: { C: WARM, s: makeStyles(WARM) },
  apex: { C: APEX, s: makeStyles(APEX) },
};

export default function InvoicePdf({
  invoice,
  business,
  qr,
  logo,
  variant = "invoice",
}: {
  invoice: Invoice;
  business: Business;
  qr: string | null;
  logo?: string | null;
  variant?: "invoice" | "receipt";
}) {
  const sheet = isPrintBusiness(business) ? SHEETS.warm : SHEETS.apex;
  const s = sheet.s;
  const C = sheet.C;
  const sub = invoice.subtotal_cents;
  const disc = discountCents(
    sub,
    invoice.discount_type,
    invoice.discount_value,
  );
  const isReceipt = variant === "receipt";
  // Equipment rental (Apex): rental details card, per-day columns, and —
  // on the invoice, not the receipt — the rental T&C appended after it.
  const isRental = !isPrintBusiness(business) && isRentalInvoice(invoice);
  const period = isRental ? rentalDays(invoice.rental_start, invoice.rental_end) : null;
  // The owner can leave the T&C off when they were sent separately; the
  // invoice still states the rental is subject to them.
  const attachTerms = isRental && attachesRentalTerms(invoice);

  return (
    <Document title={invoiceDocLabel(invoice, variant)}>
      <Page size="A4" style={s.page}>
        {/* ── top accent bars (on every page the invoice runs to) ── */}
        <View style={s.topBars} fixed>
          <View style={s.topBar} />
          <View style={s.topBarAccent} />
        </View>

        {/* ── header ── */}
        {/* Rentals run tighter so a typical gear list + payment card still fit on page 1. */}
        <View style={[s.header, isRental ? { paddingBottom: 14 } : {}]}>
          <View>
            {logo ? (
              <Image
                src={logo}
                style={{
                  // Sized to the wide Apex wordmark (~3.6:1): a taller box
                  // left empty space above the address and pushed the
                  // payment cards under the footer bar.
                  height: 56,
                  width: 202,
                  objectFit: "contain",
                  objectPosition: "left center",
                  marginBottom: 8,
                }}
              />
            ) : (
              <Text style={s.businessName}>
                {business.name.toUpperCase()}
              </Text>
            )}
            {formatSgAddress(business.address).map((line, i) => (
              <Text key={i} style={s.businessDetail}>{line}</Text>
            ))}
            <Text style={s.businessDetail}>
              {formatSgPhone(business.phone)} · {business.email}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <View style={[s.invoiceBadge, isReceipt ? { backgroundColor: C.sage } : {}]}>
              <Text style={s.invoiceBadgeText}>{isReceipt ? "RECEIPT" : "INVOICE"}</Text>
            </View>
            <Text style={s.invoiceNumber}>
              {invoice.invoice_number ?? "DRAFT"}
            </Text>
            <Text style={s.invoiceMeta}>Issued {invoice.issue_date}</Text>
            {isReceipt && invoice.paid_date && (
              <Text style={[s.invoiceMeta, { color: C.sage, fontWeight: 700 }]}>
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
        <View style={[s.infoRow, isRental ? { paddingTop: 12, paddingBottom: 10 } : {}]}>
          <View style={s.infoCard}>
            <Text style={s.label}>Bill To</Text>
            <Text style={s.infoName}>{invoice.customers?.name}</Text>
            {invoice.customers?.company ? (
              <Text style={[s.infoDetail, { fontWeight: 700, color: C.dark }]}>{invoice.customers.company}</Text>
            ) : null}
            {invoice.customers?.phone ? (
              <Text style={s.infoDetail}>{formatSgPhone(invoice.customers.phone)}</Text>
            ) : null}
            {invoice.customers?.email ? (
              <Text style={s.infoDetail}>{invoice.customers.email}</Text>
            ) : null}
            {invoice.customers?.uen ? (
              <Text style={s.infoDetail}>UEN : {invoice.customers.uen}</Text>
            ) : null}
            {invoice.customers?.address
              ? formatSgAddress(invoice.customers.address).map((line, i) => (
                  <Text key={i} style={s.infoDetail}>{line}</Text>
                ))
              : null}
            {!invoice.customers?.company && !invoice.customers?.address && !invoice.customers?.phone && !invoice.customers?.email && (
              <Text style={[s.infoDetail, { fontStyle: "italic" }]}>No contact details on file</Text>
            )}
          </View>
          <View style={s.infoCard}>
            {isPrintBusiness(business) ? (() => {
              const handover = parseHandover(invoice.job_location);
              return (
                <>
                  <Text style={s.label}>Project</Text>
                  {invoice.job_event ? <Text style={s.infoName}>{invoice.job_event}</Text> : null}
                  <Text style={s.infoDetail}>
                    {handover.mode === "delivery" ? "Delivery" : "Self-collection"}
                  </Text>
                  {handover.address ? <Text style={s.infoDetail}>{handover.address}</Text> : null}
                  {invoice.job_date ? (
                    <Text style={s.infoDetail}>Ready by {formatJobDate(invoice.job_date)}</Text>
                  ) : null}
                </>
              );
            })() : isRental ? (
              <>
                <Text style={s.label}>Rental Details</Text>
                <Text style={s.infoName}>{invoice.job_event || "Equipment Rental"}</Text>
                {invoice.rental_start ? (
                  <View style={s.rentalRow}>
                    <Text style={s.rentalKey}>Collect</Text>
                    <Text style={s.infoDetail}>{formatRentalDateTime(invoice.rental_start)}</Text>
                  </View>
                ) : null}
                {invoice.rental_end ? (
                  <View style={s.rentalRow}>
                    <Text style={s.rentalKey}>Return</Text>
                    <Text style={s.infoDetail}>{formatRentalDateTime(invoice.rental_end)}</Text>
                  </View>
                ) : null}
                {period ? (
                  <View style={s.rentalRow}>
                    <Text style={s.rentalKey}>Period</Text>
                    <Text style={s.infoDetail}>{daysLabel(period)}</Text>
                  </View>
                ) : null}
                {invoice.job_location ? (
                  <Text style={[s.infoDetail, { marginTop: 2 }]}>{invoice.job_location}</Text>
                ) : null}
              </>
            ) : (
              <>
                <Text style={s.label}>Job Details</Text>
                <Text style={s.infoName}>{invoice.job_event}</Text>
                {invoice.job_date ? (
                  <Text style={s.infoDetail}>{invoice.job_date}</Text>
                ) : null}
                {invoice.job_location ? (
                  <Text style={s.infoDetail}>{invoice.job_location}</Text>
                ) : null}
              </>
            )}
            <Text style={[s.label, { marginTop: 10 }]}>Payment Terms</Text>
            {/* T&C 2.1: a rental is confirmed only once paid in full, so the
                business's usual "within 30 days" terms don't apply. */}
            <Text style={s.infoDetail}>
              {isRental ? "Payment in full before collection" : business.payment_terms}
            </Text>
          </View>
        </View>

        {/* ── line items table ── */}
        <View style={s.tableContainer}>
          <View style={s.tableHead}>
            <Text style={[s.tableHeadText, s.cellDesc, isRental ? { flex: 3.6 } : {}]}>{isRental ? "Item" : "Description"}</Text>
            <Text style={[s.tableHeadText, s.cellQty]}>Qty</Text>
            {isRental ? <Text style={[s.tableHeadText, s.cellQty]}>Days</Text> : null}
            <Text style={[s.tableHeadText, s.cellAmt]}>{isRental ? "Day Rate" : "Unit Price"}</Text>
            {isRental ? <Text style={[s.tableHeadText, s.cellAmt, { flex: 1.9 }]}>Repl. Value</Text> : null}
            <Text style={[s.tableHeadText, s.cellTot]}>Amount</Text>
          </View>
          {invoice.line_items.map((li, i) => (
            <View
              key={i}
              wrap={false}
              style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}, isRental ? { paddingVertical: 6 } : {}]}
            >
              {li.print ? (() => {
                // The breakdown only appears when the charged price is the
                // rate-card price — an overridden price would make it not add up.
                const calc = printBreakdown(li.print);
                const spec = printSpecLine(li.print);
                return (
                  <View style={s.cellDesc}>
                    <Text style={s.cellText}>{li.description}</Text>
                    {spec ? <Text style={s.cellSub}>{spec}</Text> : null}
                    {calc && calc.totalCents === li.unitPriceCents ? (
                      <Text style={s.cellSub}>
                        Material {formatSGD(calc.materialCents)} + Print time {formatSGD(calc.timeCents)}
                        {li.print.multiColour ? " (incl. multi-colour +20%)" : ""}
                      </Text>
                    ) : null}
                  </View>
                );
              })() : (
                <Text style={[s.cellText, s.cellDesc, isRental ? { flex: 3.6 } : {}]}>{li.description}</Text>
              )}
              <Text style={[s.cellText, s.cellQty]}>{li.qty}</Text>
              {isRental ? (
                <Text style={[s.cellText, s.cellQty]}>{li.rental ? li.rental.days : "—"}</Text>
              ) : null}
              <Text style={[s.cellText, s.cellAmt]}>
                {formatSGD(li.unitPriceCents)}
              </Text>
              {isRental ? (
                // Not charged — the T&C's Replacement Value, so muted.
                <Text style={[s.cellText, s.cellAmt, { flex: 1.9, color: C.light }]}>
                  {li.rental?.replacementCents ? formatSGD(li.rental.replacementCents) : "—"}
                </Text>
              ) : null}
              <Text style={[s.cellTextBold, s.cellTot]}>
                {formatSGD(lineTotalCents(li))}
              </Text>
            </View>
          ))}
        </View>

        {/* ── totals ── */}
        <View style={s.totalsContainer} wrap={false}>
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
                  <Text style={[s.totalValue, { color: C.danger }]}>
                    -{formatSGD(disc)}
                  </Text>
                </View>
              </>
            )}
            <View style={[s.totalRowFinal, isReceipt ? { backgroundColor: C.sage } : {}]}>
              <Text style={s.totalLabelFinal}>{isReceipt ? "TOTAL PAID" : "TOTAL DUE"}</Text>
              {/* Apex orange clashes with the green paid bar; white reads cleanly. */}
              <Text style={[s.totalValueFinal, isReceipt && sheet === SHEETS.apex ? { color: C.white } : {}]}>
                {formatSGD(invoice.total_cents)}
              </Text>
            </View>
          </View>
        </View>

        {/* ── payment info + QR (invoice) / confirmation (receipt) ── */}
        {isReceipt ? (
          <View style={s.paymentSection} wrap={false}>
            <View style={[s.paymentInfo, { backgroundColor: C.sageBg }]}>
              <Text style={[s.paymentLabel, { color: C.sage }]}>Payment Received</Text>
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
        <View style={[s.paymentSection, isRental ? { marginTop: 12 } : {}]} wrap={false}>
          <View style={s.paymentInfo}>
            <Text style={s.paymentLabel}>Payment Information</Text>
            {business.paynow_number && (
              <Text style={s.paymentText}>
                Scan the QR code to PayNow the exact amount,{"\n"}
                or PayNow directly to{" "}
                <Text style={s.paymentHighlight}>{paynowDisplay(business.paynow_number)}</Text>
              </Text>
            )}
            <Text style={[s.paymentText, { marginTop: 4 }]}>
              Reference:{" "}
              <Text style={s.paymentHighlight}>{invoice.invoice_number}</Text>
            </Text>
            {business.payee_name && (
              <Text style={[s.paymentText, { marginTop: 8 }]}>
                Cheques crossed, payable to{" "}
                <Text style={s.paymentHighlight}>{business.payee_name}</Text>
              </Text>
            )}
            {business.bank_details && <Text style={s.paymentText}>{business.bank_details}</Text>}
            {isRental ? (
              <View style={s.termsNotice}>
                {attachTerms ? (
                  <Text style={s.termsNoticeText}>
                    This rental is subject to the attached{" "}
                    <Text style={{ fontWeight: 700, color: C.dark }}>Equipment Rental Terms {"&"} Conditions</Text>
                    , which form part of this invoice. Please sign the acknowledgement on the last page before collection.
                  </Text>
                ) : (
                  <Text style={s.termsNoticeText}>
                    This rental is subject to the Apex Cinematics{" "}
                    <Text style={{ fontWeight: 700, color: C.dark }}>Equipment Rental Terms {"&"} Conditions</Text>
                    {" "}provided separately, which form part of this invoice.
                  </Text>
                )}
              </View>
            ) : null}
          </View>
          {qr && (
            <View style={[s.qrContainer, isRental ? { padding: 10 } : {}]}>
              <Image style={s.qr} src={qr} />
              <Text style={s.qrCaption}>PAYNOW</Text>
              <Text style={s.qrAmount}>{formatSGD(invoice.total_cents)}</Text>
            </View>
          )}
        </View>
        )}

        {/* ── footer ── */}
        <View style={s.footer} fixed>
          <View style={s.footerBar}>
            <Text style={s.footerText}>THANK YOU FOR YOUR BUSINESS</Text>
            <Text style={s.footerDot}>·</Text>
            <Text style={s.footerText}>
              {business.name.toUpperCase()}
            </Text>
          </View>
        </View>
      </Page>
      {attachTerms && !isReceipt ? (
        <RentalTermsPage s={s} invoiceNumber={invoice.invoice_number ?? "DRAFT"} />
      ) : null}
    </Document>
  );
}

/* ── Equipment Rental T&C, appended to rental invoices ─────────────────
   Flows over as many pages as it needs. The Renter Acknowledgement is kept
   whole and carries the invoice number pre-filled — that is what ties a
   signed copy to this invoice (T&C clause 1.2). Name, contact, signature
   and date are left blank for the renter. */
function RentalTermsPage({
  s,
  invoiceNumber,
}: {
  s: ReturnType<typeof makeStyles>;
  invoiceNumber: string;
}) {
  return (
    <Page size="A4" style={s.page}>
      <View style={s.topBars} fixed>
        <View style={s.topBar} />
        <View style={s.topBarAccent} />
      </View>

      <View style={s.tcHeader}>
        <View>
          <Text style={s.tcEyebrow}>Apex Cinematics</Text>
          <Text style={s.tcTitle}>{RENTAL_TERMS_TITLE}</Text>
          <Text style={s.tcSubtitle}>{RENTAL_TERMS_SUBTITLE}</Text>
        </View>
        <View>
          <Text style={[s.label, { textAlign: "right", marginBottom: 2 }]}>For Invoice No.</Text>
          <Text style={s.tcRefNumber}>{invoiceNumber}</Text>
        </View>
      </View>
      <View style={s.divider} />

      <View style={s.tcBody}>
        <Text style={s.tcIntro}>{RENTAL_TERMS_INTRO}</Text>

        {RENTAL_TERMS.map((sec) => {
          const clause = (c: (typeof sec.clauses)[number], i: number) => (
            // Clauses are a few lines at most: keep each whole so a number is
            // never stranded at a page foot with its text on the next page.
            <View key={i} style={s.tcClause} wrap={false}>
              <Text style={s.tcNum}>{sec.n}.{i + 1}</Text>
              <View style={s.tcFill}>
                <Text style={s.tcText}>
                  {c.lead ? <Text style={s.tcLead}>{c.lead} </Text> : null}
                  {c.text}
                </Text>
                {c.sub?.map((item, j) => (
                  <View key={j} style={s.tcSubRow}>
                    <Text style={s.tcSubNum}>({String.fromCharCode(97 + j)})</Text>
                    <View style={s.tcFill}><Text style={s.tcText}>{item}</Text></View>
                  </View>
                ))}
                {c.after ? <Text style={[s.tcText, { marginTop: 2 }]}>{c.after}</Text> : null}
              </View>
            </View>
          );
          return (
            <View key={sec.n}>
              {/* Heading, any callout and the first clause move as one block,
                  so a heading is never left alone at the foot of a page. */}
              <View wrap={false}>
                <View style={s.tcSectionHead}>
                  <Text style={s.tcSectionNum}>{String(sec.n).padStart(2, "0")}</Text>
                  <Text style={s.tcSectionTitle}>{sec.title}</Text>
                </View>
                {sec.callout ? (
                  <View style={s.tcCallout}>
                    {sec.callout.heading ? <Text style={s.tcCalloutHead}>{sec.callout.heading}</Text> : null}
                    <Text style={s.tcCalloutText}>{sec.callout.text}</Text>
                  </View>
                ) : null}
                {clause(sec.clauses[0], 0)}
              </View>
              {sec.clauses.slice(1).map((c, i) => clause(c, i + 1))}
            </View>
          );
        })}

        <View style={s.ack} wrap={false}>
          <Text style={s.ackTitle}>{RENTAL_ACK.title}</Text>
          <Text style={s.tcText}>{RENTAL_ACK.intro}</Text>
          {RENTAL_ACK.points.map((pt, i) => (
            <View key={i} style={s.ackPoint}>
              <Text style={s.ackBullet}>•</Text>
              <View style={s.tcFill}><Text style={s.tcText}>{pt}</Text></View>
            </View>
          ))}

          <View style={s.ackFields}>
            <View style={s.ackField}>
              <Text style={s.label}>Invoice No.</Text>
              <View style={s.ackPrefilled}>
                <Text style={s.ackPrefilledText}>{invoiceNumber}</Text>
              </View>
            </View>
            <View style={s.ackField}>
              <Text style={s.label}>Date</Text>
              <View style={s.ackLine} />
            </View>
          </View>
          <View style={s.ackFields}>
            <View style={s.ackField}>
              <Text style={s.label}>Full name</Text>
              <View style={s.ackLine} />
            </View>
            <View style={s.ackField}>
              <Text style={s.label}>Contact number</Text>
              <View style={s.ackLine} />
            </View>
          </View>
          <View style={s.ackFields}>
            <View style={s.ackField}>
              <Text style={s.label}>Signature</Text>
              <View style={s.ackSignLine} />
            </View>
          </View>
        </View>
      </View>

      <View style={s.footer} fixed>
        <View style={s.footerBar}>
          <Text style={s.footerText}>EQUIPMENT RENTAL T&amp;C</Text>
          <Text style={s.footerDot}>·</Text>
          <Text style={s.footerText}>INVOICE {invoiceNumber}</Text>
          <Text style={s.footerDot}>·</Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) => `PAGE ${pageNumber} OF ${totalPages}`}
          />
        </View>
      </View>
    </Page>
  );
}
