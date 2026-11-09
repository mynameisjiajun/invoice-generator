import { describe, expect, it } from "vitest";
import { buildShootTerms, matchPreset, presetContract, CLAUSE_OPTIONS } from "./shootTerms";

const text = (t: ReturnType<typeof buildShootTerms>) =>
  t.sections.flatMap((s) => [s.title, ...s.clauses.flatMap((c) => [c.lead ?? "", c.text, ...(c.sub ?? [])])]).join(" ");

describe("shoot terms", () => {
  it("standard: the fair set, numbered in order, with editable numbers", () => {
    const t = buildShootTerms({ ...presetContract("standard"), revisions: 3, deliveryDays: 10 }, 50);
    expect(t.sections.map((s) => s.n)).toEqual(t.sections.map((_, i) => i + 1));
    const all = text(t);
    expect(all).toContain("3 rounds of revisions");
    expect(all).toContain("within 10 working days");
    expect(all).toContain("deposit of 50%");
    expect(all).toContain("non-refundable if you cancel");
    expect(all).not.toContain("1% per month");
    expect(all).not.toContain("treated as approved");
  });

  it("strict adds late interest, approvals and overtime", () => {
    const all = text(buildShootTerms(presetContract("strict"), 50));
    expect(all).toContain("1% per month");
    expect(all).toContain("treated as approved");
    expect(all).toContain("Overtime:");
  });

  it("booking wording follows when the client pays", () => {
    expect(text(buildShootTerms(presetContract("standard"), 0))).toContain("accept the quote or Invoice in writing");
    const full = text(buildShootTerms(presetContract("standard"), 100));
    expect(full).toContain("full payment of the Invoice, which is due before the shoot");
    expect(full).not.toContain("Deposit:");
  });

  it("turning clauses off removes them and empty sections", () => {
    const t = buildShootTerms({ preset: "custom", on: [], revisions: 2, deliveryDays: 14 }, 50);
    const all = text(t);
    expect(all).not.toContain("Cancellation must be in writing");
    expect(all).not.toContain("Copyright:");
    expect(t.sections.some((s) => s.title === "Delivery and Revisions")).toBe(false);
    // Core protections always stay.
    expect(all).toContain("limited to the fees you have paid");
    expect(all).toContain("death or personal injury");
    expect(all).toContain("laws of Singapore");
  });

  it("singular wording for one round / one day", () => {
    const all = text(buildShootTerms({ ...presetContract("standard"), revisions: 1, deliveryDays: 1 }, 0));
    expect(all).toContain("1 round of revisions");
    expect(all).toContain("1 working day of");
  });

  it("presets are recognised from their switches", () => {
    expect(matchPreset(presetContract("standard").on)).toBe("standard");
    expect(matchPreset(presetContract("strict").on)).toBe("strict");
    expect(matchPreset(["cancellation"])).toBe("custom");
  });

  it("acknowledgement reflects the chosen clauses", () => {
    const t = buildShootTerms(presetContract("standard"), 50);
    expect(t.ack.points.some((p) => p.includes("non-refundable"))).toBe(true);
    expect(buildShootTerms({ preset: "custom", on: [], revisions: 2, deliveryDays: 14 }, 0).ack.points)
      .toEqual(["Apex Cinematics' liability is limited to the fees paid for the Services."]);
  });

  it("every switch in the form exists", () => {
    expect(new Set(CLAUSE_OPTIONS.map((o) => o.id)).size).toBe(12);
  });
});

describe("blank copy", () => {
  it("is worded for any payment arrangement", () => {
    const all = text(buildShootTerms(presetContract("standard"), null));
    expect(all).toContain("any deposit or upfront payment it asks for");
    expect(all).toContain("Any deposit stated on the Invoice reserves the date");
  });
});
