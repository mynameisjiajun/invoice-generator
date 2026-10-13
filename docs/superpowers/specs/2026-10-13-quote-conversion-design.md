# Quote-focused homepage — Design

## Goal

Turn apexcinematics.tech visitors (mainly corporate and social-media-content
buyers) into quote requests. There is no client proof yet and no public pricing,
so trust comes from a clear process, an FAQ and reassurance next to the form, and
conversion comes from making "Get a quote" one tap away with the service
preselected.

## Constraints (from the owner)

- No prices or packages anywhere.
- Contact only via the enquiry form, email (contact@apexcinematics.tech) and
  Instagram (@ApexCinematicsSG). No Telegram or WhatsApp.
- Never mention travel, and never state how many revisions are included.
  Remove the existing "Available for travel" line.
- Facts to state: reply within 24 hours; edited files delivered within 14 days
  (events and social content alike); footage usable in ads at no extra cost;
  short-notice shoots are possible if the date is free.
- Keep the existing visual language (Oswald/Inter, #FF6B00 on near-black,
  ScrollReveal, SectionHeader).

## Changes

All in `src/components/portfolio/` and `src/lib/enquiry.ts`.

1. **Hero.** Keep "Capturing The Unseen". The intro paragraph becomes: "Video and
   photo for brands, events and social media in Singapore — from corporate
   events to monthly Reels, shot, edited and delivered fast." Buttons: **Get a
   Quote** (primary, orange, `#contact`) then **View Work** (outline). The nav
   "Book Shoot" button and mobile-menu CTA read **Get a Quote**.
2. **Services.** Event Coverage copy leads with corporate events; Social Media
   Content mentions monthly content. Each card's "Let's talk" link becomes **Get
   a quote for this →**, which scrolls to `#contact` and preselects that
   service in the form (Event Coverage → "Corporate event", Documentary →
   "Documentary", Social → "Social media content").
3. **How it works** (new section after Services, `id="process"`): 01 Enquire,
   02 Plan (quick call to lock brief, date and quote), 03 Shoot (minimal
   disruption to your team), 04 Deliver (edited files within 14 days).
4. **FAQ** (new section before Contact, `id="faq"`), native `<details>`
   accordion, plus `FAQPage` JSON-LD in `page.tsx`:
   - How fast will I get my files? — within 14 days of the shoot.
   - Can we use the footage in ads? — yes, full usage rights, no extra cost.
   - Can you shoot at short notice? — yes, if the date is free; enquire early.
   - How do I get a quote? — send the form or email; reply within 24 hours,
     free and no obligation.
   - Do you do ongoing social content? — yes, monthly content planned with you.
5. **Enquiry form.**
   - Visible: name, email, "What do you need?" (`shoot_type`), message.
   - Behind an "Add details (optional)" `<details>` toggle: phone, date,
     budget.
   - `SHOOT_TYPES` becomes: "Corporate event", "Social media content",
     "Documentary", "Other event", "Something else". Old rows keep their
     stored strings; only new submissions are validated against the new list.
   - The form accepts a `defaultShootType` prop; the selected service is kept in
     `Portfolio` state and passed down (the `<select>` is controlled so a later
     click on another service updates it).
   - Reassurance line above the form: "Reply within 24 hours · Free,
     no-obligation quote". The success message says "within 24 hours".
   - Contact footer line drops "Available for travel" → "Based in Singapore".
6. **Mobile quote bar.** `md:hidden`, fixed bottom, safe-area aware. Appears
   after the hero leaves the viewport; hides while `#contact` is in view
   (IntersectionObserver). One full-width "Get a Quote" button.

## Testing

- `enquiry.test.ts`: new shoot types accepted, an old/unknown type is blanked.
- `serviceShootType` mapping unit test (service id → shoot type).
- Existing test suite, `tsc`, eslint.
- Manual check at 390px and 1280px: bar visibility rules, service preselect,
  optional toggle, FAQ open/close.
