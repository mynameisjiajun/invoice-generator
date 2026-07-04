# Task 11 Report: Income stats (yearly, monthly chart, per-client)

## Summary

Implemented per brief `.superpowers/sdd/task-11-brief.md`, verbatim. All three
stats functions follow the specified signatures and behavior exactly.

## Files created

- `src/lib/stats.ts` — Three pure functions:
  - `yearlyStats(invoices)`: groups non-draft invoices by year from `issue_date`,
    sums `total_cents` into `invoicedCents`, sums paid-only into `collectedCents`,
    returns sorted desc by year.
  - `monthlyStats(invoices, year)`: returns 12-entry array (months 1–12) with
    invoiced/collected for the given year, excluding drafts.
  - `clientStats(invoices)`: groups by `customers.name` (fallback "Unknown"),
    sums `total_cents`, sorted desc by total, excludes drafts.
- `src/lib/stats.test.ts` — 3 tests matching the brief's test code exactly:
  - `yearlyStats groups by year, excludes drafts`
  - `monthlyStats returns 12 months for a year`
  - `clientStats sorts by total desc, excludes drafts`
- `src/app/stats/page.tsx` — Client component ("use client") stats page:
  - Loads all invoices via `listInvoices()` in `useEffect`
  - Displays outstanding (unpaid) total
  - Year selector buttons showing invoiced/collected per year
  - Monthly bar chart (grey = invoiced, black = collected overlay)
  - Per-client breakdown sorted by total

## Verification performed

- Tests written first → ran `npx vitest run src/lib/stats.test.ts` → FAIL
  (module not found), confirming TDD red phase.
- Module implemented → ran `npx vitest run src/lib/stats.test.ts` → PASS, 3/3.
- Full suite: `npx vitest run` → 4 files, **21/21 passed**.
- `npx tsc --noEmit` — clean, no errors.

## Self-review notes

- All three functions are pure (no side effects, no DB calls) — easy to test.
- Stats page reuses existing `listInvoices` and `formatSGD` — no duplicate logic.
- The `real()` filter helper excludes drafts consistently across all three functions.
- Bar chart uses relative heights based on `max(invoicedCents)` with a floor of 1
  to avoid division by zero.
