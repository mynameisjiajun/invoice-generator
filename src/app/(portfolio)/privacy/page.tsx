import type { Metadata } from "next";
import Link from "next/link";

// Required by Google before an OAuth app can leave "Testing" publishing
// status (Google Auth Platform → Branding needs a reachable privacy policy
// URL on an authorized domain). It sits in the (portfolio) route group so
// it's public — `proxy.ts` only gates /invoices_login/*, so this stays
// reachable without a session, which Google's crawler requires.
//
// The Gmail section exists because the invoice tool requests the
// gmail.compose scope. Google's Limited Use disclosure is not boilerplate
// here: it's the specific commitment that makes the scope defensible, and
// it must stay true of the code (see src/lib/gmail.ts — send/draft only,
// no read, no storage of message content).

export const metadata: Metadata = {
  title: "Privacy Policy — Apex Cinematics",
  description:
    "How Apex Cinematics handles client information and Google user data in its invoicing tool.",
};

const UPDATED = "22 September 2026";
const CONTACT = "chuajiajun2705@gmail.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="text-3xl md:text-4xl font-apex-display text-brand-paper mb-4">
        {title}
      </h2>
      <div className="space-y-4 text-brand-muted leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-brand-dark text-brand-paper font-apex-sans selection:bg-brand-accent selection:text-brand-dark">
      <div className="max-w-3xl mx-auto px-6 py-20 md:py-28">
        <Link
          href="/"
          className="text-brand-muted hover:text-brand-paper transition-colors"
        >
          ← Apex Cinematics
        </Link>

        <h1 className="mt-8 text-5xl md:text-7xl font-apex-display leading-[1.02]">
          Privacy Policy
        </h1>
        <p className="mt-4 text-sm text-brand-muted">
          Last updated {UPDATED}
        </p>

        <div className="mt-14">
          <Section title="Who this covers">
            <p>
              Apex Cinematics is a one-person videography and photography business operated by
              Chua Jia Jun in Singapore. This policy covers this website and the private
              invoicing tool used to bill clients for booked work.
            </p>
            <p>
              The invoicing tool is not a public product. It has exactly one user — the business
              owner — and there is no sign-up. Nobody else can create an account.
            </p>
          </Section>

          <Section title="Client information we hold">
            <p>
              To issue an invoice, the tool stores what an invoice needs: your name, and where
              supplied, your company name, email address, phone number, billing address and UEN,
              along with details of the booked job and the amounts charged.
            </p>
            <p>
              This information comes from you directly, when you book work. It is stored in a
              private database hosted by Supabase (Singapore region), accessible only to the
              business owner&apos;s authenticated account and protected by row-level security
              rules at the database itself.
            </p>
            <p>
              We do not sell this information, share it for advertising, or pass it to anyone
              beyond the service providers listed below.
            </p>
          </Section>

          <Section title="Google user data (Gmail)">
            <p>
              The invoicing tool can send invoices from the business owner&apos;s own Gmail
              account. To do this it requests a single Google OAuth scope:
              <code className="mx-1 px-1.5 py-0.5 bg-brand-gray text-brand-accent text-sm rounded">
                gmail.compose
              </code>
              which permits creating drafts and sending mail, and nothing else.
            </p>
            <p>
              <strong className="text-brand-paper">
                It cannot read your inbox, and it does not have permission to.
              </strong>{" "}
              No mailbox contents are ever requested, retrieved, analysed or stored. The only
              Google data retained is an OAuth refresh token authorising the app to send as the
              business owner, plus the owner&apos;s own email address. Both are held as encrypted
              server-side environment variables and are never exposed to any browser.
            </p>
            <p>
              Invoice emails themselves are composed by the tool and handed to Gmail for
              delivery. They are stored in the owner&apos;s own Gmail account exactly as any sent
              email would be.
            </p>
            <p className="border-l-2 border-brand-accent pl-4">
              Apex Cinematics&apos; use and transfer of information received from Google APIs
              adheres to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-paper hover:text-white underline decoration-brand-paper/30 underline-offset-4 transition-colors"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements. Google user data is used solely to send
              invoices on the owner&apos;s behalf. It is never used for advertising, never sold,
              never transferred to third parties except as required to provide this feature or
              to comply with law, and never used to train generalised AI or machine learning
              models.
            </p>
          </Section>

          <Section title="Service providers">
            <p>The tool relies on three providers, each handling data on our behalf:</p>
            <ul className="space-y-2 list-none">
              {[
                ["Supabase", "database and authentication, Singapore region"],
                ["Vercel", "application hosting and delivery"],
                ["Google (Gmail API)", "sending invoice emails, only as described above"],
              ].map(([name, role]) => (
                <li key={name} className="flex gap-3">
                  <span className="text-brand-accent mt-1">—</span>
                  <span>
                    <strong className="text-brand-paper">{name}</strong>
                    <span className="text-brand-muted"> · {role}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p>
              This website uses Vercel Analytics, which records aggregate page-view counts. It
              does not use cookies and does not build a profile of individual visitors.
            </p>
          </Section>

          <Section title="How long we keep it">
            <p>
              Invoice and client records are kept as long as needed to run the business and to
              meet Singapore record-keeping obligations for business transactions. You can ask
              for your details to be corrected or removed at any time, subject to records we are
              legally required to retain.
            </p>
          </Section>

          <Section title="Your choices">
            <p>
              You may request a copy of the information held about you, ask for corrections, or
              ask for deletion, by emailing the address below.
            </p>
            <p>
              The business owner can revoke the tool&apos;s Google access at any time from{" "}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-paper hover:text-white underline decoration-brand-paper/30 underline-offset-4 transition-colors"
              >
                Google Account permissions
              </a>
              , which immediately and permanently ends the app&apos;s ability to send mail.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about this policy, or about information held about you:{" "}
              <a
                href={`mailto:${CONTACT}`}
                className="text-brand-paper hover:text-white underline decoration-brand-paper/30 underline-offset-4 transition-colors"
              >
                {CONTACT}
              </a>
            </p>
          </Section>
        </div>

        <div className="mt-16 pt-8 border-t border-brand-rule">
          <Link
            href="/"
            className="text-brand-muted hover:text-brand-paper transition-colors"
          >
            ← Back to Apex Cinematics
          </Link>
        </div>
      </div>
    </div>
  );
}
