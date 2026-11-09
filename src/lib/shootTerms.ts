// Apex Cinematics — Shoot Agreement (photo/video services), built per client
// from switchable clauses.
//
// Core sections are always included (what the agreement is, booking and
// payment, the client's responsibilities, liability, general). Optional
// clauses are toggled per invoice; "standard" and "strict" presets set them
// in one tap. Written to the same standard as the rental T&C: Singapore law,
// plain English, reasonableness under the Unfair Contract Terms Act (no
// exclusion of liability for death/injury from negligence or fraud; a fee
// cap rather than a total exclusion), cancellation charges framed as the cost
// of holding the date rather than penalties, and copyright in line with the
// Copyright Act 2021 (the creator owns commissioned footage by default).
//
// Not legal advice: the owner should have this reviewed for large jobs.

import type { Clause, Section } from "./rentalTerms";

export type ClauseId =
  | "deposit_nonrefundable" | "cancellation" | "reschedule"
  | "revisions" | "delivery" | "client_delay" | "raw_footage"
  | "files_on_payment" | "footage_retention" | "usage_portfolio"
  | "late_payment" | "overtime";

/** What an invoice stores (invoices.contract, migration 024). null = no contract. */
export type ContractSettings = {
  preset: "standard" | "strict" | "custom";
  on: ClauseId[];
  revisions: number;
  deliveryDays: number;
};

/** The switches shown in the form, in display order. */
export const CLAUSE_OPTIONS: { id: ClauseId; label: string; hint: string }[] = [
  { id: "deposit_nonrefundable", label: "Deposit is non-refundable", hint: "Only applies when a deposit is set" },
  { id: "cancellation", label: "Cancellation fees", hint: ">14 days: deposit kept · 7–14 days: 50% · <7 days: 100%" },
  { id: "reschedule", label: "One free reschedule", hint: "With more than 7 days' notice, within 6 months" },
  { id: "revisions", label: "Revision rounds included", hint: "Extra rounds or new briefs are quoted" },
  { id: "delivery", label: "Delivery time", hint: "Working days after the shoot" },
  { id: "client_delay", label: "No reply in 14 days = approved", hint: "Stops projects stalling and the balance with them" },
  { id: "raw_footage", label: "Raw footage not included", hint: "Unless it's on the invoice" },
  { id: "files_on_payment", label: "Final files only after full payment", hint: "Previews may be watermarked" },
  { id: "footage_retention", label: "Files kept 3 months after delivery", hint: "Then may be deleted" },
  { id: "usage_portfolio", label: "Copyright stays with you", hint: "Client gets a licence; you can use it in your portfolio" },
  { id: "late_payment", label: "Late payment interest", hint: "1% a month, plus recovery costs" },
  { id: "overtime", label: "Overtime charged hourly", hint: "If the shoot runs past the booked hours" },
];

const STANDARD: ClauseId[] = [
  "deposit_nonrefundable", "cancellation", "reschedule", "revisions", "delivery",
  "raw_footage", "files_on_payment", "footage_retention", "usage_portfolio",
];
/** Strict = standard + the clauses that protect against slow-paying or
 *  slow-replying clients. */
const STRICT: ClauseId[] = [...STANDARD, "client_delay", "late_payment", "overtime"];

export function presetContract(preset: "standard" | "strict"): ContractSettings {
  return { preset, on: [...(preset === "strict" ? STRICT : STANDARD)], revisions: 2, deliveryDays: 14 };
}

/** Which preset a set of switches matches (so the chips stay honest). */
export function matchPreset(on: ClauseId[]): ContractSettings["preset"] {
  const same = (a: ClauseId[], b: ClauseId[]) => a.length === b.length && a.every((x) => b.includes(x));
  return same(on, STRICT) ? "strict" : same(on, STANDARD) ? "standard" : "custom";
}

export const SHOOT_TERMS_TITLE = "Shoot Agreement";
export const SHOOT_TERMS_SUBTITLE = "Terms & Conditions";

export const SHOOT_TERMS_INTRO =
  "These Terms govern the photography and videography services (“Services”) provided by Apex Cinematics (UEN 53533808B), a sole proprietorship registered in Singapore and owned by Chua Jia Jun (“Apex Cinematics”, “we”, “us”, “our”), to the client named on the Invoice (“Client”, “you”). By signing this Agreement, confirming the booking in writing, or paying any part of the Invoice, you agree to these Terms.";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Builds the agreement for one invoice. `depositPercent` decides the
 *  booking wording: 0 = confirmed in writing, 100 = paid in full before the
 *  shoot, otherwise a deposit; null = a blank copy not tied to an invoice,
 *  worded for any of these. Sections are numbered by position. */
