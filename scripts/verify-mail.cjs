// Checks the iCloud mail credentials without sending anything: an SMTP login
// and an IMAP folder listing. Prints no secrets. Run from the project root:
//
//   node --env-file=.env.local scripts/verify-mail.cjs
const nodemailer = require("nodemailer");
const { ImapFlow } = require("imapflow");

const { ICLOUD_USER: user, ICLOUD_APP_PASSWORD: pass, MAIL_FROM: from } = process.env;
console.log("vars set:", { ICLOUD_USER: !!user, ICLOUD_APP_PASSWORD: !!pass, MAIL_FROM: from });
console.log("user looks like Apple ID (not custom domain):", !!user && !user.endsWith("@apexcinematics.tech"));

(async () => {
  const t = nodemailer.createTransport({ host: "smtp.mail.me.com", port: 587, secure: false, requireTLS: true, auth: { user, pass }, connectionTimeout: 15000, greetingTimeout: 15000 });
  try {
    await t.verify();
    console.log("SMTP login: OK");
  } catch (e) {
    console.log("SMTP login FAILED:", e.code, e.response || e.message);
  }
  t.close();

  const c = new ImapFlow({ host: "imap.mail.me.com", port: 993, secure: true, auth: { user, pass }, logger: false, connectionTimeout: 15000 });
  try {
    await c.connect();
    const boxes = await c.list();
    console.log("IMAP login: OK; special folders:", boxes.filter((b) => b.specialUse).map((b) => `${b.specialUse} -> ${b.path}`).join(", "));
    await c.logout();
  } catch (e) {
    console.log("IMAP FAILED:", e.authenticationFailed ? "auth failed" : e.message);
  }
})();
