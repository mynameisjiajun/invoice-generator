# Hero Texture Video + Mobile Nav Fix + UX Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the user's static-glitch texture video behind the hero title (self-hosted, low-opacity, non-distracting), fix the mobile hamburger menu that breaks after scrolling, and land a UX-polish sweep (anchor offsets, dvh hero, reduced-motion, scrollspy nav flare).

**Architecture:** The 13.8 MB downloaded MP4 (repo root, untracked) is compressed once via the `ffmpeg-static` npm binary into `public/hero-static.mp4` (≤4 MB; TV static hides compression artifacts) and rendered by a new native-`<video>` `HeroVideo` component layered between `HeroCanvas` and the hero's gradient. The NavBar is restructured so the mobile overlay is a **sibling** of `<nav>`, escaping the containing-block trap created by `backdrop-filter` on the scrolled nav — the root cause of the broken hamburger. Scrollspy, scroll-margins, and reduced-motion rules complete the sweep.

**Tech Stack:** Next.js 16, Canvas/`<video>`, `ffmpeg-static` (one-shot dev tool, not a runtime dep), Tailwind v4, Playwright verification.

**Spec:** `docs/superpowers/specs/2026-07-23-hero-video-mobile-nav-ux-design.md`

## Global Constraints

- Source video: repo root `YTDown.com_YouTube_Free-Static-Glitch-Screen-Red-Retro-TV_Media_xYrKnzjsmFA_001_720p.mp4` (never commit this original; it stays untracked). YouTube id if the fallback is needed: `xYrKnzjsmFA`.
- Shipped asset: `public/hero-static.mp4`, hard cap **4 MB** (re-encode harder if over), no audio track.
- The video layer must be: `muted autoPlay loop playsInline`, `pointer-events-none`, ~30% max opacity under a dark veil, absent entirely for `prefers-reduced-motion: reduce`, and layered **above `HeroCanvas`, below the gradient/letterbox** — the canvas stays as base/fallback.
- Existing hero flare untouched: letterbox bars, REC chip at `top-28`, headline, ticker.
- Mobile menu must work at any scroll position, lock body scroll while open, close on Escape and on link tap, and carry `aria-expanded`/`aria-modal`.
- No new runtime npm dependencies (`ffmpeg-static` is devDependencies-only or a one-shot `npm exec`).
- CSP/`next.config.ts` untouched (`media-src 'self'` and `frame-src youtube-nocookie` already cover both paths).
- Suite green after every task: `npx tsc --noEmit && npm test`. Work on branch `feat/hero-video-nav-fix`. Dev hygiene: `pkill -f "next dev"; pkill -f "next start"` before servers.

---

### Task 1: Compress and place the hero video asset

**Files:**
- Create: `public/hero-static.mp4` (generated, committed)
- Modify: `package.json`/`package-lock.json` only if `ffmpeg-static` is added to devDependencies (one-shot `npm exec` preferred; then no change)

**Interfaces:**
- Consumes: the untracked repo-root MP4.
- Produces: `/hero-static.mp4` URL used by Task 2's `HeroVideo`.

- [ ] **Step 1: Get an ffmpeg binary via npm (no global install)**

```bash
cd "/Users/mynameisjiajun/Documents/Coding projects/invoice generator"
FFMPEG=$(npm exec --yes --package=ffmpeg-static -- node -e "console.log(require('ffmpeg-static'))")
echo "$FFMPEG" && "$FFMPEG" -version | head -1
```
Expected: a path inside the npm cache and a version banner. **If this fails** (registry/binary blocked): skip Steps 2–3, and in Task 2 use the documented iframe variant instead of the native video.

- [ ] **Step 2: Compress — static noise tolerates brutal settings**

```bash
"$FFMPEG" -y -i "YTDown.com_YouTube_Free-Static-Glitch-Screen-Red-Retro-TV_Media_xYrKnzjsmFA_001_720p.mp4" \
  -vf "scale=960:-2,fps=24" -c:v libx264 -preset slow -crf 30 -profile:v main \
  -movflags +faststart -an public/hero-static.mp4
ls -la public/hero-static.mp4
```
Expected: file exists. If > 4 MB (4194304 bytes), re-run with `-crf 34 -vf "scale=854:-2,fps=24"`; if still over, add `-t 20` (a 20 s loop of static is indistinguishable from 45 s).

