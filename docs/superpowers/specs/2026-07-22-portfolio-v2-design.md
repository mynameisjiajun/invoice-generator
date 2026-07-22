# Apex Cinematics Portfolio v2 — Design

**Date:** 2026-07-22
**Status:** Approved (conversational review 2026-07-22, including copy draft)

## Problem

The live portfolio at `/` is the AI-generated placeholder: fake brand ("Apex Angles"),
fake projects with stock media, fake prices, a mailto contact form, gear-heavy copy,
and no way to view a project's photos. It needs to become a real, contact-driving
portfolio for the user's photo/video business.

## Decisions (user-confirmed)

1. **Brand: Apex Cinematics** (matches apexcinematics.tech). All copy, nav, titles.
2. **Work = Photo + Video only.** Filters: All / Video / Photo (the 5 fake categories go).
3. **Dedicated page per project** at `/work/[slug]` — shareable URL, per-project
   Open Graph preview, statically generated.
4. **Media**: photos in the repo (`public/work/<slug>/…`) served via `next/image`;
   videos on YouTube, embedded privacy-enhanced (`youtube-nocookie.com`), lazy-loaded
   behind a poster with an orange play button.
5. **Content workflow**: one data file (`projects.ts`) + a folder of JPGs per project.
   No admin UI. Current placeholder projects stay (clearly marked) until real content
   replaces them, so the site never looks empty.
6. **Services, no prices**: three offerings — **Event Coverage**, **Documentary**,
   **Social Media Content**. No gear talk anywhere, no drone mentions (user has no
   drone). Copy sells outcomes and quality.
7. **Contact-first**: fake form replaced by three direct buttons — Email
   `chuajiajun2705@gmail.com`, Instagram `@mynameisjiajun`, Telegram
   `t.me/mynameisjiajun`. Every section funnels to contact; project pages end with a
   "Like this? Let's shoot yours." CTA banner. Still zero links to the invoice app.
8. **Hero showreel**: muted looping background video from `public/showreel.mp4`
   (user will supply a 10–20s montage; site degrades gracefully to the poster still
   until the file exists).

## Approved copy (verbatim)

- **Hero subtitle:** "Apex Cinematics is a Singapore-based studio covering events,
  documentaries, and social content — cinematic photo and video for everyone and anyone."
- **Event Coverage:** "Weddings, corporate, nightlife, community — if it matters to
  you, it's worth capturing properly. Full-day or hourly coverage with fast
  turnaround highlight edits."
- **Documentary:** "Real people, real stories. Interview-led films for brands,
  families, and causes that want something honest and lasting."
- **Social Media Content:** "Reels and TikToks built to perform — planned, shot, and
  cut for the platform, delivered ready to post."
- **About:** "Apex Cinematics shoots photo and video for everyone and anyone — from
  one-person passion projects to full-scale corporate events. No gear talk, no
  jargon: just high-quality coverage, delivered how you need it."
- **Project-page CTA:** "Like this? Let's shoot yours."
- Service cards end with a "Let's talk →" link to `#contact`.
- Feature bullets are outcomes, not gear (e.g. "Fast turnaround", "Highlight + full
  edits", "Ready-to-post formats", "Full usage rights"). Project tags are what/where
  only (e.g. "Wedding · Sentosa"), never camera/lens.

## Architecture

- **Route group** `src/app/(portfolio)/` with a shared layout owning the Oswald/Inter
  `next/font` variables and `data-apex-root` wrapper; contains `/` (moved) and
  `/work/[slug]` (new). URLs unchanged. Invoice app untouched.
- **Data**: `src/components/portfolio/projects.ts` exports `Project[]`:
  `slug`, `title`, `type: "video" | "photo"`, `cover`, `story`, `tags: string[]`,
  `youtubeId?`, `photos: { src, alt, caption? }[]`. Placeholder entries marked
  `// PLACEHOLDER — replace with real work`.
- **Components**: `Lightbox.tsx` (own code, no dependency: full-screen, swipe,
  arrow keys, Esc/backdrop close, "03 / 12" mono counter), `YouTubeEmbed.tsx`
  (thumbnail from `i.ytimg.com` + play button → swaps to `youtube-nocookie` iframe
  on click), `ProjectCard` (cover via `next/image`, hover zoom + orange frame,
  play badge for video type). The coverr hover-videos are removed.
- **Project page**: `generateStaticParams` from the data file; `generateMetadata`
  per project (title, description, OG image = cover). Cover/YouTube lead, story +
  tag strip, photo grid → lightbox, CTA banner, back link.
- **Flare** (the "super cool" layer, all CSS/tiny-JS, no new deps): cinematic
  letterbox bars + mono timecode chip on the hero, Ken Burns slow zoom on the hero
  poster, numbered section headers ("01 — SELECTED WORKS"), staggered card reveals,
  marquee reused for the project-page CTA banner, orange selection color (exists).
- **Housekeeping**: `@vercel/analytics` in the root layout; `app/sitemap.ts` +
  `app/robots.ts` (portfolio routes only — `/invoices_login` explicitly disallowed);
  CSP: `frame-src` + `https://www.youtube-nocookie.com`, `img-src` +
  `https://i.ytimg.com`, `media-src` tightened to `'self'` (coverr gone). Unsplash
  stays allowed until real photos replace placeholders.

## Error handling

Missing `showreel.mp4` → hero silently keeps the poster (video `onError`/no-source
fallback). Unknown `/work/<slug>` → 404 via `notFound()`. Lightbox traps focus and
restores scroll on close. No forms, no network calls, so no other failure surface.

## Testing

Existing vitest suite stays green. New pure logic (project lookup/`slugs`,
lightbox index math if extracted) gets unit tests where it's pure; the rest is
verified with the established Playwright production-server checks (zero console/CSP
errors, mobile + desktop, no horizontal overflow, zero `invoices_login` links) plus
screenshot review of `/` and one `/work/[slug]` page.

## Content the user supplies later (site works with placeholders meanwhile)

Per project: folder of JPGs + 2–3 line story + YouTube link (video projects).
Plus: one hero montage clip (1080p H.264, ~10–20s, no audio, ~5–8MB), one portrait
for About.

## Out of scope

Admin UI for projects, real content population (separate follow-up as files arrive),
removing the Unsplash CSP allowance (do when placeholders go), AI chat, blog/SEO
articles, multi-language.
