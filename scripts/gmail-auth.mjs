#!/usr/bin/env node
// (Re-)authorise Gmail sending. Run on your own machine:
//
//   npm run gmail:auth
//
// Opens Google's consent screen, catches the redirect locally, then writes
// the resulting refresh token straight into .env.local AND (if the Vercel
// CLI is installed and linked) into the Vercel project's Production +
// Preview env vars — no manual copy-pasting into two places.
//
// ⚠️  If your OAuth app is still in "Testing" publishing status, the refresh
// token this produces WILL stop working in 7 days — that's a hard Google
// rule, not a bug. Fix it once, permanently:
//   Google Cloud Console → APIs & Services → OAuth consent screen → Publish App
// You'll still see an "unverified app" warning on the consent screen each
// time you re-auth — that's expected for personal use, click through it.
//
// Prerequisites, in Google Cloud Console (console.cloud.google.com):
//   1. Create a project, enable the Gmail API.
//   2. OAuth consent screen: External, add yourself as a test user, then
//      Publish App (see the warning above).
//   3. Credentials → OAuth client ID → Web application, with
//      http://localhost:53682/oauth2callback as an authorised redirect URI.
//   4. Put the client id/secret in .env.local as GOOGLE_CLIENT_ID and
//      GOOGLE_CLIENT_SECRET before running this.

import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;
const SCOPE = "https://www.googleapis.com/auth/gmail.compose";
const ENV_PATH = fileURLToPath(new URL("../.env.local", import.meta.url));

// Read .env.local directly: this is a standalone script, not a Next process,
// so it doesn't get Next's automatic env loading.
function envFromFile() {
  const out = {};
  try {
    for (const line of readFileSync(ENV_PATH, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch { /* file is optional; env vars may be set another way */ }
  return out;
}

/** Upserts KEY=value lines into .env.local, preserving everything else
 *  (comments, blank lines, unrelated vars) and each key's existing position
 *  if it's already there. */
function writeEnvLocal(updates) {
  let text = "";
  try { text = readFileSync(ENV_PATH, "utf8"); } catch { /* created fresh below */ }
  let lines = text.length ? text.split("\n") : [];
  const remaining = new Map(Object.entries(updates));

  lines = lines.map((line) => {
    const m = line.match(/^([A-Z0-9_]+)=/);
    if (m && remaining.has(m[1])) {
      const key = m[1];
      const value = remaining.get(key);
      remaining.delete(key);
      return `${key}=${value}`;
    }
    return line;
  });

  if (remaining.size) {
    if (lines.length && lines[lines.length - 1] !== "") lines.push("");
    for (const [key, value] of remaining) lines.push(`${key}=${value}`);
  }

  writeFileSync(ENV_PATH, lines.join("\n").replace(/\n{3,}$/, "\n\n"));
}

/** Best-effort push to Vercel's Production + Preview env vars, via the
 *  `vercel` CLI. Silently skipped (not a hard failure) if the CLI is
 *  missing or the project isn't linked — .env.local is already updated
 *  either way, and the setup doc covers the manual fallback. */
function pushToVercel(key, value) {
  const hasCli = spawnSync("vercel", ["--version"], { stdio: "ignore" }).status === 0;
  if (!hasCli) return { pushed: false, reason: "Vercel CLI not found on PATH" };
  if (!existsSync(fileURLToPath(new URL("../.vercel/project.json", import.meta.url)))) {
    return { pushed: false, reason: "this directory isn't linked to a Vercel project (run `vercel link`)" };
  }
  for (const target of ["production", "preview"]) {
    // --force overwrites the existing value instead of failing when the key
    // is already set, which it will be on every re-auth after the first.
    const add = spawnSync(
      "vercel", ["env", "add", key, target, "--value", value, "--force", "--yes"],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    if (add.status !== 0) {
      return { pushed: false, reason: `\`vercel env add ${key} ${target}\` failed: ${add.stderr?.toString().trim()}` };
    }
  }
  return { pushed: true };
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

  reply(res, 200, `Authorised <strong>${address}</strong>. Saving the token now — check the terminal.`);

  console.log(`\n  Authorised mailbox: ${address}\n`);

  writeEnvLocal({ GMAIL_SENDER: address, GMAIL_REFRESH_TOKEN: json.refresh_token });
  console.log("  ✓ Wrote GMAIL_SENDER and GMAIL_REFRESH_TOKEN into .env.local");

  console.log("  Pushing to Vercel (production + preview)…");
  const senderPush = pushToVercel("GMAIL_SENDER", address);
  const tokenPush = pushToVercel("GMAIL_REFRESH_TOKEN", json.refresh_token);
  if (senderPush.pushed && tokenPush.pushed) {
    console.log("  ✓ Updated GMAIL_SENDER and GMAIL_REFRESH_TOKEN on Vercel — redeploy to pick them up:");
    console.log("      vercel --prod\n");
  } else {
    console.log(`  ⚠ Couldn't update Vercel automatically (${(senderPush.reason || tokenPush.reason)}).`);
    console.log("    Paste these into the Vercel dashboard yourself (Settings → Environment Variables):\n");
    console.log(`GMAIL_SENDER=${address}`);
    console.log(`GMAIL_REFRESH_TOKEN=${json.refresh_token}\n`);
  }
  console.log("  Treat the refresh token like a password — it can send mail as you.\n");

  server.close();
  process.exit(0);
});

server.listen(PORT, () => {
  console.log("\n  Opening Google's consent screen in your browser.");
  console.log("  If it doesn't open, paste this URL in yourself:\n");
  console.log(`  ${authUrl}\n`);
  console.log("  Reminder: if the OAuth consent screen is still in \"Testing\" status, this");
  console.log("  token will stop working again in 7 days. Publish it once, permanently:");
  console.log("  https://console.cloud.google.com/apis/credentials/consent\n");
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  spawn(opener, [authUrl], { stdio: "ignore", detached: true, shell: process.platform === "win32" }).unref();
});