- [ ] **Step 3: Sanity-check the output**

```bash
FFPROBE=$(dirname "$FFMPEG")/ffprobe; [ -x "$FFPROBE" ] || FFPROBE="$FFMPEG"
"$FFPROBE" -v error -show_entries format=duration,size -of default=nw=1 public/hero-static.mp4 2>/dev/null || "$FFMPEG" -i public/hero-static.mp4 2>&1 | grep Duration
```
Expected: duration reported, size ≤ 4 MB. (ffmpeg-static ships only ffmpeg; the `grep Duration` fallback is fine.)

- [ ] **Step 4: Commit (asset only — never the repo-root original)**

```bash
git add public/hero-static.mp4
git status --short   # MUST NOT list the YTDown.com_* original
git commit -m "feat: compressed static-glitch hero texture video (self-hosted)"
```

---

### Task 2: `HeroVideo` component + hero wiring

**Files:**
- Create: `src/components/portfolio/HeroVideo.tsx`
- Modify: `src/components/portfolio/Portfolio.tsx` (import + one insertion in the hero background block)

**Interfaces:**
- Consumes: `/hero-static.mp4` (Task 1).
- Produces: `HeroVideo` default export, no props, fills its positioned parent.

- [ ] **Step 1: Create the component**

```tsx
// src/components/portfolio/HeroVideo.tsx
"use client";
import { useEffect, useRef, useState } from "react";

// Low-opacity static-glitch texture behind the hero title. Native <video>
// (self-hosted, media-src 'self') layered over HeroCanvas; the canvas stays
// as the base so a failed load or reduced-motion user still gets atmosphere.
export default function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  if (!enabled) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <video
        ref={videoRef}
        src="/hero-static.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        onPlaying={() => setPlaying(true)}
        onError={() => setPlaying(false)}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${playing ? "opacity-30" : "opacity-0"}`}
      />
      {/* keep it background-ish: dark veil so the headline stays dominant */}
      <div className="absolute inset-0 bg-black/50" />
    </div>
  );
}
```

**Fallback variant (ONLY if Task 1 Step 1 failed — YouTube iframe, same file/name/usage):**

```tsx
// src/components/portfolio/HeroVideo.tsx
"use client";
import { useEffect, useState } from "react";

const YT_ID = "xYrKnzjsmFA";

export default function HeroVideo() {
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  if (!enabled) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${YT_ID}?autoplay=1&mute=1&loop=1&playlist=${YT_ID}&controls=0&disablekb=1&rel=0&playsinline=1&iv_load_policy=3`}
        title=""
        tabIndex={-1}
        onLoad={() => setLoaded(true)}
        allow="autoplay; encrypted-media"
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-1000 ${loaded ? "opacity-30" : "opacity-0"}`}
        style={{ width: "max(100%, 177.78vh)", height: "max(100%, 56.25vw)", border: 0 }}
      />
      <div className="absolute inset-0 bg-black/50" />
    </div>
  );
}
```

- [ ] **Step 2: Wire into the hero**

In `src/components/portfolio/Portfolio.tsx`:

a) Add `import HeroVideo from './HeroVideo';` directly under `import HeroCanvas from './HeroCanvas';`.

b) In the hero background block, replace:

```tsx
        <div className="absolute inset-0 z-0">
          <HeroCanvas />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-transparent to-transparent z-10"></div>
```

with:

```tsx
        <div className="absolute inset-0 z-0">
          <HeroCanvas />
          <HeroVideo />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-transparent to-transparent z-10"></div>
