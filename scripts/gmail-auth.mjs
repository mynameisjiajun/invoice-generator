#!/usr/bin/env node
// One-time Google OAuth consent, run on your own machine:
//
//   npm run gmail:auth
//
// Prints a refresh token to paste into GMAIL_REFRESH_TOKEN (locally in
// .env.local, and in the Vercel project's environment variables). Nothing here
// runs in production — the deployed app only ever refreshes the token this
// produces.
//
// Prerequisites, in Google Cloud Console (console.cloud.google.com):
//   1. Create a project, enable the Gmail API.
//   2. OAuth consent screen: External, add yourself as a test user.
//   3. Credentials → OAuth client ID → Web application, with
//      http://localhost:53682/oauth2callback as an authorised redirect URI.
//   4. Put the client id/secret in .env.local as GOOGLE_CLIENT_ID and
//      GOOGLE_CLIENT_SECRET before running this.

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";

const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;
const SCOPE = "https://www.googleapis.com/auth/gmail.compose";

// Read .env.local directly: this is a standalone script, not a Next process,
// so it doesn't get Next's automatic env loading.
function envFromFile() {
  const out = {};
  try {
    for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch { /* file is optional; env vars may be set another way */ }
  return out;
}

const fileEnv = envFromFile();
const clientId = process.env.GOOGLE_CLIENT_ID || fileEnv.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET || fileEnv.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error("Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (checked env and .env.local).");
  console.error("Create an OAuth client in Google Cloud Console first — see the header of this file.");
  process.exit(1);
}

// A random state value, checked on the way back, so a stray request to this
// short-lived local server can't feed us someone else's authorisation code.
const state = Math.random().toString(36).slice(2) + Date.now().toString(36);

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",   // without this, no refresh token is issued
    prompt: "consent",        // forces a fresh refresh token on re-runs
    state,
  });

function reply(res, status, message) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><meta charset="utf-8"><body style="font:16px system-ui;padding:3rem">
    <p>${message}</p><p>You can close this tab and return to the terminal.</p>`);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== "/oauth2callback") return reply(res, 404, "Not found.");

  const error = url.searchParams.get("error");
  if (error) {
    reply(res, 400, `Authorisation failed: ${error}`);
    console.error(`\nGoogle returned an error: ${error}`);
    server.close();
    process.exit(1);
  }

  if (url.searchParams.get("state") !== state) {
    reply(res, 400, "State mismatch — ignoring this response.");
    return;
  }

  const code = url.searchParams.get("code");
  if (!code) return reply(res, 400, "No authorisation code in the callback.");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: clientId, client_secret: clientSecret,
      redirect_uri: REDIRECT_URI, grant_type: "authorization_code",
    }),
  });
  const json = await tokenRes.json();

  if (!tokenRes.ok || !json.refresh_token) {
    reply(res, 500, "Token exchange failed — see the terminal.");
    console.error("\nToken exchange failed:", JSON.stringify(json, null, 2));
    if (tokenRes.ok && !json.refresh_token) {
      console.error("\nGoogle returned an access token but no refresh token. That happens when the");
      console.error("account has already granted consent. Revoke it at");
      console.error("https://myaccount.google.com/permissions and run this again.");
    }
    server.close();
    process.exit(1);
  }

  // Confirm which mailbox was actually authorised, so a wrong-account consent
  // is caught here rather than by an invoice arriving from the wrong address.
  let address = "(unknown)";
  try {
    const profile = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${json.access_token}` },
    });
    if (profile.ok) address = (await profile.json()).emailAddress ?? address;
  } catch { /* non-fatal — the token is still good */ }

  reply(res, 200, `Authorised <strong>${address}</strong>. The refresh token is in your terminal.`);

  console.log(`\n  Authorised mailbox: ${address}\n`);
  console.log("  Add these to .env.local and to your Vercel project's env vars:\n");
  console.log(`GMAIL_SENDER=${address}`);
  console.log(`GMAIL_REFRESH_TOKEN=${json.refresh_token}\n`);
  console.log("  Treat the refresh token like a password — it can send mail as you.\n");

  server.close();
  process.exit(0);
});

server.listen(PORT, () => {
  console.log("\n  Opening Google's consent screen in your browser.");
  console.log("  If it doesn't open, paste this URL in yourself:\n");
  console.log(`  ${authUrl}\n`);
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  spawn(opener, [authUrl], { stdio: "ignore", detached: true, shell: process.platform === "win32" }).unref();
});
