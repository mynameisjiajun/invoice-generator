// Apex Cinematics — Equipment Rental Agreement, Terms & Conditions.
//
// Transcribed verbatim from "T&C Apex Cinematics Rentals.docx" (rebuilt
// 2026-11-09). Rental invoices append these to their PDF, ending with the
// Renter Acknowledgement whose Invoice No. is pre-filled — that is what ties
// a signed copy to its invoice (see the "Invoice" definition, clause 1.2).
//
// Clause numbers are positional (section n, clause index + 1), so the text's
// cross-references ("Section 6.4", "Section 11.6") depend on the ORDER below.
// rentalTerms.test.ts checks every cross-reference still resolves. If the
// Word doc changes, update this file to match it word for word.

export type Clause = {
  /** Bold lead-in: a defined term in section 1, or a label like "Risk:". */
  lead?: string;
  text: string;
  /** Lettered sub-items (a), (b), … */
  sub?: string[];
  /** Text after the sub-items, back at clause indentation. */
  after?: string;
};

export type Section = {
  n: number;
  title: string;
  callout?: { heading?: string; text: string };
  clauses: Clause[];
};

export const RENTAL_TERMS_TITLE = "Equipment Rental Agreement";
export const RENTAL_TERMS_SUBTITLE = "Terms & Conditions";

export const RENTAL_TERMS_INTRO =
  "These Terms and Conditions (“Terms”) govern the rental of equipment from Apex Cinematics (UEN 53533808B), a sole proprietorship registered in Singapore and owned by Chua Jia Jun (“Apex Cinematics”, “we”, “us”, “our”). By signing this Agreement, confirming a booking in writing, or collecting the Equipment, the Renter (“you”) agrees to be fully bound by these Terms. Please read them carefully, especially Sections 6, 7 and 8, which set out your liability for damage, loss and theft and limit ours.";

