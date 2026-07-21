import { describe, expect, test } from "vitest";
import { crc16ccitt, paynowPayload } from "./paynow";

describe("crc16ccitt", () => {
  test("known vector: '123456789' -> 29B1 (CRC-16/CCITT-FALSE)", () => {
    expect(crc16ccitt("123456789")).toBe("29B1");
  });
});

describe("paynowPayload", () => {
  const payload = paynowPayload({
    mobile: "+6596561716",
    amountCents: 50000,
    reference: "A-30",
    merchantName: "CHUA JIA JUN",
  });

  test("starts with EMV header, dynamic point of initiation", () => {
    expect(payload.startsWith("000201")).toBe(true); // 00 02 "01"
    expect(payload).toContain("010212"); // 01 02 "12" = dynamic
  });

  test("merchant account info template is exact — mobile proxy value has no '+' (spec requires digits only)", () => {
    // 0009SG.PAYNOW | 01 01 "0" (mobile proxy) | 02 10 "6596561716" | 03 01 "0" (not editable)
    const inner = "0009SG.PAYNOW" + "01010" + "02106596561716" + "03010";
    expect(payload).toContain("26" + String(inner.length).padStart(2, "0") + inner);
  });

  test("strips '+' and spaces from the stored mobile number", () => {
    const withSpaces = paynowPayload({
      mobile: "+65 9656 1716", amountCents: 50000, reference: "A-30", merchantName: "CHUA JIA JUN",
    });
    expect(withSpaces).toContain("02106596561716");
    expect(withSpaces).not.toContain("+");
  });

  test("contains currency 702, country SG, amount 500.00", () => {
    expect(payload).toContain("5303702");
    expect(payload).toContain("5802SG");
    expect(payload).toContain("5406500.00");
  });

  test("contains invoice reference", () => {
    expect(payload).toContain("A-30");
  });

  test("ends with valid CRC over itself", () => {
    const body = payload.slice(0, -4);
    expect(payload.slice(-4)).toBe(crc16ccitt(body));
    expect(body.endsWith("6304")).toBe(true);
  });

  test("amounts format without thousands separators", () => {
    const p = paynowPayload({ mobile: "+6596561716", amountCents: 123456, reference: "A-31" });
    expect(p).toContain("54071234.56");
  });
});
