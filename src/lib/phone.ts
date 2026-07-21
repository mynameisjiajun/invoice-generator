export type SgPhone = { e164: string | null; isMobile: boolean };

/**
 * Normalizes a Singapore phone number for WhatsApp deep-links.
 * SG mobiles are 8 digits starting 8/9; landlines are 8 digits starting 6/7.
 * Accepts input with or without a "+65"/"65" country-code prefix.
 */
export function normalizeSgMobile(phone: string | null | undefined): SgPhone {
  const digits = (phone ?? "").replace(/\D/g, "");

  let local: string | null = null;
  if (digits.length === 8) {
    local = digits;
  } else if (digits.length === 10 && digits.startsWith("65")) {
    local = digits.slice(2);
  }

  if (!local) return { e164: null, isMobile: false };

  return {
    e164: `65${local}`,
    isMobile: local[0] === "8" || local[0] === "9",
  };
}

/**
 * Formats a Singapore phone for display/storage as "+65 XXXX XXXX".
 * Accepts input with or without a country-code prefix. If it isn't a
 * recognizable 8-digit SG number, the trimmed original is returned unchanged
 * (so overseas or partial numbers aren't mangled).
 */
export function formatSgPhone(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  let local = digits;
  if (digits.length === 10 && digits.startsWith("65")) local = digits.slice(2);
  if (local.length === 8) return `+65 ${local.slice(0, 4)} ${local.slice(4)}`;
  return (phone ?? "").trim();
}
