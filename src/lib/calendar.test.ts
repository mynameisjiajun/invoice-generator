import { describe, expect, it } from "vitest";
import { calendarEvents, clashes, parseLooseDate } from "./calendar";
import type { Invoice } from "./types";

const inv = (o: Partial<Invoice>): Invoice => ({
  id: o.invoice_number ?? "x", business_id: "b", invoice_number: "A-1", status: "unpaid",
  issue_date: "2026-11-01", due_date: null, customer_id: 1, job_event: "Brand film", job_date: "",
  job_location: "", line_items: [], discount_type: "none", discount_value: 0, subtotal_cents: 0,
  total_cents: 0, paid_date: null, sent_at: null, customers: { name: "Jordan" } as Invoice["customers"], ...o,
});

describe("calendar", () => {
  it("reads old free-text dates", () => {
    expect(parseLooseDate("20 June 2026, 7-9PM (2 Hours)")).toBe("2026-06-20");
    expect(parseLooseDate("2026-12-01")).toBe("2026-12-01");
    expect(parseLooseDate("5/1/2027")).toBe("2027-01-05");
    expect(parseLooseDate("sometime next week")).toBeNull();
  });

  it("places shoots, rentals and open quotes; skips drafts and converted quotes", () => {
    const ev = calendarEvents([
      inv({ invoice_number: "A-1", shoot_date: "2026-11-20" }),
      inv({ invoice_number: "A-2", status: "draft", shoot_date: "2026-11-21" }),
      inv({ invoice_number: "A-3", is_rental: true, rental_start: "2026-11-19T10:00", rental_end: "2026-11-22T10:00" }),
    ], [
      inv({ invoice_number: "Q-1", doc_type: "quote", shoot_date: "2026-11-25" }),
      inv({ invoice_number: "Q-2", doc_type: "quote", shoot_date: "2026-11-26", converted_invoice_id: "x" }),
    ]);
    expect(ev.map((e) => [e.sub.split(" · ")[0], e.start, e.end, e.tentative])).toEqual([
      ["A-3", "2026-11-19", "2026-11-22", false],
      ["A-1", "2026-11-20", "2026-11-20", false],
      ["Q-1", "2026-11-25", "2026-11-25", true],
    ]);
  });

  it("warns about double bookings", () => {
    const fx3 = { description: "Sony FX3", qty: 1, unitPriceCents: 8000, rental: { days: 3 } };
    const ev = calendarEvents([
      inv({ invoice_number: "A-1", shoot_date: "2026-11-20" }),
      inv({ invoice_number: "A-2", shoot_date: "2026-11-20", job_event: "Wedding" }),
      inv({ invoice_number: "A-3", is_rental: true, rental_start: "2026-11-19T10:00", rental_end: "2026-11-21T10:00", line_items: [fx3] }),
      inv({ invoice_number: "A-4", is_rental: true, rental_start: "2026-11-21T12:00", rental_end: "2026-11-23T10:00", line_items: [fx3] }),
    ], []);
    const texts = clashes(ev).map((c) => c.text);
    expect(texts.some((t) => t.startsWith("Two shoots on 20 Nov 2026"))).toBe(true);
    expect(texts.some((t) => t.includes("while gear is out"))).toBe(true);
    expect(texts.some((t) => t.startsWith("Rented twice at once from 21 Nov 2026: sony fx3"))).toBe(true);
  });
});
