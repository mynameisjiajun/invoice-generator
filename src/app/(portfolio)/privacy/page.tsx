import type { Metadata } from "next";
import Link from "next/link";

// Public privacy policy for the website and the invoicing tool. It sits in
// the (portfolio) route group so it's public — `proxy.ts` only gates
// /invoices_login/*. The Email section must stay true of the code (see
// src/lib/mail.ts — it only sends and files copies, it never reads mail).

export const metadata: Metadata = {
  title: "Privacy Policy — Apex Cinematics",
  description:
    "How Apex Cinematics handles client information in its website and invoicing tool.",
  alternates: { canonical: "https://apexcinematics.tech/privacy" },
};

const UPDATED = "24 October 2026";
const CONTACT = "contact@apexcinematics.tech";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="text-2xl md:text-3xl font-apex-display font-bold text-white uppercase tracking-tight mb-4">
        {title}
      </h2>
      <div className="space-y-4 text-neutral-400 leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-brand-dark text-neutral-200 font-apex-sans selection:bg-brand-orange selection:text-white">
      <div className="max-w-3xl mx-auto px-6 py-20 md:py-28">
        <Link
          href="/"
          className="text-brand-orange text-xs font-bold uppercase tracking-[0.2em] hover:text-white transition-colors"
        >
          ← Apex Cinematics
        </Link>

        <h1 className="mt-8 text-4xl md:text-6xl font-apex-display font-bold text-white uppercase leading-[0.95]">
          Privacy Policy
        </h1>
        <p className="mt-4 font-mono text-xs text-neutral-600 tracking-widest uppercase">
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

          <Section title="Email">
            <p>
              Invoices and receipts are emailed from the business&apos;s own address,
              chuajiajun@apexcinematics.tech, which is hosted by Apple iCloud Mail. The tool
              hands each message to iCloud for delivery and files a copy in the business&apos;s
              own Sent Messages folder, exactly as any sent email would be stored.
            </p>
            <p>
              <strong className="text-neutral-200">
                The tool never reads the mailbox.
              </strong>{" "}
              Its only stored credential is an app-specific password that lets it send as the
              business. It is kept as an encrypted server-side environment variable and is never
              exposed to any browser.
            </p>
          </Section>

          <Section title="Service providers">
            <p>The tool relies on three providers, each handling data on our behalf:</p>
            <ul className="space-y-2 list-none">
              {[
                ["Supabase", "database and authentication, Singapore region"],
                ["Vercel", "application hosting and delivery"],
                ["Apple (iCloud Mail)", "sending invoice emails, only as described above"],
              ].map(([name, role]) => (
                <li key={name} className="flex gap-3">
                  <span className="text-brand-orange mt-1">—</span>
                  <span>
                    <strong className="text-neutral-200">{name}</strong>
                    <span className="text-neutral-500"> · {role}</span>
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
              The business owner can revoke the tool&apos;s email access at any time by deleting
              its app-specific password in the Apple Account settings, which immediately ends
              the app&apos;s ability to send mail.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about this policy, or about information held about you:{" "}
              <a
                href={`mailto:${CONTACT}`}
                className="text-brand-orange hover:text-white underline underline-offset-4 transition-colors"
              >
                {CONTACT}
              </a>
            </p>
          </Section>
        </div>

        <div className="mt-16 pt-8 border-t border-neutral-800">
          <Link
            href="/"
            className="text-neutral-500 text-xs font-bold uppercase tracking-[0.2em] hover:text-brand-orange transition-colors"
          >
            ← Back to Apex Cinematics
          </Link>
        </div>
      </div>
    </div>
  );
}
