import { describe, expect, test } from "vitest";
import { normalizeSgMobile, formatSgPhone } from "./phone";

describe("normalizeSgMobile", () => {
  test("8-digit mobile without country code", () => {
    expect(normalizeSgMobile("9698 6338")).toEqual({ e164: "6596986338", isMobile: true });
  });

  test("mobile with +65 prefix and formatting", () => {
    expect(normalizeSgMobile("+65 9698 6338")).toEqual({ e164: "6596986338", isMobile: true });
  });

  test("mobile with 65 prefix, no plus", () => {
    expect(normalizeSgMobile("6596986338")).toEqual({ e164: "6596986338", isMobile: true });
  });

  test("8-digit landline (starts with 6) is not a mobile", () => {
    expect(normalizeSgMobile("6512 3456")).toEqual({ e164: "6565123456", isMobile: false });
  });

  test("landline with +65 prefix is not a mobile", () => {
    expect(normalizeSgMobile("+65 6123 4567")).toEqual({ e164: "6561234567", isMobile: false });
  });

  test("empty or missing phone", () => {
    expect(normalizeSgMobile("")).toEqual({ e164: null, isMobile: false });
    expect(normalizeSgMobile(undefined)).toEqual({ e164: null, isMobile: false });
  });

  test("garbage or wrong-length input", () => {
    expect(normalizeSgMobile("abc")).toEqual({ e164: null, isMobile: false });
    expect(normalizeSgMobile("123")).toEqual({ e164: null, isMobile: false });
  });
});

describe("formatSgPhone", () => {
  test("formats an 8-digit SG number as +65 XXXX XXXX", () => {
    expect(formatSgPhone("96561716")).toBe("+65 9656 1716");
    expect(formatSgPhone("9656 1716")).toBe("+65 9656 1716");
    expect(formatSgPhone("+6596561716")).toBe("+65 9656 1716");
    expect(formatSgPhone("65 9656 1716")).toBe("+65 9656 1716");
  });

  test("leaves non-SG / partial input untouched (trimmed)", () => {
    expect(formatSgPhone("  12345  ")).toBe("12345");
    expect(formatSgPhone("+1 415 555 0100")).toBe("+1 415 555 0100");
    expect(formatSgPhone("")).toBe("");
    expect(formatSgPhone(null)).toBe("");
  });
});