export function buildShootTerms(c: ContractSettings, depositPercent: number | null): {
  intro: string; sections: Section[]; ack: { title: string; intro: string; points: string[] };
} {
  const on = (id: ClauseId) => c.on.includes(id);
  const generic = depositPercent === null;
  const pct = depositPercent ?? 0;
  const hasDeposit = generic || (pct > 0 && pct < 100);
  const sections: Omit<Section, "n">[] = [];

  sections.push({
    title: "The Agreement",
    clauses: [
      { lead: "Agreement", text: "means these Terms together with the Invoice (or quote) and any variation agreed in writing, including by email or WhatsApp. The Invoice sets out the Services, deliverables, dates and fees, and prevails over these Terms only as to those details. The invoice number is recorded on the signature section of this Agreement." },
      { lead: "Scope:", text: "Work not described on the Invoice, including additional deliverables, extra shooting time, or changes to the brief after the shoot, is outside the agreed scope and will be quoted separately before we do it." },
    ],
  });

  const booking: Clause[] = [
    generic
      ? { lead: "Confirming the booking:", text: "The booking is confirmed once you accept the quote or Invoice in writing and we have received any deposit or upfront payment it asks for. The rest is due as stated on the Invoice." }
      : pct >= 100
      ? { lead: "Confirming the booking:", text: "The shoot date is reserved for you once we have received full payment of the Invoice, which is due before the shoot." }
      : hasDeposit
        ? { lead: "Confirming the booking:", text: `The shoot date is reserved for you once we have received the deposit of ${pct}% stated on the Invoice. The balance is due on delivery, or as stated on the Invoice.` }
        : { lead: "Confirming the booking:", text: "The booking is confirmed once you accept the quote or Invoice in writing. Payment is due as stated on the Invoice." },
    { text: "All amounts are in Singapore Dollars and payable by PayNow or bank transfer, quoting the invoice number." },
  ];
  if (hasDeposit && on("deposit_nonrefundable")) {
    booking.push({ lead: "Deposit:", text: `${generic ? "Any deposit stated on the Invoice" : "The deposit"} reserves the date exclusively for you and covers other work we turn away to keep it. It is non-refundable if you cancel, but is refunded in full if we cancel.` });
  }
  if (on("late_payment")) {
    booking.push({ lead: "Late payment:", text: "Overdue amounts bear interest at 1% per month from the due date until paid in full. You must also pay the reasonable costs we incur in recovering overdue amounts, including legal costs and collection agency fees." });
  }
  sections.push({ title: "Booking and Payment", clauses: booking });

  const changes: Clause[] = [];
  if (on("cancellation")) {
    changes.push({
      lead: "If you cancel:",
      text: "Cancellation must be in writing. Because the date is held for you and other work is turned away, the following amounts are payable:",
      sub: [
        "more than 14 days before the shoot date: the deposit (if any) is kept and anything else paid is refunded;",
        "7 to 14 days before the shoot date: 50% of the total fee;",
        "less than 7 days before the shoot date, or if you do not attend: the full fee.",
      ],
    });
  }
  if (on("reschedule")) {
    changes.push({ lead: "Rescheduling:", text: "You may move the shoot date once without charge if you give us more than 7 days' written notice, subject to our availability, and the new date falls within 6 months of the original. Any further change, or a change with less notice, is treated as a cancellation unless we agree otherwise in writing." });
  }
  changes.push({ lead: "If we cancel:", text: "If we cannot attend because of illness, injury, emergency or any other reason, we will try to arrange a suitably experienced replacement with your agreement. If that is not possible, we will refund everything you have paid for the affected Services. This refund is the limit of our liability for such a cancellation." });
  if (on("overtime")) {
    changes.push({ lead: "Overtime:", text: "If the shoot runs beyond the booked hours at your request, or because of delays outside our control, the extra time is charged at our hourly rate, which we will confirm with you on the day before continuing." });
  }
  sections.push({ title: "Changes, Cancellation and Overtime", clauses: changes });

  const delivery: Clause[] = [];
  if (on("delivery")) {
    delivery.push({ lead: "Delivery:", text: `We will deliver the final files within ${plural(c.deliveryDays, "working day", "working days")} of the shoot, or of receiving all the materials we need from you, whichever is later. Revision rounds add time to this.` });
  }
  if (on("revisions")) {
    delivery.push({ lead: "Revisions:", text: `The fee includes ${plural(c.revisions, "round", "rounds")} of revisions to the edit. A round is one consolidated list of changes sent in writing. Further rounds, or changes beyond the original brief (for example a new concept, structure or music choice after approval), are charged at a rate we will quote first.` });
  }
  if (on("client_delay")) {
    delivery.push({ lead: "Approvals:", text: "If you do not reply to a draft within 14 days of receiving it, the draft is treated as approved, the project is treated as delivered, and any balance becomes payable." });
  }
  if (on("files_on_payment")) {
    delivery.push({ lead: "Final files:", text: "Final files are released once the Invoice is paid in full. Until then, previews may be watermarked or in lower resolution." });
  }
  if (on("raw_footage")) {
    delivery.push({ lead: "Raw footage:", text: "Raw, unedited footage and photographs are not included and remain with us, unless the Invoice says otherwise." });
  }
  if (on("footage_retention")) {
    delivery.push({ lead: "Storage:", text: "We keep project files for 3 months after delivery, after which we may delete them. Please download and back up your files promptly; we are not responsible for files lost after that period." });
  }
  if (delivery.length) sections.push({ title: "Delivery and Revisions", clauses: delivery });

  if (on("usage_portfolio")) {
    sections.push({
      title: "Copyright and Usage",
      clauses: [
        { lead: "Copyright:", text: "We own the copyright in all footage, photographs and edits we create for you." },
        { lead: "Your licence:", text: "Once the Invoice is paid in full, you may use the final deliverables for your own personal or business purposes, including on social media, websites and in marketing, for as long as you wish. You may not sell or license them to others, or alter them in a way that misrepresents our work, without our written consent." },
        { lead: "Our portfolio:", text: "We may show the work in our portfolio, website and social media. If you would rather we did not, tell us in writing before the shoot and we will keep it private." },
      ],
    });
  }

  sections.push({
    title: "Your Responsibilities",
    clauses: [
      { text: "You are responsible for any permission needed to shoot at the location, and for telling us before the shoot about any restrictions, such as venue rules, filming limits or no-flash areas." },
      { text: "You are responsible for the conduct of your guests and staff during the shoot, and for having the right to use any music, logos, people's likenesses or other material you ask us to include." },
    ],
  });

  sections.push({
    title: "Liability",
    clauses: [
      { text: "We take great care with every shoot, but some things are outside our control, including weather, venue restrictions, the actions of guests or third parties, and equipment or memory card failure despite reasonable precautions. We are not liable for shots or moments missed because of these." },
      { text: "Our total liability arising from or in connection with the Services is limited to the fees you have paid for them. We are not liable for any indirect or consequential loss, including loss of profit, business or opportunity." },
      { text: "Nothing in this Agreement excludes or limits liability for death or personal injury caused by negligence, for fraud, or for any other liability that cannot be excluded or limited under Singapore law." },
    ],
  });

  sections.push({
    title: "General",
    clauses: [
      { lead: "Entire agreement:", text: "This Agreement is the entire agreement about the Services and replaces any earlier discussions. Any change must be agreed in writing, which includes email or WhatsApp." },
      { lead: "Governing law:", text: "This Agreement is governed by the laws of Singapore. We will both first try in good faith to resolve any dispute within 14 days of written notice; if unresolved, the courts and tribunals of Singapore, including the Small Claims Tribunals where applicable, have exclusive jurisdiction." },
    ],
  });

  const points: string[] = [];
  if (hasDeposit && on("deposit_nonrefundable")) points.push(`${generic ? "any deposit" : "the deposit"} secures the date and is non-refundable if I cancel;`);
  if (on("cancellation")) points.push("cancellation charges apply as set out in these Terms;");
  if (on("files_on_payment")) points.push("final files are released once the Invoice is paid in full;");
  if (on("usage_portfolio")) points.push("Apex Cinematics owns the copyright and grants me a licence to use the final deliverables;");
  points.push("Apex Cinematics' liability is limited to the fees paid for the Services.");

  return {
    intro: SHOOT_TERMS_INTRO,
    sections: sections.map((s, i) => ({ ...s, n: i + 1 })),
    ack: {
      title: "Client Acknowledgement",
      intro: "By signing below, I confirm that I have read, understood and agree to these Terms for the Services on the Invoice stated below. In particular, I understand that:",
      points,
    },
  };
}
