// Year-end figures for a Singapore sole proprietor: profit, Form B's 4-line
// statement, and an ESTIMATE of what to set aside for compulsory MediSave
// and income tax. Estimates only: they ignore other income (e.g. a salary)
// and reliefs beyond earned income relief. The CPF calculator is the source
// of truth for MediSave: https://www.cpf.gov.sg/member/tools-and-services/calculators/self-employed-medisave-contribution-calculator
//
// MediSave (self-employed, non-pensioner; checked against CPF/IRAS Nov 2026):
// nothing if net trade income (NTI) ≤ $6,000; top rate by age on NTI above
// $18,000, capped at rate × the annual ceiling ($96,000 for 2026, which
// gives CPF's published caps $7,680 / $8,640 / $9,600 / $10,080). Between
// $6,000 and $18,000 CPF phases the rate in; this approximates that as half
// the top rate up to $12,000, rising linearly to the full rate at $18,000.
//
// Income tax: resident rates from YA 2024.

import type { Expense, Invoice } from "./types";
import { paidCents } from "./payments";

export type AgeBand = "under35" | "35to44" | "45to49" | "50plus";
export const AGE_BANDS: { key: AgeBand; label: string; rate: number }[] = [
  { key: "under35", label: "Under 35", rate: 0.08 },
  { key: "35to44", label: "35–44", rate: 0.09 },
  { key: "45to49", label: "45–49", rate: 0.10 },
  { key: "50plus", label: "50 and above", rate: 0.105 },
];
const NTI_CEILING = 96_000;

/** Estimated compulsory MediSave, in dollars, for net trade income `nti`. */
export function medisaveEstimate(nti: number, age: AgeBand): number {
  if (nti <= 6_000) return 0;
  const top = AGE_BANDS.find((b) => b.key === age)!.rate;
  let rate = top;
  if (nti <= 12_000) rate = top / 2;
  else if (nti < 18_000) rate = top / 2 + (top / 2) * ((nti - 12_000) / 6_000);
  return Math.round(Math.min(nti * rate, top * NTI_CEILING));
}

const BRACKETS: [number, number][] = [
  [20_000, 0], [30_000, 0.02], [40_000, 0.035], [80_000, 0.07], [120_000, 0.115],
  [160_000, 0.15], [200_000, 0.18], [240_000, 0.19], [280_000, 0.195], [320_000, 0.2],
  [500_000, 0.22], [1_000_000, 0.23], [Infinity, 0.24],
];

/** Resident income tax on chargeable income, in dollars. */
export function incomeTax(chargeable: number): number {
  let tax = 0, lower = 0;
  for (const [upper, rate] of BRACKETS) {
    if (chargeable <= lower) break;
    tax += (Math.min(chargeable, upper) - lower) * rate;
    lower = upper;
  }
  return Math.round(tax);
}

const EARNED_INCOME_RELIEF = 1_000;

export type YearSummary = {
  year: number;
  revenueCents: number;        // invoiced (issue date in the year), Form B basis
  collectedCents: number;      // money actually received on those invoices
  expensesCents: number;       // allowable expenses (everything but gear)
  gearCents: number;           // gear bought: claimed as capital allowances
  profitCents: number;         // adjusted profit = revenue − allowable expenses
  ntiCents: number;            // after writing gear off in the year (estimate)
  medisaveCents: number;
  taxCents: number;
  setAsideCents: number;
};

export function yearSummary(invoices: Invoice[], expenses: Expense[], year: number, age: AgeBand): YearSummary {
  const inYear = invoices.filter((i) => i.status !== "draft" && i.doc_type !== "quote" && i.issue_date.startsWith(`${year}-`));
  const revenue = inYear.reduce((s, i) => s + i.total_cents, 0);
  const collected = inYear.reduce((s, i) => s + Math.min(paidCents(i), i.total_cents), 0);
  const spent = expenses.filter((e) => e.spent_on.startsWith(`${year}-`));
  const gear = spent.filter((e) => e.category === "gear").reduce((s, e) => s + e.amount_cents, 0);
  const allowable = spent.filter((e) => e.category !== "gear").reduce((s, e) => s + e.amount_cents, 0);
  const profit = revenue - allowable;
  const nti = Math.max(0, profit - gear);
  const medisave = medisaveEstimate(nti / 100, age) * 100;
  const chargeable = Math.max(0, nti / 100 - medisave / 100 - EARNED_INCOME_RELIEF);
  const tax = incomeTax(chargeable) * 100;
  return {
    year, revenueCents: revenue, collectedCents: collected, expensesCents: allowable, gearCents: gear,
    profitCents: profit, ntiCents: nti, medisaveCents: medisave, taxCents: tax, setAsideCents: medisave + tax,
  };
}

/** CSV for the accountant / Form B: the 4-line statement, then every line. */
export function yearCsv(s: YearSummary, invoices: Invoice[], expenses: Expense[]): string {
  const money = (c: number) => (c / 100).toFixed(2);
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows: string[] = [
    `Form B 4-line statement,${s.year}`,
    `Revenue,${money(s.revenueCents)}`,
    `Gross profit,${money(s.revenueCents)}`,
    `Allowable business expenses,${money(s.expensesCents)}`,
    `Adjusted profit,${money(s.profitCents)}`,
    `Gear bought (capital allowances),${money(s.gearCents)}`,
    "",
    "Type,Date,Number / category,Client / note,Amount,Received",
  ];
  for (const i of invoices.filter((x) => x.status !== "draft" && x.doc_type !== "quote" && x.issue_date.startsWith(`${s.year}-`))) {
    rows.push(["Invoice", i.issue_date, q(i.invoice_number ?? ""), q(i.customers?.name ?? ""), money(i.total_cents), money(Math.min(paidCents(i), i.total_cents))].join(","));
  }
  for (const e of expenses.filter((x) => x.spent_on.startsWith(`${s.year}-`))) {
    rows.push(["Expense", e.spent_on, e.category, q(e.note), money(-e.amount_cents), ""].join(","));
  }
  return rows.join("\n");
}
