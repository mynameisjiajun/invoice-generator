// PayNow QR payload (EMVCo merchant-presented mode / SGQR), ported from
// https://github.com/xkjyeah/paynow-qr-generator — a known-good generator —
// adjusted to SGQR / PayNow v1.2 for invoices: fixed amount, dynamic QR,
// reference in 62/01 only.

type QRDataValue = null | string | QRData;

class QRData {
  constructor(private components: Record<string, QRDataValue>) {}

  toString(): string {
    return Object.entries(this.components)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, comp]) => {
        if (!/^[0-9]{2}$/.test(key)) throw new Error("Key should be a 2-digit numeric key code");
        if (comp === null) return "";
        const value = typeof comp === "string" ? comp : comp.toString();
        if (value.length > 99) throw new Error("Encoded length should not exceed 99!");
        return key + String(value.length).padStart(2, "0") + value;
      })
      .join("");
  }

  toStringWithCRC(): string {
    const result = this.toString() + "6304";
    return result + crc16ccitt(result);
  }
}

/** CRC-16/CCITT-FALSE over the UTF-8 bytes of the input, as 4 uppercase hex digits. */
export function crc16ccitt(input: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(input)) {
    crc ^= byte << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Standardise a stored PayNow mobile the way the reference generator does:
 * a bare 8-digit SG number gets "+65" prefixed. "+65 9656 1716",
 * "6596561716" and "96561716" all become "+6596561716".
 */
export function normaliseMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  if (/^[0-9]{8}$/.test(digits)) return "+65" + digits;
  if (/^65[0-9]{8}$/.test(digits)) return "+" + digits;
  return mobile.trim().startsWith("+") ? "+" + digits : digits;
}

// Singapore UEN shapes: business (8 digits + letter), local company (9 digits
// + letter), and other entities (T/S/R + 2 digits + 2 letters + 4 digits + letter).
const UEN = /^(\d{8}[A-Z]|\d{9}[A-Z]|[TSR]\d{2}[A-Z]{2}\d{4}[A-Z])$/;

/** True when the stored PayNow value is a UEN rather than a mobile number. */
export function isUen(value: string): boolean {
  return UEN.test(value.trim().toUpperCase());
}

/** How the PayNow destination reads on invoices and in messages. */
export function paynowDisplay(value: string): string {
  return isUen(value) ? `UEN ${value.trim().toUpperCase()}` : value.trim();
}

export function paynowPayload(opts: {
  mobile: string;
  amountCents: number;
  reference: string;
}): string {
  // SGQR bill number: up to 25 printable ASCII characters.
  const reference = opts.reference.replace(/[^\x20-\x7e]/g, "").slice(0, 25);
  return new QRData({
    "00": "01", // Payload format indicator
    // 11 - static (same QR for many payments), 12 - dynamic (one QR per
    // transaction). An invoice QR carries one fixed amount, so it's dynamic.
    "01": "12",
    "26": new QRData({
      "00": "SG.PAYNOW",
      // Proxy type: 0 - mobile, 2 - UEN. `mobile` holds whichever is stored.
      "01": isUen(opts.mobile) ? "2" : "0",
      "02": isUen(opts.mobile) ? opts.mobile.trim().toUpperCase() : normaliseMobile(opts.mobile),
      "03": "0", // Amount is not editable — pay exactly the invoice total
      // "05" (transaction reference) was removed in PayNow v1.2; the
      // reference goes in 62/01 instead.
    }),
    "52": "0000", // Merchant category code
    "53": "702", // ISO 4217 code for SGD
    "54": (opts.amountCents / 100).toFixed(2), // Transaction amount
    "58": "SG",
    "59": "NA", // Merchant name -- doesn't matter because PayNow has its own lookup
    "60": "Singapore", // City
    // EMVCo forbids zero-length data objects, so leave 62 out entirely
    // rather than emitting an empty "6200" when there's no reference.
    "62": reference ? new QRData({ "01": reference }) : null, // Bill number
  }).toStringWithCRC();
}
