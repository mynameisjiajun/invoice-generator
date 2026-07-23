# Hero Texture Video + Mobile Nav Fix + UX Sweep — Design

**Date:** 2026-07-23
**Status:** Approved (user request 2026-07-23)

## Problems

1. The user wants a ~45-second static-glitch texture video playing behind the hero
   title — low opacity, "background-ish", not distracting — layered with (not
   replacing the atmosphere of) the current canvas texture. Source identified:
   YouTube `xYrKnzjsmFA` ("Free Static Glitch Screen - Red Retro TV", channel
   Free Stock Footage Archive — free stock footage), and the user has already
   downloaded the 720p MP4 into the repo root (13.8 MB, untracked:
   `YTDown.com_YouTube_Free-Static-Glitch-Screen-Red-Retro-TV_Media_xYrKnzjsmFA_001_720p.mp4`).
2. **Mobile hamburger menu breaks after scrolling.** Root cause (verified against
   code + user screenshot): the menu overlay is `fixed inset-0` but rendered inside
   `<nav>`, which gains `backdrop-blur-md` once scrolled. `backdrop-filter` makes
   the nav a containing block for fixed-position descendants, so the overlay sizes
   itself to the navbar strip instead of the viewport — menu text spills over page
   content and most of the screen stays uncovered.
3. General UX polish requested ("scan for website fixes… smooth ui ux… add flare").

## Decisions

1. **Hero video layer — self-hosted, not an iframe.** The downloaded MP4 is
   compressed once (via the `ffmpeg-static` npm binary; TV static hides
   compression artifacts, so aggressive settings are fine) to a target of ≤4 MB at
   ~960px/24fps/no-audio, committed as `public/hero-static.mp4` (`media-src 'self'`
   already allows it). A `HeroVideo` client component renders a native
   `<video autoplay muted loop playsinline>` with object-cover sizing,
   `pointer-events-none`, fading from 0 to ~30% opacity once playing, under a dark
   veil so the headline stays dominant. `HeroCanvas` stays underneath as base
   layer and fallback (load failure, reduced-motion). Users with
   `prefers-reduced-motion: reduce` never get the video. The 13.8 MB original
   stays untracked and is never committed. Fallback if the ffmpeg binary can't be
   fetched: privacy-enhanced YouTube iframe embed of `xYrKnzjsmFA` (CSP already
   allows `frame-src https://www.youtube-nocookie.com`).
2. **Mobile nav restructure**: overlay moves out of `<nav>` to a sibling (fragment
   render) at `z-50` with its own close button — immune to the containing-block
   trap. Plus: body scroll-lock while open, Escape closes, `aria-expanded` /
   `aria-modal` attributes.
3. **UX sweep**:
   - `scroll-mt` on all anchored sections so headings never tuck under the fixed nav.
   - Hero `min-h-screen` → `min-h-dvh` (iOS Safari dynamic address bar).
   - Marquee ticker and smooth-scroll disabled under `prefers-reduced-motion`.
   - **Flare**: scrollspy — desktop nav links highlight (brand orange) for the
     section currently in view via IntersectionObserver.

## Testing

vitest suite stays green. Playwright production checks, including the new
regression: mobile viewport → scroll deep → open hamburger → overlay bounding box
equals the viewport, link tap closes it and navigates, body scroll locks while
open. Desktop: iframe (or canvas fallback) present, hero legible, zero
console/CSP errors, no horizontal overflow, screenshots reviewed.

## Out of scope

Replacing YouTube with self-hosted video, nav redesign, further content changes,
the two still-pending video projects (cyclus marine, Harp Snippet).
