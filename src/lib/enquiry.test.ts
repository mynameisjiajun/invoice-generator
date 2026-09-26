import { describe, expect, it } from "vitest";
import { looksLikeBot, parseEnquiry } from "./enquiry";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const valid = { name: " Sarah Tan ", email: "sarah@example.com", message: "Wedding at Sentosa", shoot_type: "Event", budget: "Not sure yet", shoot_date: "2026-12-12" };

describe("parseEnquiry", () => {
  it("accepts a complete enquiry and trims it", () => {
    const r = parseEnquiry(form(valid));
    expect(r).toEqual({ ok: true, value: { ...valid, name: "Sarah Tan", phone: "" } });
  });

  it("says what's missing", () => {
    expect(parseEnquiry(form({ ...valid, name: "" }))).toMatchObject({ ok: false, error: expect.stringMatching(/name/) });
    expect(parseEnquiry(form({ ...valid, email: "sarah@" }))).toMatchObject({ ok: false, error: expect.stringMatching(/email/) });
    expect(parseEnquiry(form({ ...valid, message: "  " }))).toMatchObject({ ok: false, error: expect.stringMatching(/shoot/) });
  });

  it("drops values that aren't one of the offered choices", () => {
    const r = parseEnquiry(form({ ...valid, shoot_type: "<script>", budget: "a million", shoot_date: "next week" }));
    expect(r.ok && r.value).toMatchObject({ shoot_type: "", budget: "", shoot_date: null });
  });
});

describe("looksLikeBot", () => {
  const now = 1_000_000;
  it("flags a filled honeypot or an instant submit", () => {
    expect(looksLikeBot(form({ website: "spam.biz", started: String(now - 60_000) }), now)).toBe(true);
    expect(looksLikeBot(form({ started: String(now - 500) }), now)).toBe(true);
    expect(looksLikeBot(form({}), now)).toBe(true);
  });
  it("lets a person through", () => {
    expect(looksLikeBot(form({ started: String(now - 45_000) }), now)).toBe(false);
  });
});
