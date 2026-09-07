import { describe, expect, it } from "vitest";
import { buildMime } from "./gmail";

const base = { to: "jane@example.com", subject: "Invoice JJ-0042 from JJ Media", body: "Hi Jane,\n\nThanks." };
const from = "chuajiajun2705@gmail.com";

/** Pulls a header value out of the message's header block. */
function header(mime: string, name: string): string | undefined {
  return mime.split("\r\n\r\n")[0].split("\r\n")
    .find((l) => l.toLowerCase().startsWith(`${name.toLowerCase()}: `))
    ?.slice(name.length + 2);
}

describe("buildMime", () => {
  it("uses CRLF line endings throughout, as the RFC requires", () => {
    const mime = buildMime(base, from);
    expect(mime).toContain("\r\n");
    expect(/(?<!\r)\n/.test(mime)).toBe(false);
  });

  it("sets From, To and Subject", () => {
    const mime = buildMime(base, from);
    expect(header(mime, "From")).toBe(from);
    expect(header(mime, "To")).toBe("jane@example.com");
    expect(header(mime, "Subject")).toBe("Invoice JJ-0042 from JJ Media");
  });

  it("renders a display name when one is given", () => {
    const mime = buildMime({ ...base, senderName: "Chua Jia Jun" }, from);
    expect(header(mime, "From")).toBe(`Chua Jia Jun <${from}>`);
  });

  it("encodes non-ASCII headers as RFC 2047 words rather than raw UTF-8", () => {
    const mime = buildMime({ ...base, subject: "Invoice — May 27–29" }, from);
    const subject = header(mime, "Subject")!;
    expect(subject.startsWith("=?UTF-8?B?")).toBe(true);
    expect(Buffer.from(subject.slice(10, -2), "base64").toString("utf8")).toBe("Invoice — May 27–29");
  });

  it("strips CR/LF from header values so a crafted name can't inject headers", () => {
    const mime = buildMime({ ...base, subject: "Hi\r\nBcc: attacker@evil.com" }, from);
    expect(header(mime, "Bcc")).toBeUndefined();
    expect(header(mime, "Subject")).toBe("Hi Bcc: attacker@evil.com");
  });

  it("base64-encodes the body, so non-ASCII copy survives", () => {
    const mime = buildMime({ ...base, body: "Thanks — enjoyed it." }, from);
    const encoded = mime.split("\r\n\r\n").slice(1).join("\r\n\r\n").trim();
    expect(Buffer.from(encoded, "base64").toString("utf8")).toBe("Thanks — enjoyed it.");
  });

  it("attaches a PDF as a multipart/mixed part with the right filename", () => {
    const content = Buffer.from("%PDF-1.7 fake");
    const mime = buildMime(
      { ...base, attachment: { filename: "Invoice for Jane 30052026 JJ-0042.pdf", mimeType: "application/pdf", content } },
      from,
    );
    const boundary = header(mime, "Content-Type")!.match(/boundary="([^"]+)"/)![1];
    const parts = mime.split(`--${boundary}`);
    expect(parts).toHaveLength(4); // preamble, body part, attachment part, closing
    expect(mime).toContain('Content-Disposition: attachment; filename="Invoice for Jane 30052026 JJ-0042.pdf"');
    expect(mime.trimEnd().endsWith(`--${boundary}--`)).toBe(true);

    const attachmentBody = parts[2].split("\r\n\r\n")[1].trim();
    expect(Buffer.from(attachmentBody, "base64")).toEqual(content);
  });

  it("wraps base64 attachment data at 76 columns", () => {
    const content = Buffer.alloc(4096, 0x41);
    const mime = buildMime({ ...base, attachment: { filename: "a.pdf", mimeType: "application/pdf", content } }, from);
    const boundary = header(mime, "Content-Type")!.match(/boundary="([^"]+)"/)![1];
    const lines = mime.split(`--${boundary}`)[2].split("\r\n\r\n")[1].trim().split("\r\n");
    expect(Math.max(...lines.map((l) => l.length))).toBeLessThanOrEqual(76);
    expect(Buffer.from(lines.join(""), "base64")).toEqual(content);
  });

  it("escapes quotes in a filename so the header stays parseable", () => {
    const mime = buildMime(
      { ...base, attachment: { filename: 'in"voice.pdf', mimeType: "application/pdf", content: Buffer.from("x") } },
      from,
    );
    expect(mime).toContain('filename="invoice.pdf"');
  });
});