export const RENTAL_TERMS: Section[] = [
  {
    n: 1,
    title: "Definitions",
    clauses: [
      { lead: "Agreement", text: "means these Terms together with the Invoice and any variation agreed in writing. The Invoice prevails over these Terms only as to the Equipment, dates and amounts stated on it." },
      { lead: "Invoice", text: "means the invoice or booking confirmation issued by Apex Cinematics for the rental, which sets out the Equipment, the Rental Period, the Rental Fee, any Security Deposit and, where stated, the Replacement Value of each item. The invoice number is recorded on the signature section of this Agreement." },
      { lead: "Equipment", text: "means all cameras, lenses, tripods, lighting, grip, audio gear, monitors, batteries, chargers, memory cards, cables, accessories, cases and packaging supplied by Apex Cinematics, whether or not each individual item is listed on the Invoice." },
      { lead: "Rental Period", text: "means the period from when the Equipment is collected by or delivered to the Renter until it is returned to, and accepted by, Apex Cinematics at the agreed return location." },
      { lead: "Rental Fee", text: "means the fee stated on the Invoice for the rental of the Equipment. Day Rate means the daily rental rate of the relevant item." },
      { lead: "Security Deposit", text: "means any deposit we require as security for the Renter’s obligations under this Agreement." },
      { lead: "Replacement Value", text: "means the value stated on the Invoice for each item. Where no value is stated, it means the current price of a new item of the same or nearest equivalent model from an authorised retailer in Singapore, including delivery and any applicable taxes." },
      { lead: "Renter", text: "means the person who signs this Agreement and any person or organisation named as the customer on the Invoice. Where that person rents on behalf of a company or other organisation, “Renter” means both that organisation and the individual, who are jointly and severally liable (see Section 11.6)." },
    ],
  },
  {
    n: 2,
    title: "Booking and Payment",
    clauses: [
      { text: "A booking is confirmed only when we have received full payment of the Invoice, including the Rental Fee (and the Security Deposit, if required) and the Renter has accepted this Agreement." },
      { text: "This Agreement may be accepted by signing it physically or electronically, by confirming acceptance in writing (including by email, WhatsApp or other messaging service), or by collecting the Equipment. Electronic signatures and copies are as valid as originals." },
      { text: "We may require a Security Deposit of an amount we decide based on the value of the Equipment. We will refund it within 7 days after the Equipment is returned and inspected, less any amounts owed under this Agreement. The Security Deposit is not a limit on the Renter’s liability." },
      { text: "All amounts are in Singapore Dollars. Any other charges under this Agreement (including late fees, repair, replacement, cleaning and Loss of Use charges) are payable within 7 days of our invoice. Overdue amounts bear interest at 1% per month until paid in full." },
      { text: "We may decline or cancel any booking before collection, including where identity verification is not completed to our satisfaction, in which case we will refund all amounts paid for that booking." },
    ],
  },
  {
    n: 3,
    title: "Identity Verification and Personal Data",
    clauses: [
      { text: "The Renter must present a valid original photo identification document (e.g. NRIC, passport, driving licence or work pass) at collection so that we can verify their identity. We will sight the document and will not retain the physical document." },
      { text: "For high-value rentals or first-time Renters, we may request additional verification (such as proof of address, company registration details or a higher Security Deposit) and may decline the rental if we are not satisfied." },
      { text: "The Renter consents to Apex Cinematics collecting, using and disclosing the Renter’s personal data (including name, contact details, address and identification details) for the purposes of administering the rental, verifying identity, and recovering the Equipment or any amounts owed, including disclosure to the police, insurers, service centres, lawyers, debt collection agencies and the courts. We handle personal data in accordance with the Personal Data Protection Act 2012 and keep it only for as long as necessary for these purposes." },
    ],
  },
  {
    n: 4,
    title: "Collection and Return",
    clauses: [
      { lead: "Inspection at collection:", text: "The Renter must inspect the Equipment at collection to check that it is complete and in good working order. Any defects, missing items or existing marks must be reported to us in writing (for example, photos sent by WhatsApp or email) before the Equipment leaves our premises, or within 1 hour of delivery. Equipment not so reported is deemed complete and in good condition." },
      { lead: "Condition record:", text: "We may photograph or video the Equipment at collection and at return. These records, together with any written reports under Section 4.1, are evidence of the Equipment’s condition. The Renter is encouraged to take their own photos at collection." },
      { lead: "Timely return:", text: "The Equipment must be returned by the agreed date and time, at the agreed location, complete, clean and packed in the same manner as supplied." },
      { lead: "Late returns:", text: "Late returns are charged at the full Day Rate for every 24-hour period (or part thereof) that the Equipment is late. Extensions are subject to availability and must be approved by us in writing in advance." },
      { lead: "Non-return:", text: "If the Equipment is not returned within 48 hours after the end of the Rental Period without our written agreement, and the Renter fails to respond to our attempts to contact them, we may treat the Equipment as lost, charge the full Replacement Value under Section 6.4, and report the matter to the police. Late fees continue to accrue until the Equipment is returned or the Replacement Value is paid in full, whichever is earlier." },
      { lead: "Inspection after return:", text: "Our acceptance of the Equipment at return does not confirm that it is free of damage, as some faults only appear on testing. We will inspect and test the Equipment within 3 working days of its return and notify the Renter in writing, with photos, of any damage, fault or missing item found." },
      { lead: "Cleaning:", text: "If the Equipment is returned dirty, sandy, wet or contaminated (including with smoke, haze fluid or residue), we may charge a reasonable cleaning fee." },
      { lead: "Data:", text: "The Renter is solely responsible for backing up and removing their footage and data before return. We will format all storage media after return and are not responsible for any data or footage left on, or lost from, the Equipment." },
    ],
  },
  {
    n: 5,
    title: "Use of Equipment",
    clauses: [
      { text: "The Renter must use the Equipment carefully, professionally and properly, in accordance with the manufacturer’s instructions and its intended use, and only by competent persons." },
      { text: "The Renter must not open, modify, alter, repair, update the firmware of, or remove labels or serial numbers from the Equipment without our prior written consent." },
      { text: "The Renter is responsible for the security and safekeeping of the Equipment throughout the Rental Period. The Equipment must not be left unattended in public places, in unattended vehicles, or in any unsecured location." },
      { text: "The Equipment remains the property of Apex Cinematics at all times. The Renter must not sub-let, lend, sell, pledge, assign or otherwise part with the Equipment. Crew members may use the Equipment only under the Renter’s direct supervision, and the Renter remains fully responsible for their acts and omissions." },
      { text: "The Renter must not take the Equipment outside Singapore without our prior written consent." },
      { text: "Unless we have agreed in writing and suitable protection is used, the Renter must not expose the Equipment to rain, water, sand, salt spray, extreme heat, smoke or haze machines, pyrotechnics or chemicals, or mount it on vehicles, drones, cranes or other rigs." },
      { text: "The Renter must comply with all applicable laws, regulations and permit requirements when using the Equipment (including location and filming permits, and privacy and intellectual property laws), and must not use the Equipment for any unlawful purpose." },
      { text: "If the Equipment malfunctions, the Renter must stop using it immediately and notify us. The Renter must not attempt to repair it." },
    ],
  },
  {
    n: 6,
    title: "Damage, Loss and Theft",
    callout: {
      heading: "IMPORTANT: PLEASE READ CAREFULLY",
      text: "You are responsible for the Equipment from collection until we accept its return. If it is damaged, you pay the full repair cost. If it is lost, stolen or beyond repair, you pay the full Replacement Value, with no deduction for depreciation, plus Loss of Use charges.",
    },
    clauses: [
      { lead: "Risk:", text: "The Renter bears all risk of loss, theft and damage to the Equipment from the start of the Rental Period until it is returned to and accepted by Apex Cinematics, however caused, including by accident, the acts of third parties, or events outside the Renter’s control. This includes, without limitation, damage from dropping, impact, water, sand, fire, mishandling and electrical faults. The Renter is not liable for normal wear and tear, defects recorded at collection, or damage caused by our own negligence." },
      { lead: "Notification:", text: "The Renter must notify us immediately, and in any event within 12 hours, of any damage, loss or theft. In the case of theft or suspected theft, the Renter must make a police report within 24 hours, give us a copy, and cooperate fully with us, the police and any insurer." },
      { lead: "Repairable damage:", text: "If the Equipment is damaged, the Renter must pay the full cost of repair as quoted by an authorised service centre or qualified technician, together with reasonable diagnostic and transport costs. We will provide a copy of the quotation or invoice on request." },
      { lead: "Loss, theft or irreparable damage:", text: "If the Equipment is lost, stolen, not returned, or damaged beyond economical repair, the Renter must pay its full Replacement Value without any deduction for depreciation. Equipment is “beyond economical repair” where the repair cost would exceed 60% of its Replacement Value, as assessed by an authorised service centre or qualified technician." },
      { lead: "Recovered Equipment:", text: "If Equipment for which the Renter has paid the Replacement Value is later recovered in good working order, we will refund the Replacement Value paid, less any repair costs and Loss of Use charges." },
      { lead: "Loss of Use:", text: "In addition to repair or replacement costs, the Renter must pay the Day Rate of the affected item for each day it is unavailable for rental while being repaired or replaced, up to a maximum of 30 days." },
      { lead: "Payment and deduction:", text: "We may deduct any amount owed under this Section from the Security Deposit. Any balance is payable in accordance with Section 2.4." },
      { lead: "Insurance:", text: "The Renter is responsible for insuring the Equipment for its full Replacement Value during the Rental Period and may be asked to provide proof of insurance for high-value rentals. Any insurance held by Apex Cinematics is for our sole benefit and does not reduce the Renter’s liability." },
      { lead: "Recovery costs:", text: "The Renter must pay all costs we reasonably incur in recovering the Equipment or any amount owed under this Agreement, including legal costs (on an indemnity basis) and collection agency fees." },
    ],
  },
  {
    n: 7,
    title: "Renter’s Indemnity",
    clauses: [
      {
        text: "The Renter shall indemnify and keep Apex Cinematics and its owner indemnified against all claims, losses, damages, fines, penalties, costs and expenses (including legal costs) arising from or in connection with:",
        sub: [
          "the possession, use, transport or operation of the Equipment during the Rental Period;",
          "any death, personal injury or damage to property suffered by any third party caused by or involving the Equipment during the Rental Period;",
          "any breach of this Agreement by the Renter; or",
          "any breach of law by the Renter, or any content created using the Equipment,",
        ],
        after: "except to the extent caused by the negligence of Apex Cinematics.",
      },
    ],
  },
  {
    n: 8,
    title: "Equipment Faults and Our Liability",
    callout: {
      text: "Please test all Equipment before your shoot. If Equipment fails, our liability is limited to repairing or replacing it or refunding the Rental Fee for that item. We are not responsible for reshoot costs, crew, talent or location fees, lost footage or lost income.",
    },
    clauses: [
      { text: "We will take reasonable care to supply the Equipment clean and in good working order. The Renter is responsible for deciding whether the Equipment is suitable for their intended purpose and for testing it before use." },
      { text: "If any Equipment is faulty through no fault of the Renter, and the Renter notifies us on the day the fault is discovered, we will, at our option, repair or replace the item (where available) or refund the Rental Fee for that item for the affected period. This is the Renter’s sole remedy for faulty Equipment." },
      { text: "We are not liable for any loss of profit, revenue, business, opportunity, goodwill, footage or data, or for any reshoot, crew, talent, location, travel or other production costs, or for any indirect or consequential loss, however arising." },
      { text: "Our total liability arising from or in connection with any rental is limited to the Rental Fee paid for that rental." },
      { text: "Nothing in this Agreement excludes or limits our liability for death or personal injury caused by our negligence, for fraud, or for any other liability that cannot be excluded or limited under Singapore law." },
    ],
  },
  {
    n: 9,
    title: "Cancellation and Rescheduling",
    clauses: [
      { text: "Cancellations made more than 24 hours before the start of the Rental Period will receive a full refund of the Rental Fee." },
      { text: "Cancellations made less than 24 hours before the start of the Rental Period, and failures to collect, are non-refundable, and the full Rental Fee will be charged." },
      { text: "Requests to reschedule are subject to availability and our approval." },
      { text: "No refund is given for Equipment returned before the end of the Rental Period." },
      { text: "If we are unable to provide the Equipment for any reason (for example, damage by a previous renter or circumstances beyond our control), we will notify the Renter as soon as possible and refund all amounts paid for the affected Equipment. We have no further liability for such cancellation." },
    ],
  },
  {
    n: 10,
    title: "Termination",
    clauses: [
      { text: "We may terminate this Agreement immediately by written notice if the Renter breaches this Agreement, has provided false or misleading information, or if we reasonably believe the Equipment is at risk. On termination, the Renter must return the Equipment immediately at their own cost and give us all reasonable assistance to recover it." },
      { text: "Termination does not affect any rights or liabilities that have accrued before termination. Sections 6, 7, 8, 11 and 12 continue to apply after this Agreement ends." },
    ],
  },
  {
    n: 11,
    title: "General",
    clauses: [
      { lead: "Entire agreement:", text: "This Agreement is the entire agreement between the parties about the rental and replaces any earlier discussions or understandings." },
      { lead: "Variation:", text: "Any variation must be agreed in writing, which includes email or WhatsApp messages from Apex Cinematics." },
      { lead: "Severability:", text: "If any provision is found to be invalid or unenforceable, it shall be limited to the minimum extent necessary and the remaining provisions shall continue in full force." },
      { lead: "No waiver:", text: "Any delay or failure by us to enforce a right is not a waiver of that right." },
      { lead: "Notices:", text: "Notices may be given by email or messaging service to the contact details provided by the Renter." },
      { lead: "Renting for a company:", text: "Where the Renter signs on behalf of a company or organisation, the individual signing confirms that they are authorised to do so and personally guarantees, jointly and severally with that company or organisation, the performance of all obligations and payment of all amounts under this Agreement." },
      { lead: "Assignment:", text: "The Renter may not assign or transfer this Agreement. We may assign our rights under this Agreement." },
      { lead: "Third parties:", text: "No person other than the parties has any right under the Contracts (Rights of Third Parties) Act 2001 to enforce any term of this Agreement." },
    ],
  },
  {
    n: 12,
    title: "Governing Law and Disputes",
    clauses: [
      { text: "This Agreement is governed by the laws of the Republic of Singapore." },
      { text: "The parties will first try in good faith to resolve any dispute within 14 days of written notice. If unresolved, the parties submit to the exclusive jurisdiction of the courts and tribunals of Singapore, including the Small Claims Tribunals where applicable." },
    ],
  },
];

