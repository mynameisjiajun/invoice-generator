import { describe, expect, it } from "vitest";
import { SHOOT_TYPES } from "@/lib/enquiry";
import { FAQS, PROCESS_STEPS, SERVICE_SHOOT_TYPE, faqJsonLd, quoteBarVisible } from "./quote";

describe("SERVICE_SHOOT_TYPE", () => {
  it("maps every service card to an offered form choice", () => {
    expect(SERVICE_SHOOT_TYPE).toEqual({ s1: "Corporate event", s2: "Documentary", s3: "Social media content" });
    for (const t of Object.values(SERVICE_SHOOT_TYPE)) expect(SHOOT_TYPES).toContain(t);
  });
});

describe("copy guard", () => {
  it("never mentions travel, revisions or packages", () => {
    const text = [...FAQS.flatMap((f) => [f.q, f.a]), ...PROCESS_STEPS.flatMap((s) => [s.title, s.text])].join(" ");
    expect(text).not.toMatch(/travel|revision|package|overseas/i);
  });
  it("states the agreed facts", () => {
    const text = FAQS.map((f) => f.a).join(" ");
    expect(text).toMatch(/14 days/);
    expect(text).toMatch(/24 hours/);
    expect(text).toMatch(/no extra cost/);
  });
});

describe("faqJsonLd", () => {
  it("builds a schema.org FAQPage", () => {
    expect(faqJsonLd([{ q: "Q?", a: "A." }])).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [{ "@type": "Question", name: "Q?", acceptedAnswer: { "@type": "Answer", text: "A." } }],
    });
  });
});

describe("quoteBarVisible", () => {
  it("shows only once the hero is gone and the form isn't on screen", () => {
    expect(quoteBarVisible(true, false)).toBe(false);
    expect(quoteBarVisible(false, false)).toBe(true);
    expect(quoteBarVisible(false, true)).toBe(false);
    expect(quoteBarVisible(true, true)).toBe(false);
  });
});
