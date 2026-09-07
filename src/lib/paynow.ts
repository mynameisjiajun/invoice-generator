function tlv(id: string, value: string): string {
  return id + String(value.length).padStart(2, "0") + value;
}

export function crc16ccitt(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Reduce a stored PayNow mobile to the bare 8-digit local number:
 * "+65 9656 1716", "6596561716" and "96561716" all become "96561716".
 * Anything that doesn't look like an SG mobile is left as digits-only.
 */
export function normaliseMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  return /^65[89]\d{7}$/.test(digits) ? digits.slice(2) : digits;
}

export function paynowPayload(opts: {
  mobile: string;
  amountCents: number;
  reference: string;
  merchantName?: string;
}): string {
  const amount = (opts.amountCents / 100).toFixed(2);
  // PayNow's mobile proxy value must be digits only — no "+" and no spaces.
  // It must also be the bare 8-digit local number: POSB/DBS rejects the QR
  // when the 65 country code is prefixed, so strip it off.
  const mobileDigits = normaliseMobile(opts.mobile);
  const merchantAccountInfo =
    tlv("00", "SG.PAYNOW") +
    tlv("01", "0") +            // proxy type: mobile
    tlv("02", mobileDigits) +   // proxy value
    tlv("03", "0");             // amount not editable
  const body =
    tlv("00", "01") +           // payload format
    tlv("01", "12") +           // dynamic QR
    tlv("26", merchantAccountInfo) +
    tlv("52", "0000") +         // MCC
    tlv("53", "702") +          // SGD
    tlv("54", amount) +
    tlv("58", "SG") +
    tlv("59", (opts.merchantName ?? "NA").slice(0, 25)) +
    tlv("60", "Singapore") +
    tlv("62", tlv("01", opts.reference.slice(0, 25))) + // bill/reference number
    "6304";                     // CRC id+len, value appended below
  return body + crc16ccitt(body);
}