```

- [ ] **Step 3: Verify visually**

`npx tsc --noEmit && npm test && npx next build`, then production server + Playwright (desktop 1440×900, mobile 390×844): assert a `video` element exists inside `[data-apex-root]` with `readyState >= 2` after a 2 s wait (or the iframe in fallback mode), screenshot both — subtle red static shimmer behind the headline, headline fully legible, letterbox/REC chip intact, no console/CSP errors, no overflow. Kill the server.

- [ ] **Step 4: Commit**

```bash
git add src/components/portfolio/HeroVideo.tsx src/components/portfolio/Portfolio.tsx
git commit -m "feat: static-glitch texture video behind the hero title"
```

---

### Task 3: Mobile hamburger fix (containing-block escape) + a11y

**Files:**
- Modify: `src/components/portfolio/Portfolio.tsx` (the whole `NavBar` component, currently lines ~88–157)

**Interfaces:**
- Consumes: nothing new (`Menu`/`X` lucide icons already imported).
- Produces: working mobile menu at any scroll depth; scrollspy `activeId` is internal.

**Root cause being fixed** (do not "fix" by removing the blur): the overlay `div` is `fixed inset-0` but sits *inside* `<nav>`, which gains `backdrop-blur-md` when scrolled. `backdrop-filter` promotes the nav to a containing block for fixed descendants, so the overlay sizes itself to the nav strip instead of the viewport. Rendering the overlay as a **sibling** of `<nav>` (fragment) is the fix.

- [ ] **Step 1: Replace the whole `NavBar` component with:**

```tsx
const NavBar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeId, setActiveId] = useState('home');

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scrollspy: highlight the nav link for the section in view.
  useEffect(() => {
    const ids = ['home', 'portfolio', 'rates', 'about', 'contact'];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }
      },
      // A slim horizontal band ~40% down the viewport decides the active section.
      { rootMargin: '-40% 0px -55% 0px' }
    );
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Scroll-lock + Escape while the mobile menu is open.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [mobileMenuOpen]);

  const navLinks = [
    { name: 'Work', href: '#portfolio', id: 'portfolio' },
    { name: 'Services', href: '#rates', id: 'rates' },
    { name: 'Studio', href: '#about', id: 'about' },
  ];

  return (
    <>
      <nav className={`fixed top-0 w-full z-40 transition-all duration-300 border-b ${scrolled ? 'bg-black/90 backdrop-blur-md border-neutral-800 py-3' : 'bg-transparent border-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <a href="#home" className="text-3xl font-apex-display font-bold text-white tracking-tighter uppercase italic z-50">
            Apex<span className="text-brand-orange not-italic">Cinematics</span>
          </a>

          {/* Desktop Nav */}
          <div className="hidden md:flex gap-12 items-center">
            {navLinks.map(link => (
              <a
                key={link.name}
                href={link.href}
                aria-current={activeId === link.id ? 'true' : undefined}
                className={`text-sm font-bold uppercase tracking-widest transition-colors border-b-2 pb-1 ${
                  activeId === link.id
                    ? 'text-brand-orange border-brand-orange'
                    : 'text-neutral-400 border-transparent hover:text-white'
                }`}
              >
                {link.name}
              </a>
            ))}
            <a href="#contact" className="px-6 py-2 bg-white text-black font-apex-display font-bold uppercase tracking-wider hover:bg-brand-orange hover:text-white transition-all skew-x-[-10deg]">
              <span className="skew-x-[10deg] inline-block">Book Shoot</span>
            </a>
          </div>

          {/* Mobile Toggle */}
          <button
            className="md:hidden text-white z-50"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu — a SIBLING of <nav>, never a descendant: the scrolled
          nav's backdrop-filter would otherwise become the containing block
          for this fixed overlay and shrink it to the nav strip. */}
      {mobileMenuOpen && (
        <div role="dialog" aria-modal="true" className="md:hidden fixed inset-0 z-50 bg-black flex flex-col justify-center items-center gap-8 animate-fade-in">
          <button
            className="absolute top-6 right-6 text-white"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={28} />
          </button>
          {navLinks.map(link => (
            <a
              key={link.name}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="text-5xl font-apex-display font-bold text-neutral-500 hover:text-white hover:text-brand-orange uppercase transition-all duration-300"
            >
              {link.name}
            </a>
          ))}
          <a
            href="#contact"
            onClick={() => setMobileMenuOpen(false)}
            className="text-4xl font-apex-display font-bold text-brand-orange mt-8 border-b-2 border-brand-orange"
          >
            Let&apos;s Talk
          </a>
        </div>
      )}
    </>
  );
};
```

- [ ] **Step 2: Verify the regression is dead (production server, Playwright)**

Mobile viewport 390×844: load `/`, `page.mouse.wheel(0, 1500)` (deep scroll so the nav is in its blurred state), tap the hamburger, then assert: the overlay (`[role="dialog"]`) bounding box equals the full viewport (±2 px); `document.body.style.overflow === 'hidden'`; tapping the "Work" link closes the overlay and `location.hash === '#portfolio'`; pressing Escape after reopening closes it. Screenshot the open menu — solid black fullscreen, three links + Let's Talk, X top-right, no page text bleeding through.

- [ ] **Step 3: Commit**

```bash
git add src/components/portfolio/Portfolio.tsx
git commit -m "fix: mobile menu escaped nav's backdrop-filter containing block; scroll lock, Esc, aria"
```

---

### Task 4: UX sweep (anchors, dvh, reduced motion)

**Files:**
- Modify: `src/components/portfolio/Portfolio.tsx` (4 section tags + hero), `src/app/globals.css` (reduced-motion block)

**Interfaces:** none.

- [ ] **Step 1: Anchor scroll offsets**

Add `scroll-mt-20` to each anchored section's className in `Portfolio.tsx` (4 edits):
- `<section id="portfolio" className="py-24 bg-brand-dark relative">` → `className="py-24 bg-brand-dark relative scroll-mt-20"`
- `<section id="rates" className="py-24 bg-neutral-900 border-y border-neutral-800">` → append ` scroll-mt-20`
- `<section id="about" className="py-24 bg-brand-dark relative overflow-hidden">` → append ` scroll-mt-20`
- `<section id="contact" className="py-24 bg-black border-t border-neutral-900">` → append ` scroll-mt-20`

- [ ] **Step 2: dvh hero (iOS address-bar correctness)**

In the hero: `<section id="home" className="relative min-h-screen flex ...` → replace `min-h-screen` with `min-h-dvh`. Also the page wrapper `<div className="min-h-screen bg-brand-dark ...` → `min-h-dvh`.

- [ ] **Step 3: Reduced-motion for the ticker + smooth scroll**

In `src/app/globals.css`, inside the Apex block (after the `html:has([data-apex-root])` rule), add:

```css
@media (prefers-reduced-motion: reduce) {
  html:has([data-apex-root]) { scroll-behavior: auto; }
  [data-apex-root] .animate-marquee-right { animation: none; }
}
```

- [ ] **Step 4: Verify + commit**

`npx tsc --noEmit && npm test && npx next build` — green. Production server: click each desktop nav link → section heading fully visible below the fixed nav (not tucked under it); active link shows the orange underline as you scroll through sections.

```bash
git add src/components/portfolio/Portfolio.tsx src/app/globals.css
git commit -m "feat: anchor offsets, dvh hero, reduced-motion ticker, scrollspy nav"
```

---

### Task 5: Full verification + ship

- [ ] **Step 1: Full pass**

`npx tsc --noEmit && npm test && npx next build`, then the established Playwright sweep on `/` and `/work/chroma-car-care` (both viewports): zero CSP violations (`_vercel/insights` 404 and sandbox media/thumbnail 404s are known non-issues), zero `a[href*="invoices_login"]`, no horizontal overflow, plus Task 2 Step 3's video check and Task 3 Step 2's menu regression. Confirm `/invoices_login` still returns 200.

- [ ] **Step 2: Grep gates**

```bash
git status --short | grep "YTDown" && echo "FAIL: original video staged" || echo OK
grep -rn "min-h-screen" src/components/portfolio && echo "FAIL" || echo OK
```

- [ ] **Step 3: Finish the branch**

Use superpowers:finishing-a-development-branch: tests → merge `feat/hero-video-nav-fix` → `main` → re-test → push (Vercel auto-deploys).

- [ ] **Step 4: Post-deploy hand-off (tell the user)**

1. Hero now has the red static-glitch texture at ~30% opacity behind the title; canvas particles still layer underneath. If it reads too strong/weak on the phone, the two knobs are `opacity-30` and `bg-black/50` in `HeroVideo.tsx`.
2. The hamburger menu now works at any scroll depth, locks scrolling behind it, and closes on Escape/link tap.
3. Desktop nav highlights the section you're viewing; anchor jumps no longer hide headings under the navbar.
4. The 13.8 MB `YTDown.com_*` original in the repo root can be deleted whenever — only the compressed 4 MB copy shipped.
5. Still pending: cyclus marine + Harp Snippet YouTube links.
