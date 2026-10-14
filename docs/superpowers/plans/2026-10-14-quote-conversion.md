# Quote-focused Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape the apexcinematics.tech homepage around one action — "Get a quote" — for corporate and social-content buyers.

**Architecture:** Copy and data that both the client page and the server JSON-LD need live in a new pure module `src/components/portfolio/quote.ts` (unit-tested in node). `Portfolio.tsx` holds the selected shoot type in state and passes it to a now-controlled `EnquiryForm`. A small `MobileQuoteBar` component watches `#home` and `#contact` with IntersectionObserver.

**Tech Stack:** Next.js 16 App Router (see `node_modules/next/dist/docs/` — this version differs from older Next), React 19, Tailwind v4, lucide-react, vitest (node environment, `src/**/*.test.ts` only — no component tests).

**Spec:** `docs/superpowers/specs/2026-10-13-quote-conversion-design.md`

## Global Constraints

- No prices or packages anywhere (do not use the word "packages").
- Contact only via form, `contact@apexcinematics.tech`, Instagram `@ApexCinematicsSG`. No Telegram/WhatsApp links or labels.
- Never mention travel. Never state a number of revisions.
- Stated facts: reply within 24 hours; edited files within 14 days; footage usable in ads at no extra cost; short notice possible if the date is free.
- Keep existing visual language: `font-apex-display` (Oswald) headings, `font-apex-sans` (Inter) body, `brand-orange` (#FF6B00) on `brand-dark`/black, `ScrollReveal`, `SectionHeader`.
- Hero eyebrow text exactly: `Corporate & Social Videography · Singapore`.

## Review Focus

- A visitor clicks "Get a quote for this" on one service, then on another — the form must show the second service (controlled select). → manual check, Task 5.
- A phone user types in the form — the quote bar must not cover it. → `quoteBarVisible` test, Task 2.
- Copy drifting into forbidden topics (travel, revisions, packages). → copy guard test, Task 2.
- An enquiry submitted from a page cached before this change with a retired choice — accepted with the type blanked, not rejected. → test, Task 1.
- FAQ JSON-LD containing `<` breaking out of the script tag — reuse the existing `<` escape. → Task 4.

---

### Task 1: New shoot-type choices

**Files:**
- Modify: `src/lib/enquiry.ts:5`
- Test: `src/lib/enquiry.test.ts`

**Interfaces:**
- Produces: `SHOOT_TYPES = ["Corporate event", "Social media content", "Documentary", "Other event", "Something else"] as const`

- [ ] **Step 1: Update the tests**

In `src/lib/enquiry.test.ts`, change the `valid` fixture's `shoot_type: "Event"` to `shoot_type: "Corporate event"`, and add to `describe("parseEnquiry")`:

```ts
  it("offers the corporate/social choices and blanks retired ones", () => {
    for (const t of ["Corporate event", "Social media content", "Documentary", "Other event", "Something else"]) {
      const r = parseEnquiry(form({ ...valid, shoot_type: t }));
      expect(r.ok && r.value.shoot_type).toBe(t);
    }
    // A page cached before this change still submits fine; the type is just dropped.
    const old = parseEnquiry(form({ ...valid, shoot_type: "Portraits or a photoshoot" }));
    expect(old).toMatchObject({ ok: true, value: { shoot_type: "" } });
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/enquiry.test.ts`
Expected: FAIL ("Corporate event" is blanked to "").

- [ ] **Step 3: Implement**

`src/lib/enquiry.ts` line 5:

```ts
export const SHOOT_TYPES = ["Corporate event", "Social media content", "Documentary", "Other event", "Something else"] as const;
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/enquiry.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/enquiry.ts src/lib/enquiry.test.ts
git commit -m "feat(enquiry): corporate/social shoot types"
```

---

### Task 2: Quote content module

**Files:**
- Create: `src/components/portfolio/quote.ts`
- Test: `src/components/portfolio/quote.test.ts`

**Interfaces:**
- Consumes: `SHOOT_TYPES` (Task 1)
- Produces:
  - `type ShootType = (typeof SHOOT_TYPES)[number]`
  - `SERVICE_SHOOT_TYPE: Record<"s1" | "s2" | "s3", ShootType>`
  - `PROCESS_STEPS: { title: string; text: string }[]`
  - `FAQS: { q: string; a: string }[]`
  - `faqJsonLd(faqs: { q: string; a: string }[]): object`
  - `quoteBarVisible(heroInView: boolean, contactInView: boolean): boolean`

- [ ] **Step 1: Write the failing test**

`src/components/portfolio/quote.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SHOOT_TYPES } from "@/lib/enquiry";
import { FAQS, PROCESS_STEPS, SERVICE_SHOOT_TYPE, faqJsonLd, quoteBarVisible } from "./quote";

describe("SERVICE_SHOOT_TYPE", () => {
  it("maps every service card to an offered form choice", () => {
    expect(SERVICE_SHOOT_TYPE).toEqual({ s1: "Corporate event", s2: "Documentary", s3: "Social media content" });
    for (const t of Object.values(SERVICE_SHOOT_TYPE)) expect(SHOOT_TYPES).toContain(t);
  });
});

describe("copy guard", () => {
  it("never mentions travel, revisions or packages", () => {
    const text = [...FAQS.flatMap((f) => [f.q, f.a]), ...PROCESS_STEPS.flatMap((s) => [s.title, s.text])].join(" ");
    expect(text).not.toMatch(/travel|revision|package|overseas/i);
  });
  it("states the agreed facts", () => {
    const text = FAQS.map((f) => f.a).join(" ");
    expect(text).toMatch(/14 days/);
    expect(text).toMatch(/24 hours/);
    expect(text).toMatch(/no extra cost/);
  });
});

describe("faqJsonLd", () => {
  it("builds a schema.org FAQPage", () => {
    expect(faqJsonLd([{ q: "Q?", a: "A." }])).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [{ "@type": "Question", name: "Q?", acceptedAnswer: { "@type": "Answer", text: "A." } }],
    });
  });
});

describe("quoteBarVisible", () => {
  it("shows only once the hero is gone and the form isn't on screen", () => {
    expect(quoteBarVisible(true, false)).toBe(false);
    expect(quoteBarVisible(false, false)).toBe(true);
    expect(quoteBarVisible(false, true)).toBe(false);
    expect(quoteBarVisible(true, true)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/portfolio/quote.test.ts`
Expected: FAIL — cannot resolve `./quote`.

- [ ] **Step 3: Implement**

`src/components/portfolio/quote.ts`:

```ts
// Copy and small rules for the quote-focused homepage. Plain data (no React)
// so the server page can build FAQ JSON-LD from the same text the visitor sees.
import { SHOOT_TYPES } from "@/lib/enquiry";

export type ShootType = (typeof SHOOT_TYPES)[number];

/** Which form choice each service card's "Get a quote for this" preselects. */
export const SERVICE_SHOOT_TYPE: Record<"s1" | "s2" | "s3", ShootType> = {
  s1: "Corporate event",
  s2: "Documentary",
  s3: "Social media content",
};

export const PROCESS_STEPS = [
  { title: "Enquire", text: "Tell me what you need using the form or email. I reply within 24 hours." },
  { title: "Plan", text: "A quick call to lock in the brief, the date and your quote." },
  { title: "Shoot", text: "On the day, I work around your team with as little disruption as possible." },
  { title: "Deliver", text: "Edited files within 14 days, ready to post and share." },
];

export const FAQS = [
  {
    q: "How fast will I get my files?",
    a: "Edited files are delivered within 14 days of the shoot, for events and social content alike.",
  },
  {
    q: "Can we use the footage in ads?",
    a: "Yes. You get full usage rights for ads, social media and your website, at no extra cost.",
  },
  {
    q: "Can you shoot at short notice?",
    a: "Yes, if the date is free. Enquire as early as you can and I'll confirm availability within 24 hours.",
  },
  {
    q: "How do I get a quote?",
    a: "Send the form below or email contact@apexcinematics.tech. I'll reply within 24 hours with a free, no-obligation quote.",
  },
  {
    q: "Do you do ongoing social content?",
    a: "Yes. I can plan, shoot and edit Reels and TikToks with you every month, so your feed stays consistent.",
  },
];

export function faqJsonLd(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** The phone quote bar: hidden over the hero (it has its own button) and
 *  while the form is on screen (it would cover what they're typing). */
export function quoteBarVisible(heroInView: boolean, contactInView: boolean): boolean {
  return !heroInView && !contactInView;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/components/portfolio/quote.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/portfolio/quote.ts src/components/portfolio/quote.test.ts
git commit -m "feat(portfolio): quote copy, FAQ JSON-LD and quote-bar rule"
```

---

### Task 3: Shorter, controllable enquiry form

**Files:**
- Modify: `src/components/portfolio/EnquiryForm.tsx`
- Modify: `src/components/portfolio/Portfolio.tsx` (prop wiring only, so the build stays green)

**Interfaces:**
- Consumes: `SHOOT_TYPES` (Task 1)
- Produces: `EnquiryForm({ shootType, onShootTypeChange }: { shootType: string; onShootTypeChange: (t: string) => void })`; `Portfolio` state `shootType` / `setShootType`.

- [ ] **Step 1: Change the component signature**

Replace `export default function EnquiryForm() {` with:

```tsx
export default function EnquiryForm({ shootType, onShootTypeChange }: {
  shootType: string;
  onShootTypeChange: (t: string) => void;
}) {
```

- [ ] **Step 2: Success copy**

Replace `Thanks — I&apos;ll reply by email within a day.` with `Thanks — I&apos;ll reply by email within 24 hours.`

- [ ] **Step 3: Reorder fields; optional details behind a toggle**

Replace everything from the Name `<div>` through the message `<div className="sm:col-span-2">…</div>` with:

```tsx
      <div>
        <label htmlFor="enq-name" className={label}>Name</label>
        <input id="enq-name" name="name" required autoComplete="name" className={input} />
      </div>
      <div>
        <label htmlFor="enq-email" className={label}>Email</label>
        <input id="enq-email" name="email" type="email" required autoComplete="email" className={input} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="enq-type" className={label}>What do you need?</label>
        <select id="enq-type" name="shoot_type" value={shootType}
          onChange={(e) => onShootTypeChange(e.target.value)} className={input}>
          <option value="">Choose one</option>
          {SHOOT_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="enq-message" className={label}>Tell me about it</label>
        <textarea id="enq-message" name="message" required rows={5} className={input}
          placeholder="What's happening, where, and what you'd like to come away with." />
      </div>

      {/* Nice-to-haves stay out of the way; collapsed fields still submit. */}
      <details className="sm:col-span-2 group">
        <summary className="cursor-pointer list-none text-xs font-bold uppercase tracking-widest text-neutral-500 hover:text-white transition-colors">
          <span className="group-open:hidden">+ Add details</span>
          <span className="hidden group-open:inline">− Hide details</span>
          <span className="text-neutral-700"> (optional: phone, date, budget)</span>
        </summary>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label htmlFor="enq-phone" className={label}>Phone</label>
            <input id="enq-phone" name="phone" type="tel" autoComplete="tel" placeholder="+65" className={input} />
          </div>
          <div>
            <label htmlFor="enq-date" className={label}>Date</label>
            <input id="enq-date" name="shoot_date" type="date" className={`${input} [color-scheme:dark]`} />
          </div>
          <div>
            <label htmlFor="enq-budget" className={label}>Budget</label>
            <select id="enq-budget" name="budget" defaultValue="" className={input}>
              <option value="">Choose one</option>
              {BUDGETS.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
        </div>
      </details>
```

(The label "Phone / WhatsApp" becomes "Phone" — no WhatsApp per Global Constraints.)

- [ ] **Step 4: Wire the props in Portfolio**

In `Portfolio.tsx`, inside `Portfolio`, after the `filter` state:

```tsx
  // The service a visitor asked to quote; preselected in the form.
  const [shootType, setShootType] = useState("");
```

Replace `<EnquiryForm />` with `<EnquiryForm shootType={shootType} onShootTypeChange={setShootType} />`.

- [ ] **Step 5: Verify and commit**

Run: `npx tsc --noEmit && npx vitest run` → clean, all pass.

```bash
git add src/components/portfolio/EnquiryForm.tsx src/components/portfolio/Portfolio.tsx
git commit -m "feat(portfolio): shorter enquiry form with preselectable service"
```

---

### Task 4: FAQ structured data

**Files:**
- Modify: `src/app/(portfolio)/page.tsx`

**Interfaces:**
- Consumes: `FAQS`, `faqJsonLd` (Task 2)

- [ ] **Step 1: Import**

Add after the existing imports:

```ts
import { FAQS, faqJsonLd } from "@/components/portfolio/quote";
```

- [ ] **Step 2: Render a second JSON-LD script**

Duplicate the existing `<script type="application/ld+json" … />` element (page.tsx lines 58–63) and place the copy directly below the original. In the copy only:
- replace `JSON.stringify(jsonLd)` with `JSON.stringify(faqJsonLd(FAQS))` — keep the `.replace(/</g, "\\u003c")` escape exactly as is;
- replace its two comment lines with `// FAQ rich results; same "<" escaping as above.`

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit` → clean.

```bash
git add "src/app/(portfolio)/page.tsx"
git commit -m "feat(seo): FAQPage structured data"
```

---

### Task 5: Homepage sections and phone quote bar

**Files:**
- Create: `src/components/portfolio/MobileQuoteBar.tsx`
- Modify: `src/components/portfolio/Portfolio.tsx`

**Interfaces:**
- Consumes: `shootType`/`setShootType` (Task 3); `SERVICE_SHOOT_TYPE`, `PROCESS_STEPS`, `FAQS`, `quoteBarVisible` (Task 2)

- [ ] **Step 1: Imports**

In `Portfolio.tsx` add:

```tsx
import { FAQS, PROCESS_STEPS, SERVICE_SHOOT_TYPE } from './quote';
import MobileQuoteBar from './MobileQuoteBar';
```

- [ ] **Step 2: Nav and mobile-menu CTAs**

- Nav button text `Book Shoot` → `Get a Quote`.
- Mobile menu link text `Let&apos;s Talk` → `Get a Quote`.

- [ ] **Step 3: Hero**

- Eyebrow `Singapore Based` → `Corporate &amp; Social Videography · Singapore`.
- Intro paragraph text → `Video and photo for brands, events and social media in Singapore — from corporate events to monthly Reels, shot, edited and delivered fast.`
- Swap the two buttons so the orange one comes first and reads **Get a Quote**:

```tsx
                <a href="#contact" className="px-8 py-4 bg-brand-orange text-white font-bold uppercase tracking-wider hover:bg-orange-600 transition-all text-center">
                  Get a Quote
                </a>
                <a href="#portfolio" className="px-8 py-4 border border-white/20 bg-black/55 text-white font-bold uppercase tracking-wider hover:bg-white hover:text-black transition-all text-center">
                  View Work
                </a>
```

- [ ] **Step 4: Services copy and quote buttons**

In `SERVICES`:
- `s1.description` → `"Corporate events, launches, conferences and celebrations — covered properly, with highlight edits your team can post and share."`
- `s1.features` → `['Full-day or hourly coverage', 'Highlight + full edits', 'Delivered within 14 days', 'Photo + video teams']`
- `s3.description` → `'Reels and TikToks built to perform — planned with you, shot and cut for the platform, delivered ready to post. One-off or monthly.'`
- `s3.features` → `['Ready-to-post formats', 'Platform-native editing', 'One-off or monthly content', 'Trend-aware planning']`

Replace each service card's `Let&apos;s talk <ArrowRight size={14} />` link with:

```tsx
                  <a
                    href="#contact"
                    onClick={() => setShootType(SERVICE_SHOOT_TYPE[service.id as keyof typeof SERVICE_SHOOT_TYPE] ?? "")}
                    className="mt-8 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-brand-orange hover:text-white transition-colors"
                  >
                    Get a quote for this <ArrowRight size={14} />
                  </a>
```

(The About section's own "Let's talk" link stays as is.)

- [ ] **Step 5: How it works section**

Insert between the closing `</section>` of `#rates` and `{/* ABOUT SECTION */}`:

```tsx
      {/* PROCESS SECTION */}
      <section id="process" className="py-24 bg-brand-dark scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6">
          <ScrollReveal>
            <SectionHeader title="How It Works" subtitle="Process" index="03" />
          </ScrollReveal>
          <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {PROCESS_STEPS.map((step, i) => (
              <li key={step.title}>
                <ScrollReveal delayMs={i * 100}>
                  <div className="border-t-2 border-brand-orange pt-6">
                    <span className="font-mono text-xs text-neutral-500">0{i + 1}</span>
                    <h3 className="mt-2 text-2xl font-apex-display font-bold text-white uppercase">{step.title}</h3>
                    <p className="mt-3 text-neutral-400 text-sm leading-relaxed">{step.text}</p>
                  </div>
                </ScrollReveal>
              </li>
            ))}
          </ol>
        </div>
      </section>
```

- [ ] **Step 6: About headline (no travel)**

`Shooting Everywhere.` → `Shooting For Brands.`

- [ ] **Step 7: FAQ section**

Insert directly before `{/* CONTACT SECTION */}`:

```tsx
      {/* FAQ SECTION */}
      <section id="faq" className="py-24 bg-neutral-900 border-t border-neutral-800 scroll-mt-20">
        <div className="max-w-4xl mx-auto px-6">
          <ScrollReveal>
            <SectionHeader title="Questions" subtitle="FAQ" index="04" />
          </ScrollReveal>
          <div className="divide-y divide-neutral-800 border-y border-neutral-800">
            {FAQS.map((f) => (
              <details key={f.q} className="group py-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg md:text-xl font-apex-display font-bold text-white uppercase tracking-wide">
                  {f.q}
                  <span aria-hidden className="text-brand-orange text-2xl transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-4 text-neutral-400 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
```

- [ ] **Step 8: Contact section copy**

- Subtitle `Tell me what you&apos;re planning — I&apos;ll get back within a day.` → `Tell me what you need — I&apos;ll reply within 24 hours.`
- `Based in Singapore · Available for travel` → `Based in Singapore`
- Replace the paragraph `A few lines is enough — date, type of shoot and a rough budget help me quote faster.` with:

```tsx
                <p className="text-neutral-400 mb-2">A few lines is enough. Add a date or budget if you have one — it helps me quote faster.</p>
                <p className="text-brand-orange text-sm font-bold uppercase tracking-widest mb-8">Reply within 24 hours · Free, no-obligation quote</p>
```

- [ ] **Step 9: Footer clearance for the bar**

Footer class `py-12 bg-black border-t border-neutral-900` → `pt-12 pb-28 md:pb-12 bg-black border-t border-neutral-900`.

- [ ] **Step 10: MobileQuoteBar**

`src/components/portfolio/MobileQuoteBar.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { quoteBarVisible } from "./quote";

// Phone-only "Get a Quote" bar: one tap from anywhere on the page, but out
// of the way over the hero (which has its own button) and over the form.
export default function MobileQuoteBar() {
  const [heroInView, setHeroInView] = useState(true);
  const [contactInView, setContactInView] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("home");
    const contact = document.getElementById("contact");
    if (!hero || !contact) return;
    const observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === hero) setHeroInView(e.isIntersecting);
        if (e.target === contact) setContactInView(e.isIntersecting);
      }
    });
    observer.observe(hero);
    observer.observe(contact);
    return () => observer.disconnect();
  }, []);

  const visible = quoteBarVisible(heroInView, contactInView);

  return (
    <div
      aria-hidden={!visible}
      className={`md:hidden fixed inset-x-0 bottom-0 z-40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black via-black/90 to-transparent transition-[opacity,transform] duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-full pointer-events-none"
      }`}
    >
      <a
        href="#contact"
        tabIndex={visible ? 0 : -1}
        className="flex items-center justify-center gap-2 w-full py-4 bg-brand-orange text-white font-bold uppercase tracking-wider"
      >
        Get a Quote <ArrowRight size={18} />
      </a>
    </div>
  );
}
```

