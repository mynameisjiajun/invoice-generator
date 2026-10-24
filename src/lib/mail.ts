// Sends invoices from the business address, chuajiajun@apexcinematics.tech,
// which is an iCloud+ Custom Email Domain. iCloud has no mail API, so this
// speaks the two standard protocols it does offer:
//
//   - SMTP (smtp.mail.me.com) to deliver the message;
//   - IMAP (imap.mail.me.com) to file a copy in Sent Messages, or to save a
//     draft, so both show up in Apple Mail on every device.
//
// Everything here is server-only — the password must never reach the browser.
//
// Auth model: one Apple ID (the app is single-user), with an app-specific
// password from account.apple.com → Sign-In and Security. iCloud logs in with
// the Apple ID's own address (usually @icloud.com / @me.com), not the custom
// domain one, which is why ICLOUD_USER and MAIL_FROM are separate. An
// app-specific password stops working if it is revoked or the Apple ID
// password changes — generate a new one when that happens.

import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";

const SMTP_HOST = "smtp.mail.me.com";
const IMAP_HOST = "imap.mail.me.com";

export class MailNotConfiguredError extends Error {}
export class MailAuthError extends Error {}

type MailEnv = { user: string; password: string; from: string };

export function mailEnv(): MailEnv {
  const user = process.env.ICLOUD_USER;
  const password = process.env.ICLOUD_APP_PASSWORD;
  const from = process.env.MAIL_FROM;
  const missing = [
    !user && "ICLOUD_USER",
    !password && "ICLOUD_APP_PASSWORD",
    !from && "MAIL_FROM",
  ].filter(Boolean);
  if (missing.length) {
    throw new MailNotConfiguredError(`Email is not set up — missing ${missing.join(", ")}`);
  }
  return { user: user!, password: password!, from: from! };
}

const AUTH_HINT =
  "iCloud rejected the login — check ICLOUD_USER is your Apple ID email and ICLOUD_APP_PASSWORD is a current app-specific password.";

/** RFC 2047 encoded-word, so non-ASCII in a subject or display name survives.
 *  Header values must be plain ASCII on the wire; an em dash in a job name or
 *  an accent in a client's name would otherwise arrive as mojibake. */
function encodeHeader(value: string): string {
  const clean = value.replace(/[\r\n]+/g, " ").trim();
  if (/^[\x20-\x7E]*$/.test(clean)) return clean;
  return `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`;
}

/** Splits base64 into 76-char lines, as MIME requires for base64 transfer
 *  encoding. Some strict clients reject or mangle one enormous line. */
function wrapBase64(b64: string): string {
  return b64.replace(/(.{76})/g, "$1\r\n").trimEnd();
}

export type OutgoingMail = {
  to: string;
  subject: string;
  body: string;
  senderName?: string;
  attachment?: { filename: string; mimeType: string; content: Buffer };
};

/** The plain-text body as minimal HTML: escaped text with line breaks, in a
 *  `<div dir="ltr">`, the same shape mail composers produce. */
function bodyHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\r?\n/g, "<br>");
  return `<div dir="ltr">${escaped}</div>`;
}

/** `filename`/`name` parameters for an attachment. ASCII names go in plain
 *  quoted form; anything else also gets an RFC 2231 `filename*` so Apple Mail
 *  and Outlook show the real name rather than failing to parse the header. */
