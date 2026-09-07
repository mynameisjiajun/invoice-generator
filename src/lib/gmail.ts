// Minimal Gmail API client for sending invoices from the owner's own Gmail.
//
// Deliberately no `googleapis` dependency: this needs exactly two endpoints
// (refresh a token, post a message), and that package pulls in a very large
// tree for the privilege. Everything here is server-only — the refresh token
// must never reach the browser.
//
// Auth model: one Google account (the app is single-user), authorised once via
// `npm run gmail:auth`, which prints a refresh token to paste into
// GMAIL_REFRESH_TOKEN. Refresh tokens don't expire on their own, but Google
// revokes them if the OAuth app stays in "Testing" for 7 days, if the password
// changes, or if access is revoked — re-run the script when that happens.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

/** The single scope this app needs. `gmail.compose` covers both creating
 *  drafts and sending, without granting any read access to the inbox. */
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.compose";

export class GmailNotConfiguredError extends Error {}
export class GmailAuthError extends Error {}

type GmailEnv = { clientId: string; clientSecret: string; refreshToken: string; sender: string };

export function gmailEnv(): GmailEnv {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  const sender = process.env.GMAIL_SENDER;
  const missing = [
    !clientId && "GOOGLE_CLIENT_ID",
    !clientSecret && "GOOGLE_CLIENT_SECRET",
    !refreshToken && "GMAIL_REFRESH_TOKEN",
    !sender && "GMAIL_SENDER",
  ].filter(Boolean);
  if (missing.length) {
    throw new GmailNotConfiguredError(`Gmail is not set up — missing ${missing.join(", ")}`);
  }
  return { clientId: clientId!, clientSecret: clientSecret!, refreshToken: refreshToken!, sender: sender! };
}

/** Trades the long-lived refresh token for a short-lived access token.
 *  Not cached: invoices are sent a handful of times a day, so the extra
 *  round-trip is irrelevant next to the risk of serving a stale token from a
 *  reused Fluid Compute instance. */
export async function accessToken(env: GmailEnv = gmailEnv()): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      refresh_token: env.refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string; error?: string };
  if (!res.ok || !json.access_token) {
    // The common case here is invalid_grant: the refresh token was revoked.
    // Say so plainly, because the fix (re-run the auth script) isn't guessable.
    throw new GmailAuthError(
      json.error === "invalid_grant"
        ? "Gmail authorisation has expired or been revoked — re-run `npm run gmail:auth` and update GMAIL_REFRESH_TOKEN."
        : `Could not refresh Gmail token: ${json.error_description ?? json.error ?? res.status}`
    );
  }
  return json.access_token;
}

/** RFC 2047 encoded-word, so non-ASCII in a subject or display name survives.
 *  Header values must be plain ASCII on the wire; an em dash in a job name or
 *  an accent in a client's name would otherwise arrive as mojibake. */
function encodeHeader(value: string): string {
  const clean = value.replace(/[\r\n]+/g, " ").trim();
  if (/^[\x20-\x7E]*$/.test(clean)) return clean;
  return `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`;
}

/** Gmail's `raw` field is base64url with no padding. */
function base64Url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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

/** Builds a multipart/mixed MIME message. Headers and boundaries use CRLF,
 *  which the RFC requires and Gmail enforces. */
export function buildMime(mail: OutgoingMail, from: string): string {
  const boundary = `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const fromHeader = mail.senderName ? `${encodeHeader(mail.senderName)} <${from}>` : from;
  const headers = [
    `From: ${fromHeader}`,
    `To: ${encodeHeader(mail.to)}`,
    `Subject: ${encodeHeader(mail.subject)}`,
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
  return [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(Buffer.from(mail.body, "utf8").toString("base64")),
    "",
    `--${boundary}`,
    `Content-Type: ${mimeType}; name="${filename.replace(/"/g, "")}"`,
    `Content-Disposition: attachment; filename="${filename.replace(/"/g, "")}"`,
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(content.toString("base64")),
    "",
    `--${boundary}--`,
  ].join("\r\n");
}

async function postToGmail(path: string, payload: unknown, token: string): Promise<{ id: string }> {
  const res = await fetch(`${GMAIL_API}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!res.ok || !json.id) {
    throw new Error(`Gmail API ${path} failed (${res.status}): ${json.error?.message ?? "unknown error"}`);
  }
  return { id: json.id };
}

/** Sends the message immediately. Returns Gmail's message id. */
export async function sendMail(mail: OutgoingMail): Promise<{ id: string }> {
  const env = gmailEnv();
  const token = await accessToken(env);
  const raw = base64Url(Buffer.from(buildMime(mail, env.sender), "utf8"));
  return postToGmail("messages/send", { raw }, token);
}

/** Saves the message to Drafts without sending. Returns the draft id, which
 *  the UI turns into a compose URL so the user can review and press send. */
export async function createDraft(mail: OutgoingMail): Promise<{ id: string }> {
  const env = gmailEnv();
  const token = await accessToken(env);
  const raw = base64Url(Buffer.from(buildMime(mail, env.sender), "utf8"));
  return postToGmail("drafts", { message: { raw } }, token);
}
