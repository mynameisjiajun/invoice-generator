import type { DiscountType, LineItem } from "./money";
import type { DocType } from "./types";
import type { ContractSettings } from "./shootTerms";
import { plusDaysIso, todayLocalIso } from "./date";

export type FormState = {
  invoiceId?: string;
  /** Which business this in-progress form belongs to. Persisted so a form
   *  restored after a business switch can't carry the previous business's
   *  customer (or draft id) into the new one — see loadForm(). */
  businessId?: string;
  issueDate: string;
  dueDate: string;
  /** Whether the owner has deliberately set these dates. Until they have,
   *  the dates are just defaults and are re-derived from "today" whenever
   *  the form is restored — an autosaved form is otherwise frozen at the
   *  day it was last typed into, which silently backdates the invoice.
   *  Once touched, a deliberate backdate is never overwritten. */
  issueTouched?: boolean;
  dueTouched?: boolean;
  customerId: number | null;
  newCustomer: { name: string; company: string; phone: string; email: string; uen: string; address: string } | null;
  jobEvent: string;
  jobDate: string;
  jobLocation: string;
  lineItems: LineItem[];
  discountType: DiscountType;
  discountValue: number;
  /** Equipment rental (photo businesses): rental period as datetime-local
   *  strings. Optional so forms autosaved before rentals existed still load. */
  isRental?: boolean;
  rentalStart?: string;
  rentalEnd?: string;
  /** Attach the rental T&C to the PDF; undefined = yes. */
  rentalTerms?: boolean;
  /** "quote" forms autosave separately, so a half-typed quote never comes
   *  back as an invoice (and vice versa). Undefined = invoice. */
  docType?: DocType;
  /** Deposit asked upfront on shoot invoices, in percent (0 = none). */
  depositPercent?: number;
  /** Shoot agreement clauses for this client; null = no contract. */
  contract?: ContractSettings | null;
  /** ISO date for the calendar ("" = not set). */
  shootDate?: string;
};

/** Default due date: invoices are due in 30 days; quotes are valid 14. */
export function defaultDueDays(docType: DocType | undefined): number {
  return docType === "quote" ? 14 : 30;
}

/** No deposit unless the owner turns one on: deposits are only taken for
 *  far-off dates, multi-part projects, weddings and uncertain clients. */
export const DEFAULT_DEPOSIT_PERCENT = 0;

const KEY = "jjv.invoice.form.v1";
const QUOTE_KEY = "jjv.quote.form.v1";
const keyFor = (docType: DocType | undefined) => (docType === "quote" ? QUOTE_KEY : KEY);

export function emptyForm(docType: DocType = "invoice"): FormState {
  const issueDate = todayLocalIso();
  return {
    docType,
    depositPercent: DEFAULT_DEPOSIT_PERCENT,
    issueDate,
    dueDate: plusDaysIso(issueDate, defaultDueDays(docType)),
    issueTouched: false,
    dueTouched: false,
    customerId: null,
    newCustomer: null,
    jobEvent: "",
    jobDate: "",
    jobLocation: "",
    lineItems: [{ description: "", qty: 1, unitPriceCents: 0 }],
    discountType: "none",
    discountValue: 0,
    isRental: false,
    rentalStart: "",
    rentalEnd: "",
    rentalTerms: true,
  };
}

export function storeForm(s: FormState): void {
  localStorage.setItem(keyFor(s.docType), JSON.stringify(s));
}

/** Rolls untouched dates forward to today.
 *
 *  The form autosaves to localStorage on every keystroke and is restored the
 *  next time "New Invoice" is opened — days or weeks later. Its `issueDate`
 *  was stamped by emptyForm() on whatever day the form was started, so
 *  without this an invoice created today goes out dated last Tuesday, and
 *  nothing on screen looks wrong enough to notice.
 *
 *  Only untouched dates move. A deliberately backdated invoice (last month's
 *  job, invoiced now) stays exactly where the owner put it — which is why
 *  this keys off the touched flags rather than just comparing to today.
 *
 *  A due date that is still tracking issue + 30 follows the issue date along;
 *  one that was set by hand does not. Forms saved before these flags existed
 *  have them undefined, and so are treated as untouched — correct for the
 *  common case of a stale scratch form. */
function refreshDates(form: FormState): FormState {
  if (form.issueTouched) return form;
  const issueDate = todayLocalIso();
  if (issueDate === form.issueDate) return form;
  return {
    ...form,
    issueDate,
    dueDate: form.dueTouched ? form.dueDate : plusDaysIso(issueDate, defaultDueDays(form.docType)),
  };
}

/** Restores the autosaved form for `businessId`.
 *
 *  The autosaved form outlives a business switch, so a form saved under
 *  business A can be restored while business B is active. Carrying A's
 *  `customerId` into B's invoice produces an invoice whose customer belongs
 *  to a different business (this happened in production: a JJ Gears & Prints
 *  draft pointing at a JJ Visuals client), and carrying A's `invoiceId` is
 *  worse still — saving would overwrite A's draft with B's data.
 *
 *  So when the stored form belongs to a different business — or predates
 *  this field, where we can't tell — the business-specific bits are dropped
 *  and the rest of the typing (job details, line items) is preserved. */
export function loadForm(businessId?: string, docType: DocType = "invoice"): FormState | null {
  try {
    const raw = localStorage.getItem(keyFor(docType));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || !("lineItems" in parsed)) return null;
    const form = refreshDates({ ...(parsed as FormState), docType });
    if (businessId && form.businessId === businessId) return form;
    return { ...form, businessId, invoiceId: undefined, customerId: null, newCustomer: null };
  } catch {
    return null;
  }
}

export function clearForm(docType: DocType = "invoice"): void {
  localStorage.removeItem(keyFor(docType));
}
