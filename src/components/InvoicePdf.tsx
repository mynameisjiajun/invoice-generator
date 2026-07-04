import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { discountCents, formatSGD, lineTotalCents } from "@/lib/money";
import type { Invoice, Settings } from "@/lib/types";

const s = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: "Helvetica", color: "#111" },
  row: { flexDirection: "row" },
  h1: { fontSize: 28, fontFamily: "Helvetica-Bold", letterSpacing: 2 },
  label: { color: "#777", fontSize: 8, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 },
  block: { marginBottom: 16 },
  tableHead: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#111", paddingBottom: 4, marginBottom: 6 },
  cellDesc: { flex: 5 }, cellQty: { flex: 1, textAlign: "right" },
  cellAmt: { flex: 1.5, textAlign: "right" }, cellTot: { flex: 1.5, textAlign: "right" },
  bold: { fontFamily: "Helvetica-Bold" },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", gap: 24, marginTop: 4 },
  qr: { width: 110, height: 110 },
  footer: { position: "absolute", bottom: 40, left: 48, right: 48, textAlign: "center", color: "#999", fontSize: 8 },
});

export default function InvoicePdf({ invoice, settings, qr }: {
  invoice: Invoice; settings: Settings; qr: string;
}) {
  const sub = invoice.subtotal_cents;
  const disc = discountCents(sub, invoice.discount_type, invoice.discount_value);
  return (
    <Document title={`Invoice ${invoice.invoice_number ?? "DRAFT"}`}>
      <Page size="A4" style={s.page}>
        <View style={[s.row, { justifyContent: "space-between", marginBottom: 24 }]}>
          <View>
            <Text style={s.h1}>{settings.business_name.toUpperCase()}</Text>
            <Text>{settings.address}</Text>
            <Text>{settings.phone} · {settings.email}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[s.bold, { fontSize: 16 }]}>INVOICE</Text>
            <Text>No. {invoice.invoice_number}</Text>
            <Text>Date: {invoice.issue_date}</Text>
            {invoice.customer_id != null && <Text>Customer ID: {invoice.customer_id}</Text>}
          </View>
        </View>

        <View style={[s.row, { gap: 32 }, s.block]}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Bill to</Text>
            <Text style={s.bold}>{invoice.customers?.name}</Text>
            {invoice.customers?.address ? <Text>{invoice.customers.address}</Text> : null}
            {invoice.customers?.phone ? <Text>{invoice.customers.phone}</Text> : null}
            {invoice.customers?.email ? <Text>{invoice.customers.email}</Text> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Job</Text>
            <Text style={s.bold}>{invoice.job_event}</Text>
            {invoice.job_date ? <Text>{invoice.job_date}</Text> : null}
            {invoice.job_location ? <Text>{invoice.job_location}</Text> : null}
            <Text style={[s.label, { marginTop: 8 }]}>Payment terms</Text>
            <Text>{settings.payment_terms}</Text>
          </View>
        </View>

        <View style={s.tableHead}>
          <Text style={[s.cellDesc, s.bold]}>DESCRIPTION</Text>
          <Text style={[s.cellQty, s.bold]}>QTY</Text>
          <Text style={[s.cellAmt, s.bold]}>UNIT</Text>
          <Text style={[s.cellTot, s.bold]}>TOTAL</Text>
        </View>
        {invoice.line_items.map((li, i) => (
          <View key={i} style={[s.row, { marginBottom: 6 }]}>
            <Text style={s.cellDesc}>{li.description}</Text>
            <Text style={s.cellQty}>{li.qty}</Text>
            <Text style={s.cellAmt}>{formatSGD(li.unitPriceCents)}</Text>
            <Text style={s.cellTot}>{formatSGD(lineTotalCents(li))}</Text>
          </View>
        ))}

        <View style={{ borderTopWidth: 1, borderColor: "#111", marginTop: 8, paddingTop: 8 }}>
          {disc > 0 && (
            <>
              <View style={s.totalRow}><Text>Subtotal</Text><Text>{formatSGD(sub)}</Text></View>
              <View style={s.totalRow}>
                <Text>Discount{invoice.discount_type === "percent" ? ` (${invoice.discount_value}%)` : ""}</Text>
                <Text>−{formatSGD(disc)}</Text>
              </View>
            </>
          )}
          <View style={s.totalRow}>
            <Text style={[s.bold, { fontSize: 13 }]}>TOTAL DUE</Text>
            <Text style={[s.bold, { fontSize: 13 }]}>{formatSGD(invoice.total_cents)}</Text>
          </View>
        </View>

        <View style={[s.row, { marginTop: 32, gap: 24 }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Payment</Text>
            <Text>Scan the QR to PayNow the exact amount, or PayNow to &quot;{settings.paynow_number}&quot;.</Text>
            <Text>Reference: {invoice.invoice_number}</Text>
            <Text style={{ marginTop: 6 }}>Cheques crossed, payable to &quot;{settings.payee_name}&quot;.</Text>
            <Text>{settings.bank_details}</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Image style={s.qr} src={qr} />
            <Text style={{ fontSize: 8, marginTop: 4 }}>PayNow · {formatSGD(invoice.total_cents)}</Text>
          </View>
        </View>

        <Text style={s.footer}>THANK YOU FOR YOUR BUSINESS!</Text>
      </Page>
    </Document>
  );
}
