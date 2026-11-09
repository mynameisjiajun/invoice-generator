// Deposits and part payments. All money in integer cents.
//
// An invoice can ask for a share upfront (deposit_percent) to confirm a
// shoot; money actually received is recorded as Payment rows. Invoices marked
// paid before payments existed have no rows, so status "paid" alone also
// means fully paid. Rentals never take a deposit (paid in full before
// collection, rental T&C 2.1).

import type { Invoice } from "./types";

export type PaymentState = "unpaid" | "deposit-paid" | "part-paid" | "paid";

/** Money received so far. */
export function paidCents(inv: Invoice): number {
  const sum = (inv.payments ?? []).reduce((s, p) => s + p.amount_cents, 0);
  return inv.status === "paid" ? Math.max(sum, inv.total_cents) : sum;
}

/** The deposit asked for upfront (0 when none applies). */
export function depositCents(inv: Invoice): number {
  if (inv.is_rental) return 0;
  const pct = Number(inv.deposit_percent ?? 0);
  if (!(pct > 0)) return 0;
  return Math.round((inv.total_cents * Math.min(pct, 100)) / 100);
}

/** What the client should pay next: the rest of the deposit while it's
 *  outstanding, then the balance. This is the PayNow QR amount. */
export function dueNowCents(inv: Invoice): number {
  const paid = paidCents(inv);
  if (paid >= inv.total_cents) return 0;
  const deposit = depositCents(inv);
  if (deposit > 0 && paid < deposit) return deposit - paid;
  return inv.total_cents - paid;
}

/** What's still owed in total. */
export function balanceCents(inv: Invoice): number {
  return Math.max(0, inv.total_cents - paidCents(inv));
}

export function paymentState(inv: Invoice): PaymentState {
  const paid = paidCents(inv);
  if (paid >= inv.total_cents && inv.total_cents > 0) return "paid";
  if (paid <= 0) return "unpaid";
  const deposit = depositCents(inv);
  return deposit > 0 && paid >= deposit ? "deposit-paid" : "part-paid";
}

/** "Full payment before the shoot": stored as a 100% upfront share. One
 *  invoice paid once (what clients' finance teams prefer), never called a
 *  deposit in any wording. */
export function isFullUpfront(inv: Invoice): boolean {
  return !inv.is_rental && Number(inv.deposit_percent ?? 0) >= 100;
}

/** True while a deposit was asked for and hasn't been fully received. */
export function depositOutstanding(inv: Invoice): boolean {
  const deposit = depositCents(inv);
  return deposit > 0 && paidCents(inv) < deposit;
}