function filenameParams(filename: string): { name: string; disposition: string } {
  const clean = filename.replace(/["\r\n]/g, "");
  if (/^[\x20-\x7E]*$/.test(clean)) {
    return { name: `name="${clean}"`, disposition: `filename="${clean}"` };
  }
  const ascii = clean.replace(/[^\x20-\x7E]/g, "_");
  const encoded = encodeURIComponent(clean).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return {
    name: `name="${encodeHeader(clean)}"`,
    disposition: `filename="${ascii}"; filename*=UTF-8''${encoded}`,
  };
}

const newBoundary = (tag: string) =>
  `${tag}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

/** Builds the MIME message. Headers and boundaries use CRLF, which the RFC
 *  requires. Date and Message-ID are set here rather than left to the SMTP
 *  server, because the same bytes are also appended over IMAP, where nothing
 *  fills them in — and Apple Mail sorts and threads by them.
 *
 *  With an attachment, the layout mirrors what Apple Mail and Gmail send:
 *  multipart/mixed { multipart/alternative { text/plain, text/html }, pdf }.
 *  The HTML alternative matters: Apple Mail renders attachments on a
 *  plain-text-only message *inline*, which for a PDF shows up as a grey box
 *  with a "?" instead of the usual attachment card. */
export function buildMime(mail: OutgoingMail, from: string): string {
  const boundary = newBoundary("b");
  const fromHeader = mail.senderName ? `${encodeHeader(mail.senderName)} <${from}>` : from;
  const headers = [
    `From: ${fromHeader}`,
    `To: ${encodeHeader(mail.to)}`,
    `Subject: ${encodeHeader(mail.subject)}`,
    `Date: ${new Date().toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: <${newBoundary("m")}@${from.split("@")[1] ?? "localhost"}>`,
    "MIME-Version: 1.0",
  ];

  if (!mail.attachment) {
    return [
      ...headers,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      wrapBase64(Buffer.from(mail.body, "utf8").toString("base64")),
    ].join("\r\n");
  }

  const { filename, mimeType, content } = mail.attachment;
  const alt = newBoundary("a");
  const params = filenameParams(filename);
  return [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    "",
    `--${alt}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(Buffer.from(mail.body, "utf8").toString("base64")),
    "",
    `--${alt}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(Buffer.from(bodyHtml(mail.body), "utf8").toString("base64")),
    "",
    `--${alt}--`,
    "",
    `--${boundary}`,
    `Content-Type: ${mimeType}; ${params.name}`,
    `Content-Disposition: attachment; ${params.disposition}`,
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(content.toString("base64")),
    "",
    `--${boundary}--`,
  ].join("\r\n");
}

/** Sends the message over iCloud SMTP, then files a copy in Sent Messages.
 *  iCloud's SMTP server doesn't keep sent mail the way Gmail's API does, so
 *  without the IMAP step the invoice would never appear in Apple Mail. The
 *  copy is best-effort: once SMTP has accepted the message it has gone, and
 *  failing the request at that point would invite a duplicate resend. */
export async function sendMail(mail: OutgoingMail): Promise<{ id: string; savedToSent: boolean }> {
  const env = mailEnv();
  const raw = buildMime(mail, env.from);
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user: env.user, pass: env.password },
  });
  try {
    await transport.sendMail({ envelope: { from: env.from, to: mail.to }, raw });
  } catch (e) {
    if ((e as { code?: string }).code === "EAUTH") throw new MailAuthError(AUTH_HINT);
    throw new Error(`iCloud SMTP failed: ${(e as Error).message}`);
  } finally {
    transport.close();
  }

  let savedToSent = true;
  try {
    await appendTo("\\Sent", raw, ["\\Seen"], env);
  } catch (e) {
    savedToSent = false;
    console.error("sent, but could not file a copy in Sent Messages", e);
  }
  return { id: messageId(raw), savedToSent };
}

/** Saves the message to iCloud Drafts without sending. It syncs to Apple Mail
 *  with the PDF attached, ready to review and send from there. */
export async function createDraft(mail: OutgoingMail): Promise<{ id: string }> {
  const env = mailEnv();
  const raw = buildMime(mail, env.from);
  await appendTo("\\Drafts", raw, ["\\Draft", "\\Seen"], env);
  return { id: messageId(raw) };
}

/** Appends a message to the mailbox with the given special-use flag (RFC 6154).
 *  Looked up by flag rather than name because iCloud calls its sent folder
 *  "Sent Messages", and the flag is what Apple Mail itself goes by. */
async function appendTo(specialUse: "\\Sent" | "\\Drafts", raw: string, flags: string[], env: MailEnv) {
  const client = new ImapFlow({
    host: IMAP_HOST,
    port: 993,
    secure: true,
    auth: { user: env.user, pass: env.password },
    logger: false,
  });
  try {
    await client.connect();
  } catch (e) {
    if ((e as { authenticationFailed?: boolean }).authenticationFailed) throw new MailAuthError(AUTH_HINT);
    throw new Error(`iCloud IMAP failed: ${(e as Error).message}`);
  }
  try {
    const boxes = await client.list();
    const fallback = specialUse === "\\Sent" ? "Sent Messages" : "Drafts";
    const path = boxes.find((b) => b.specialUse === specialUse)?.path ?? fallback;
    const ok = await client.append(path, raw, flags, new Date());
    if (!ok) throw new Error(`iCloud refused to save the message to ${path}`);
  } finally {
    await client.logout().catch(() => {});
  }
}

function messageId(raw: string): string {
  return raw.match(/^Message-ID: <([^>]+)>/m)?.[1] ?? "";
}
