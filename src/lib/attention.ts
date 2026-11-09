// "Needs attention": the short list of things to chase, so the owner never
// has to scan every invoice. Pure, so it's testable; the list screen renders
// whatever this returns (and nothing at all when it's empty).

import { formatJobDate } from "./printRates";
import { formatSGD } from "./money";
import { plusDaysIso } from "./date";
import { balanceCents, depositOutstanding, dueNowCents, isFullUpfront, paymentState } from "./payments";
import { awaitingRentalSignature, isOverdue, type Invoice } from "./types";

export type AttentionItem = {
  key: string;
  href: string;
  /** "warn" = money late or a deadline passed; "info" = worth a nudge. */
  tone: "warn" | "info";
  title: string;
  detail: string;
};

const who = (inv: Invoice) => [inv.customers?.name, inv.job_event].filter(Boolean).join(" · ") || "No client";
const detailHref = (inv: Invoice) => `/invoices_login/invoices/${inv.id}`;

export function attentionItems(invoices: Invoice[], quotes: Invoice[], today: string): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const inv of invoices) {
    if (inv.status === "draft") continue;
    const n = inv.invoice_number ?? "Invoice";
    if (isOverdue(inv)) {
      items.push({
        key: `overdue:${inv.id}`, href: detailHref(inv), tone: "warn",
        title: `${n} overdue · ${formatSGD(balanceCents(inv))}`,
        detail: `${who(inv)} · was due ${inv.due_date ? formatJobDate(inv.due_date) : ""}`.trim(),
      });
      continue;
    }
    if (inv.status === "paid") {
      if (awaitingRentalSignature(inv)) {
        items.push({
          key: `sign:${inv.id}`, href: detailHref(inv), tone: "info",
          title: `${n} ${inv.is_rental ? "rental T&C" : "contract"} not signed`, detail: who(inv),
        });
      }
      continue;
    }
    if (isFullUpfront(inv) && paymentState(inv) === "unpaid") {
      items.push({
        key: `upfront:${inv.id}`, href: detailHref(inv), tone: "info",
        title: `${n} payment before the shoot · ${formatSGD(dueNowCents(inv))}`, detail: who(inv),
      });
    } else if (depositOutstanding(inv)) {
      items.push({
        key: `deposit:${inv.id}`, href: detailHref(inv), tone: "info",
        title: `${n} deposit to collect · ${formatSGD(dueNowCents(inv))}`, detail: who(inv),
      });
    } else if (paymentState(inv) !== "unpaid") {
      items.push({
        key: `balance:${inv.id}`, href: detailHref(inv), tone: "info",
        title: `${n} balance on delivery · ${formatSGD(balanceCents(inv))}`, detail: who(inv),
      });
    }
    if (awaitingRentalSignature(inv)) {
      items.push({
        key: `sign:${inv.id}`, href: detailHref(inv), tone: "info",
        title: `${n} ${inv.is_rental ? "rental T&C" : "contract"} not signed`, detail: who(inv),
      });
    }
  }

  // Quotes: about to lapse (3 days), or lapsed in the last fortnight —
  // a nudge to follow up, then they drop off rather than nag forever.
  for (const q of quotes) {
    if (q.status === "draft" || q.converted_invoice_id || !q.due_date) continue;
    const n = q.invoice_number ?? "Quote";
    if (q.due_date < today && q.due_date >= plusDaysIso(today, -14)) {
      items.push({
        key: `quote-expired:${q.id}`, href: detailHref(q), tone: "warn",
        title: `${n} expired ${formatJobDate(q.due_date)}. Follow up?`, detail: who(q),
      });
    } else if (q.due_date >= today && q.due_date <= plusDaysIso(today, 3)) {
      items.push({
        key: `quote-expiring:${q.id}`, href: detailHref(q), tone: "info",
        title: `${n} expires ${formatJobDate(q.due_date)}`, detail: who(q),
      });
    }
  }

  return items.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "warn" ? -1 : 1));
}
