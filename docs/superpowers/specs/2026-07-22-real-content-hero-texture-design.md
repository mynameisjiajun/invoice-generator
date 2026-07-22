# Real Portfolio Content + Interactive Hero Texture — Design

**Date:** 2026-07-22
**Status:** Approved (user request 2026-07-22)

## Problem

The portfolio still shows the 6 AI-placeholder projects with Unsplash covers, and the
hero background is a stock Unsplash still the user doesn't like. The user has now
supplied real content (two photo shoots + one published YouTube film) and wants the
hero background replaced with an animated, cursor-reactive texture.

## Source material (verified on disk / online)

- `~/Downloads/drive-download-20260722T094930Z-1-001.zip` (186 MB):
  - `Chroma Car Care PhotoShoot/` — 58 JPGs (`DSCF*.jpg`, 1.2–1.9 MB each)
  - `Floraisons.Co PR Event/` — 101 JPGs (`JJ-*.jpg`, 0.6–1.5 MB each)
- YouTube `QsSV2IPbqhA` — oEmbed-verified title "Yue Rou's Chinese Fantasy Music
  Video Journey", channel Make-A-Wish Singapore.
- `~/Downloads/Video Samples-*.zip` (1.09 GB, 7 videos) — **not ingested**: videos
  ship via YouTube per the v2 architecture. One (Yue Rou) is already online; the
  other six await user uploads (hand-off list in the plan).

## Decisions

1. **Replace all 6 placeholder projects** with 3 real ones:
   - `yue-rou-chinese-fantasy-mv` — video, `youtubeId: "QsSV2IPbqhA"`, cover from
     `i.ytimg.com` maxres thumbnail, no local photos.
   - `chroma-car-care` — photo, 12 curated images.
   - `floraisons-pr-event` — photo, 12 curated images.
2. **Curation + optimization pipeline**: 12 images per shoot, evenly sampled across
   the filename-sorted set (user can swap picks later by editing the folder), resized
   to max edge 1600 px, EXIF-orientation applied then stripped, JPEG quality 82,
   into `public/work/<slug>/NN.jpg`. Expected repo weight ≈ 6–8 MB total.
3. **Video projects may have an empty gallery** (`photos: []` allowed when
   `youtubeId` present). Photo projects still require ≥1 photo. `ProjectDetail`
   hides the gallery grid when empty; tests updated to enforce the new rule.
4. **About-section image** switches from Unsplash to the user's crew group photo
   (`~/Desktop/Video Samples/KLN06452.jpg`, 6882×4588 landscape — verified: group
   shot under the Jewel Changi dome). The About visual column changes from
   `aspect-[3/4]` (vertical) to `aspect-[3/2]` (landscape) so the whole group fits
   instead of being cropped — per the user: adjust the box, don't crop the friends.
   With Unsplash gone everywhere, `images.unsplash.com` is fully removed from the
   CSP and `images.remotePatterns` (the v2 plan's promised cleanup).
5. **Hero background: interactive canvas texture** replacing the Unsplash still,
   the Ken Burns effect, and the never-supplied `showreel.mp4` video element:
   - Own `HeroCanvas` client component, zero dependencies, `requestAnimationFrame`.
   - "Darkroom safelight" aesthetic: near-black base, drifting soft dust/bokeh
     particles in brand orange/warm white, plus a large soft radial glow that eases
     toward the cursor; particles are gently repelled around the pointer.
   - Pointer + touch reactive; devicePixelRatio-aware; pauses via
     `document.visibilitychange`; `prefers-reduced-motion: reduce` renders a static
     gradient frame (no animation loop).
   - Existing hero flare stays: noise overlay, letterbox bars, REC timecode chip,
     headline/subtitle/buttons/ticker unchanged.

## Testing

Updated `projects.test.ts` rules (slug/type/cover/story required; photos ≥1 for
photo projects; gear-word ban). Build must show `● /work/[slug]` with the 3 new
slugs. Playwright production checks: no console/CSP errors, no overflow, zero
invoice links, canvas element present and sized on `/`; screenshots reviewed.
Local `/work/...` images load in the sandbox (self-hosted — unlike the old
Unsplash placeholders), so gallery rendering is now visually verifiable.

## Out of scope / hand-off

Uploading the remaining 6 videos to YouTube (user); adding their entries afterwards
is a 5-line-each data edit. Deleting the Downloads zips after ingestion (user).