export const RENTAL_ACK = {
  title: "Renter Acknowledgement",
  intro:
    "By signing below, I confirm that I have read, understood and agree to these Terms for the rental on the Invoice stated below. In particular, I understand that:",
  points: [
    "I am responsible for the Equipment from collection until it is returned, and will pay the full repair cost or the full Replacement Value (no depreciation) if it is damaged, lost or stolen (Section 6);",
    "I will cover any claims from third parties arising from my use of the Equipment (Section 7);",
    "Apex Cinematics is not liable for reshoot, crew, talent or location costs, lost footage or lost income, and its liability is capped at the Rental Fee (Section 8);",
    "I checked the Equipment at collection and will report any defects in writing straight away (Section 4.1).",
  ],
};

/** Every word of the agreement, in reading order — used by tests to check
 *  the transcription against the source document. */
export function rentalTermsPlainText(): string {
  const parts: string[] = [RENTAL_TERMS_INTRO];
  for (const s of RENTAL_TERMS) {
    if (s.callout) parts.push([s.callout.heading, s.callout.text].filter(Boolean).join(" "));
    for (const c of s.clauses) {
      parts.push([c.lead, c.text, ...(c.sub ?? []), c.after].filter(Boolean).join(" "));
    }
  }
  parts.push(RENTAL_ACK.intro, ...RENTAL_ACK.points);
  return parts.join(" ");
}
