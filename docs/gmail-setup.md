# Sending invoices from Gmail

The app emails invoices from **chuajiajun2705@gmail.com** using the Gmail API.
Two buttons appear on an invoice once the client has an email address saved:

- **Email now** — sends immediately (behind a confirmation), attaches the PDF,
  and marks the invoice sent.
- **Draft email** — puts the same message in Gmail Drafts and opens Drafts in a
  new tab, so you can read it before pressing send.

The older **Send invoice** button (share sheet / download + compose) is
unchanged, and is still the right thing on a phone.

## One-time setup

### 1. Google Cloud project

At <https://console.cloud.google.com>:

1. Create a project (any name).
2. **APIs & Services → Library** → enable the **Gmail API**.
3. **OAuth consent screen** → User type **External**. Fill in the app name and
   your email. Under **Test users**, add `chuajiajun2705@gmail.com`.
   Leave the app in *Testing* — you never need to publish it or go through
   Google's verification review, because you are the only user.
4. **Credentials → Create credentials → OAuth client ID → Web application**.
   Under *Authorised redirect URIs* add exactly:

   ```
   http://localhost:53682/oauth2callback
   ```

5. Copy the client ID and client secret into `.env.local`:

   ```
   GOOGLE_CLIENT_ID=…apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=…
   ```

### 2. Authorise your mailbox

```sh
npm run gmail:auth
```

This opens Google's consent screen, catches the redirect on localhost, and
prints a refresh token. Sign in as `chuajiajun2705@gmail.com` — the script
prints back which mailbox it authorised, so a wrong-account consent is obvious.

Google will show an "unverified app" warning because the app is in Testing.
That is expected: click **Advanced → Go to … (unsafe)**. You are the developer
and the only user.

Paste the two printed values into `.env.local`.

### 3. Vercel

Add all four variables to the Vercel project (Settings → Environment
Variables), then redeploy:

```
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GMAIL_REFRESH_TOKEN
GMAIL_SENDER
```

`vercel env add GOOGLE_CLIENT_ID production` does the same from the CLI.

## Scope

The app requests only `gmail.compose` — enough to create drafts and send mail
**as** you. It grants no access to read your inbox. "Automatically managing"
incoming mail would need a broader read scope and was deliberately left out.

## When it stops working

A refresh token doesn't expire on a timer, but Google revokes it if:

- the OAuth consent screen sits in *Testing* for more than 7 days **and** the
  token was issued before that — re-running `npm run gmail:auth` fixes it;
- the Google account password changes;
- you revoke access at <https://myaccount.google.com/permissions>.

The symptom is a clear error in the app: *"Gmail authorisation has expired or
been revoked — re-run `npm run gmail:auth`."* Do that, update
`GMAIL_REFRESH_TOKEN` locally and in Vercel, redeploy.

If `npm run gmail:auth` returns an access token but **no** refresh token, the
account has already consented. Revoke at the permissions link above and rerun.

## Security notes

- `GMAIL_REFRESH_TOKEN` can send mail as you. Treat it like a password. It is
  read only in server code (`src/lib/gmail.ts`) and never reaches the browser.
- `/api/gmail/send` requires a signed-in Supabase session, and derives the
  recipient, subject and body from the database rather than the request body —
  so the route can't be used as an open relay. The most a caller can do is send
  a real client their own real invoice.
- Header values are stripped of CR/LF before being written into the MIME
  message, so a crafted client name or job title can't inject a `Bcc:`.