Render it in `Portfolio` right after `<NavBar />`: `<MobileQuoteBar />`.

- [ ] **Step 11: Verify**

Run: `npx tsc --noEmit && npx vitest run && npx eslint src/components/portfolio "src/app/(portfolio)"`
Expected: no type errors, all tests pass, no lint errors (existing `<img>` warnings only).

- [ ] **Step 12: Commit**

```bash
git add src/components/portfolio/Portfolio.tsx src/components/portfolio/MobileQuoteBar.tsx
git commit -m "feat(portfolio): quote-focused homepage — process, FAQ, phone quote bar"
```

---

### Task 6: Browser check and deploy

- [ ] **Step 1: Run locally**

`lsof -ti:3000 -sTCP:LISTEN | xargs kill; npx next dev -p 3000` (background).

- [ ] **Step 2: Check at 390×844 and 1280×800**

- Hero shows the new eyebrow, intro and **Get a Quote** first.
- Phone: bar hidden over hero; appears after scrolling past; hides when the form is on screen; covers nothing in the footer.
- Click "Get a quote for this" on Social → form shows "Social media content"; then on Event Coverage → shows "Corporate event".
- "+ Add details" opens phone/date/budget.
- FAQ items open/close; no travel/revision wording anywhere on the page.
- View source: two `application/ld+json` scripts, the second `"@type":"FAQPage"`.

- [ ] **Step 3: Deploy**

```bash
git push origin main
vercel --prod --yes
```

Then `curl -s https://apexcinematics.tech/ | grep -c FAQPage` → `1`.
