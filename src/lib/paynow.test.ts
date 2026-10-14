import { describe, expect, test } from "vitest";
import { crc16ccitt, isUen, normaliseMobile, paynowDisplay, paynowPayload } from "./paynow";

describe("crc16ccitt", () => {
  test("known vector: '123456789' -> 29B1 (CRC-16/CCITT-FALSE)", () => {
    expect(crc16ccitt("123456789")).toBe("29B1");
  });
});

describe("paynowPayload", () => {
  const payload = paynowPayload({
    mobile: "96561716",
    amountCents: 50000,
    reference: "A-30",
  });

  test("matches the SGQR / PayNow v1.2 layout exactly", () => {
    const merchant = "0009SG.PAYNOW" + "01010" + "0211+6596561716" + "03010";
    const body =
      "000201" + "010212" +
      "26" + String(merchant.length).padStart(2, "0") + merchant +
      "52040000" + "5303702" + "5406500.00" + "5802SG" + "5902NA" + "6009Singapore" +
      "62080104A-30" + "6304";
    expect(payload).toBe(body + crc16ccitt(body));
  });

  test("proxy value is +65 followed by the 8-digit number", () => {
    for (const mobile of ["+65 9656 1716", "6596561716", "9656 1716"]) {
      expect(paynowPayload({ mobile, amountCents: 100, reference: "A-1" })).toContain("0211+6596561716");
    }
  });

  test("omits field 62 entirely when there is no reference (no zero-length objects)", () => {
    const p = paynowPayload({ mobile: "96561716", amountCents: 100, reference: "" });
    expect(p).toContain("6009Singapore6304");
  });

  test("bill number is capped at 25 printable ASCII characters", () => {
    const p = paynowPayload({ mobile: "96561716", amountCents: 100, reference: "INV–" + "X".repeat(30) });
    expect(p).toContain("6229" + "0125" + "INV" + "X".repeat(22) + "6304");
  });

  test("ends with valid CRC over itself", () => {
    const body = payload.slice(0, -4);
    expect(payload.slice(-4)).toBe(crc16ccitt(body));
    expect(body.endsWith("6304")).toBe(true);
  });

  test("amounts format without thousands separators", () => {
    const p = paynowPayload({ mobile: "96561716", amountCents: 123456, reference: "A-31" });
    expect(p).toContain("54071234.56");
  });
});

describe("normaliseMobile", () => {
  test.each([
    ["+65 9656 1716", "+6596561716"],
    ["+6596561716", "+6596561716"],
    ["6596561716", "+6596561716"],
    ["96561716", "+6596561716"],
    ["8123 4567", "+6581234567"],
  ])("%s -> %s", (input, expected) => {
    expect(normaliseMobile(input)).toBe(expected);
  });

  test("leaves a foreign number alone apart from stripping punctuation", () => {
    expect(normaliseMobile("+1 415 555 0100")).toBe("+14155550100");
  });
});

describe("PayNow to a UEN", () => {
  test.each(["53533808B", "53533808b", " 53533808B ", "201912345K", "T09LL0001B"])("%s is a UEN", (v) => {
    expect(isUen(v)).toBe(true);
  });
  test.each(["96561716", "+65 9656 1716", "6596561716", ""])("%s is not a UEN", (v) => {
    expect(isUen(v)).toBe(false);
  });

  test("QR uses proxy type 2 with the UEN, uppercased", () => {
    const p = paynowPayload({ mobile: " 53533808b ", amountCents: 100, reference: "A-1" });
    expect(p).toContain("0009SG.PAYNOW" + "01012" + "020953533808B" + "03010");
    expect(p.slice(-4)).toBe(crc16ccitt(p.slice(0, -4)));
  });

  test("display labels a UEN and leaves a mobile as typed", () => {
    expect(paynowDisplay("53533808b")).toBe("UEN 53533808B");
    expect(paynowDisplay(" +65 9656 1716 ")).toBe("+65 9656 1716");
  });
});
