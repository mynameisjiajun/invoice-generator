import type { DiscountType, LineItem } from "./money";

export type FormState = {
  invoiceId?: string;
  issueDate: string;
  dueDate: string;
  customerId: number | null;
  newCustomer: { name: string; company: string; phone: string; email: string; uen: string; address: string } | null;
  jobEvent: string;
  jobDate: string;
  jobLocation: string;
  lineItems: LineItem[];
  discountType: DiscountType;
  discountValue: number;
};

const KEY = "jjv.invoice.form.v1";

export function plusDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function emptyForm(): FormState {
  const issueDate = new Date().toISOString().slice(0, 10);
  return {
    issueDate,
    dueDate: plusDays(issueDate, 30),
    customerId: null,
    newCustomer: null,
    jobEvent: "",
    jobDate: "",
    jobLocation: "",
    lineItems: [{ description: "", qty: 1, unitPriceCents: 0 }],
    discountType: "none",
    discountValue: 0,
  };
}

export function storeForm(s: FormState): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function loadForm(): FormState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && "lineItems" in parsed
      ? (parsed as FormState) : null;
  } catch {
    return null;
  }
}

export function clearForm(): void {
  localStorage.removeItem(KEY);
}
