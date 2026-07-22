# Real Portfolio Content + Interactive Hero Texture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 6 AI-placeholder projects with 3 real ones (Chroma Car Care shoot, Floraisons.Co PR event, Yue Rou Make-A-Wish film) and replace the hero's stock photo with a cursor-reactive animated canvas texture.

**Architecture:** A one-time Python/PIL pipeline curates 12 images per shoot from the user's Downloads zip into `public/work/<slug>/` (resized, EXIF-normalized). `projects.ts` swaps placeholders for real entries; video projects may now have an empty gallery. A new dependency-free `HeroCanvas` client component (particle drift + pointer-following glow + pointer repulsion, reduced-motion aware) replaces the hero `<img>`/Ken Burns/showreel `<video>`. With Unsplash gone everywhere, its CSP/remotePatterns allowances are removed.

**Tech Stack:** Python3 + PIL (ingestion only, not shipped), Next.js 16, Canvas 2D API, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-22-real-content-hero-texture-design.md`

## Global Constraints

- Source zip: `~/Downloads/drive-download-20260722T094930Z-1-001.zip` (folders `Chroma Car Care PhotoShoot/`, `Floraisons.Co PR Event/`). Do NOT extract or ingest `Video Samples-*.zip` (1 GB; videos ship via YouTube only).
- Image output: max edge **1600 px**, JPEG **quality 82**, EXIF orientation applied (`ImageOps.exif_transpose`) then metadata stripped (PIL re-save default), named `01.jpg`…`12.jpg` per project.
- Exactly **12 curated images per photo project**, evenly sampled across the filename-sorted originals.
- YouTube project: id `QsSV2IPbqhA`, title "Yue Rou's Chinese Fantasy Music Video Journey" (verified via oEmbed; client: Make-A-Wish Singapore). Cover: `https://i.ytimg.com/vi/QsSV2IPbqhA/maxresdefault.jpg`.
- Rules that must survive in tests: photo projects need ≥1 photo; video projects may have `photos: []`; no gear words (`sony|a7s|drone|lens|glass`) in tags/stories.
- `HeroCanvas`: no new npm dependencies; `prefers-reduced-motion: reduce` ⇒ single static frame, no animation loop; pause on `document.hidden`; devicePixelRatio capped at 2.
- Keep hero flare intact: noise overlay, letterbox bars, REC chip, headline, subtitle, buttons, marquee ticker.
- After this plan, `images.unsplash.com` must appear nowhere in `src/` or `next.config.ts`; `i.ytimg.com` stays.
- Suite green after every task: `npx tsc --noEmit && npm test`. Work on branch `feat/real-content-hero`.

---

### Task 1: Ingest and curate the two photo shoots + the crew About photo

**Files:**
- Create: `public/work/chroma-car-care/01.jpg`…`12.jpg`, `public/work/floraisons-pr-event/01.jpg`…`12.jpg`, `public/work/about-crew.jpg` (generated, committed)

**Interfaces:**
- Consumes: the Downloads zip (read-only) and `~/Desktop/Video Samples/KLN06452.jpg` (crew group photo, 6882×4588 landscape).
- Produces: 25 optimized JPGs at the exact paths above; Task 2's data file references the shoot photos and Task 2's About-section swap uses `/work/about-crew.jpg`.

- [ ] **Step 1: Extract the photo zip to the scratchpad (never into the repo)**

```bash
SCRATCH="/private/tmp/claude-501/-Users-mynameisjiajun-Documents-Coding-projects-invoice-generator/82110539-6d94-43bd-ba80-6daae81e6bcb/scratchpad"
mkdir -p "$SCRATCH/shoots"
unzip -o -q "$HOME/Downloads/drive-download-20260722T094930Z-1-001.zip" -d "$SCRATCH/shoots"
ls "$SCRATCH/shoots"
```
Expected: `Chroma Car Care PhotoShoot` and `Floraisons.Co PR Event` directories (58 and 101 JPGs).

- [ ] **Step 2: Curate + resize with this exact script**

```bash
cd "/Users/mynameisjiajun/Documents/Coding projects/invoice generator"
python3 - <<'EOF'
import os
from PIL import Image, ImageOps

SCRATCH = "/private/tmp/claude-501/-Users-mynameisjiajun-Documents-Coding-projects-invoice-generator/82110539-6d94-43bd-ba80-6daae81e6bcb/scratchpad/shoots"
JOBS = [
    ("Chroma Car Care PhotoShoot", "public/work/chroma-car-care"),
    ("Floraisons.Co PR Event", "public/work/floraisons-pr-event"),
]
K, MAX_EDGE, QUALITY = 12, 1600, 82

for src_name, out_dir in JOBS:
    src = os.path.join(SCRATCH, src_name)
    files = sorted(f for f in os.listdir(src) if f.lower().endswith(".jpg"))
    n = len(files)
    picks = [files[round(i * (n - 1) / (K - 1))] for i in range(K)]
    os.makedirs(out_dir, exist_ok=True)
    for i, name in enumerate(picks, 1):
        im = Image.open(os.path.join(src, name))
        im = ImageOps.exif_transpose(im).convert("RGB")
        im.thumbnail((MAX_EDGE, MAX_EDGE))
        out = os.path.join(out_dir, f"{i:02d}.jpg")
        im.save(out, "JPEG", quality=QUALITY, optimize=True)
        print(out, im.size, f"{os.path.getsize(out)//1024}KB", "<-", name)

# Crew group photo for the About section (landscape — kept at native 3:2,
# the About box is adjusted to match in Task 2, NOT cropped to vertical).
im = Image.open(os.path.expanduser("~/Desktop/Video Samples/KLN06452.jpg"))
im = ImageOps.exif_transpose(im).convert("RGB")
im.thumbnail((MAX_EDGE, MAX_EDGE))
im.save("public/work/about-crew.jpg", "JPEG", quality=QUALITY, optimize=True)
print("public/work/about-crew.jpg", im.size, f"{os.path.getsize('public/work/about-crew.jpg')//1024}KB")
EOF
```
Expected: 25 files printed, each ≲400 KB. Then `du -sh public/work` ⇒ under ~10 MB. If any single file exceeds 600 KB, re-save that one at quality 76.

- [ ] **Step 3: Visually spot-check the curation**

Open (Read tool) `public/work/chroma-car-care/01.jpg`, `.../07.jpg`, `public/work/floraisons-pr-event/01.jpg`, `.../12.jpg`, and `public/work/about-crew.jpg` — confirm they're upright (EXIF applied), sharp, and representative; the crew photo must show the full group (9 people under the glass dome), not a crop.

- [ ] **Step 4: Commit**

```bash
git add public/work
git commit -m "feat: curated real shoot photos (Chroma Car Care, Floraisons.Co PR event)"
```

---

### Task 2: Real projects in the data file; empty-gallery support

**Files:**
- Modify: `src/components/portfolio/projects.ts` (replace all placeholder entries), `src/components/portfolio/projects.test.ts` (new photo rules), `src/components/portfolio/ProjectDetail.tsx` (conditional gallery), `src/components/portfolio/Portfolio.tsx` (About image swap)

**Interfaces:**
- Consumes: Task 1's files; existing `Project`/`ProjectPhoto` types (unchanged shape — `photos: []` was always legal TypeScript; only the test forbade it).
- Produces: `PROJECTS` with slugs `yue-rou-chinese-fantasy-mv`, `chroma-car-care`, `floraisons-pr-event` (Task 3's build/sitemap pick these up automatically via `projectSlugs()`).

- [ ] **Step 1: Update the tests first (TDD — they must fail against the placeholder data)**

In `src/components/portfolio/projects.test.ts`, replace the single `"every project has the fields the pages rely on"` test with these three tests:

```ts
  it("every project has the fields the pages rely on", () => {
    for (const p of PROJECTS) {
      expect(p.slug).toMatch(/^[a-z0-9-]+$/);
      expect(p.title.length).toBeGreaterThan(0);
      expect(["video", "photo"]).toContain(p.type);
      expect(p.cover.length).toBeGreaterThan(0);
      expect(p.story.length).toBeGreaterThan(0);
    }
  });

  it("photo projects have a gallery; video projects have a youtubeId or photos", () => {
    for (const p of PROJECTS) {
      if (p.type === "photo") expect(p.photos.length).toBeGreaterThan(0);
      else expect(Boolean(p.youtubeId) || p.photos.length > 0).toBe(true);
    }
  });

  it("contains no placeholder stock content", () => {
    for (const p of PROJECTS) {
      expect(p.cover).not.toContain("unsplash");
      for (const photo of p.photos) expect(photo.src).not.toContain("unsplash");
    }
  });
```

(Keep the unique-slugs test, the gear-ban test, and the `getProject` test as-is.)

Run: `npx vitest run src/components/portfolio/projects.test.ts`
Expected: FAIL — the placeholder data still uses Unsplash covers.

- [ ] **Step 2: Replace the data**

In `src/components/portfolio/projects.ts`, replace everything from the `// PLACEHOLDER projects` comment through the end of the `PROJECTS` array (keep the header comment, types, and the two helper functions) with:

```ts
export const PROJECTS: Project[] = [
  {
    slug: "yue-rou-chinese-fantasy-mv",
    title: "Yue Rou's Chinese Fantasy Music Video Journey",
    type: "video",
    cover: "https://i.ytimg.com/vi/QsSV2IPbqhA/maxresdefault.jpg",
    story:
      "A wish-journey film for Make-A-Wish Singapore — following Yue Rou as her Chinese-fantasy music video comes to life, from first fitting to final frame.",
    tags: ["Documentary", "Make-A-Wish Singapore"],
    youtubeId: "QsSV2IPbqhA",
    photos: [],
  },
  {
    slug: "chroma-car-care",
    title: "Chroma Car Care",
    type: "photo",
    cover: "/work/chroma-car-care/01.jpg",
    story:
      "Brand shoot for Chroma Car Care — paintwork gloss, product details, and the finishing touches that sell the shine.",
    tags: ["Brand", "Automotive"],
    photos: Array.from({ length: 12 }, (_, i) => ({
      src: `/work/chroma-car-care/${String(i + 1).padStart(2, "0")}.jpg`,
      alt: `Chroma Car Care shoot — photo ${i + 1}`,
    })),
  },
  {
    slug: "floraisons-pr-event",
    title: "Floraisons.Co PR Event",
    type: "photo",
    cover: "/work/floraisons-pr-event/01.jpg",
    story:
      "Event coverage for Floraisons.Co's PR launch — the florals, the guests, and the in-between moments that made the room feel alive.",
    tags: ["Event", "PR Launch"],
    photos: Array.from({ length: 12 }, (_, i) => ({
      src: `/work/floraisons-pr-event/${String(i + 1).padStart(2, "0")}.jpg`,
      alt: `Floraisons.Co PR event — photo ${i + 1}`,
    })),
  },
];
```

Also update the file's header comment: the placeholder note is obsolete; the "TO ADD A PROJECT" instructions stay.

Run: `npx vitest run src/components/portfolio/projects.test.ts` — all PASS.

- [ ] **Step 3: Hide the gallery grid when a project has no photos**

In `src/components/portfolio/ProjectDetail.tsx`, wrap the gallery block. Replace:

```tsx
      {/* Gallery */}
      <div className="max-w-[1400px] mx-auto px-6 pb-16">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
```

with:

```tsx
      {/* Gallery */}
      {project.photos.length > 0 && (
      <div className="max-w-[1400px] mx-auto px-6 pb-16">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
```

and close it — the block currently ends:

```tsx
        </div>
      </div>

      {/* CTA banner */}
```

becomes:

```tsx
        </div>
      </div>
      )}

      {/* CTA banner */}
```

- [ ] **Step 4: Swap the About image to the crew group photo (and un-verticalize its box)**

The user's chosen About photo is a **landscape** group shot; the current About visual column is a vertical `aspect-[3/4]` box, which would crop most of the group out via `object-cover`. Per the user's direction, adjust the box to the photo — not the photo to the box.

In `src/components/portfolio/Portfolio.tsx`:

a) Replace the container line:

```tsx
            <div className="aspect-[3/4] bg-neutral-800 relative z-10 overflow-hidden">
```

with:

```tsx
            <div className="aspect-[3/2] bg-neutral-800 relative z-10 overflow-hidden">
```

b) Replace the image line:

```tsx
              <img src="https://images.unsplash.com/photo-1549488497-2374e2a86577?q=80&w=1600&auto=format&fit=crop" alt="Singapore Streets" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
```

with:

```tsx
              <img src="/work/about-crew.jpg" alt="The Apex Cinematics crew under the Jewel Changi dome" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
```

(The decorative orange block + offset border siblings and the grayscale-to-color hover stay untouched; they work at any aspect. In Task 3 Step 3's screenshots, confirm the About section still balances against the text column on desktop — with the landscape box the image is shorter, which is expected and fine — and that all 9 people are visible.)

- [ ] **Step 5: Verify + commit**

Run: `npx tsc --noEmit && npm test && npx next build`
Expected: green; build lists `● /work/[slug]` with exactly `/work/yue-rou-chinese-fantasy-mv`, `/work/chroma-car-care`, `/work/floraisons-pr-event`.

```bash
git add src/components/portfolio
git commit -m "feat: real portfolio projects replace placeholders (2 shoots + Make-A-Wish film)"
```

---

### Task 3: Interactive hero texture (`HeroCanvas`)

**Files:**
- Create: `src/components/portfolio/HeroCanvas.tsx`
- Modify: `src/components/portfolio/Portfolio.tsx` (hero background block; remove `showreelOk`), `src/app/globals.css` (remove the now-unused kenburns block)

**Interfaces:**
- Consumes: nothing.
- Produces: `HeroCanvas` default export, no props, fills its positioned parent.

- [ ] **Step 1: Create the component**

```tsx
// src/components/portfolio/HeroCanvas.tsx
"use client";
import { useEffect, useRef } from "react";

// Cursor-reactive "darkroom" texture: drifting dust/bokeh particles over a
// near-black base, with a soft safelight glow that eases toward the pointer
// and gently pushes particles aside. Canvas 2D, no dependencies.
export default function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    const pointer = { x: 0.5, y: 0.4, tx: 0.5, ty: 0.4 };

    type Particle = {
      x: number; y: number; r: number;
      vx: number; vy: number; a: number; warm: boolean;
    };
    let particles: Particle[] = [];

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(110, Math.max(40, Math.round(width / 14)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.6 + Math.random() * 2.6,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        a: 0.08 + Math.random() * 0.5,
        warm: Math.random() < 0.35,
      }));
    }

    function drawFrame() {
      ctx.fillStyle = "#0A0A0A";
      ctx.fillRect(0, 0, width, height);

      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;
      const gx = pointer.x * width;
      const gy = pointer.y * height;

      const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(width, height) * 0.55);
      glow.addColorStop(0, "rgba(255,107,0,0.16)");
      glow.addColorStop(0.35, "rgba(255,107,0,0.05)");
      glow.addColorStop(1, "rgba(255,107,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        const dx = p.x - gx;
        const dy = p.y - gy;
        const d2 = dx * dx + dy * dy;
        const rad = 160;
        if (d2 < rad * rad && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = ((rad - d) / rad) * 0.6;
          p.x += (dx / d) * push;
          p.y += (dy / d) * push;
        }
        if (p.x < -10) p.x = width + 10; else if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10; else if (p.y > height + 10) p.y = -10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.warm
          ? `rgba(255,107,0,${p.a * 0.8})`
          : `rgba(255,244,230,${p.a * 0.35})`;
        ctx.fill();
      }
    }

    let raf = 0;
    let running = !reduced;
    const loop = () => {
      drawFrame();
      if (running) raf = requestAnimationFrame(loop);
    };

    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.tx = (e.clientX - rect.left) / rect.width;
      pointer.ty = (e.clientY - rect.top) / rect.height;
    };
    const onVisibility = () => {
      if (reduced) return;
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(loop);
      }
    };

    resize();
    if (reduced) drawFrame();
    else raf = requestAnimationFrame(loop);
    window.addEventListener("resize", resize);
    // Window-level so the texture reacts even though hero content sits above it.
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 w-full h-full" />;
}
```

- [ ] **Step 2: Wire it into the hero**

In `src/components/portfolio/Portfolio.tsx`:

a) Add `import HeroCanvas from './HeroCanvas';` next to the `ProjectCard` import.

b) Delete the line `const [showreelOk, setShowreelOk] = useState(true);`.

c) Replace the whole hero background block — from `{/* Background: showreel loop with poster fallback` down to (and including) the letterbox/timecode chip's closing `</div>` of that container — with:

```tsx
        {/* Background: cursor-reactive animated texture (no photo needed) */}
        <div className="absolute inset-0 z-0">
          <HeroCanvas />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-transparent to-transparent z-10"></div>
          {/* Cinematic letterbox bars */}
          <div className="absolute top-0 left-0 right-0 h-5 bg-black z-20"></div>
          <div className="absolute bottom-0 left-0 right-0 h-5 bg-black z-20"></div>
          {/* Timecode chip */}
          <div className="absolute top-8 right-6 z-20 font-mono text-[10px] tracking-[0.3em] text-neutral-400 uppercase hidden md:flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-orange animate-pulse"></span>
            REC • APX • SG
          </div>
        </div>
```

(The old `<img>`, `<video>`, `apex-kenburns` class, and the heavy black overlays go — the canvas is already dark, and text keeps its own backdrop styling.)

d) In `src/app/globals.css`, delete the now-unused block:

```css
@keyframes kenburns {
  0% { transform: scale(1); }
  100% { transform: scale(1.08); }
}
.apex-kenburns { animation: kenburns 24s ease-in-out infinite alternate; }
```

(`grep -rn "kenburns" src` must return nothing afterwards.)

- [ ] **Step 3: Verify visually (production server, both viewports)**

`npx tsc --noEmit && npm test && npx next build`, then `npx next start -p 3131` and Playwright: assert `document.querySelector('[data-apex-root] canvas')` exists with non-zero width/height; `page.mouse.move()` across the hero then screenshot desktop (1440×900) + mobile (390×844) — dark textured hero with orange glow near the cursor position, headline legible, no console/CSP errors, no overflow. Also screenshot `/work/chroma-car-care` — gallery thumbnails now actually render in the sandbox (self-hosted files). Kill the server after.

- [ ] **Step 4: Commit**

```bash
git add src/components/portfolio/HeroCanvas.tsx src/components/portfolio/Portfolio.tsx src/app/globals.css
git commit -m "feat: cursor-reactive animated hero texture replaces stock photo"
```

---

### Task 4: Drop the Unsplash allowances + ship

**Files:**
- Modify: `next.config.ts:24` (img-src) and the `images.remotePatterns` block

**Interfaces:** n/a.

- [ ] **Step 1: Confirm nothing references Unsplash anymore**

Run: `grep -rn "unsplash" src`
Expected: no hits. Any hit = a missed swap in Task 2/3; fix it first.

- [ ] **Step 2: Tighten the config**

In `next.config.ts`:
- `"img-src 'self' data: blob: https://vercel.live https://vercel.com https://images.unsplash.com https://i.ytimg.com",` → remove ` https://images.unsplash.com` from the string.
- In `images.remotePatterns`, delete the line `{ protocol: "https", hostname: "images.unsplash.com" },` (keep `i.ytimg.com`).

- [ ] **Step 3: Full verification**

`npx tsc --noEmit && npm test && npx next build` — green. Re-run Task 3 Step 3's Playwright checks once more against a fresh production server (CSP change could break the YouTube cover — it must still load from `i.ytimg.com`... in the sandbox that request is network-blocked, so assert *no CSP-classed console errors* rather than image pixels).

- [ ] **Step 4: Finish the branch**

Use superpowers:finishing-a-development-branch: tests → merge `feat/real-content-hero` → `main` → re-test → push (Vercel auto-deploys).

- [ ] **Step 5: Post-deploy hand-off (tell the user)**

1. Portfolio now shows your 3 real projects; hero reacts to the cursor.
2. **6 videos still need YouTube uploads** (unlisted is fine): ANNEXE Project Farewell, cyclus marine cocktail highlight, Harp Snippet, Design your Dream Future, IG Reel Intro, IG Reel Cooking. Send each YouTube link once uploaded — adding a project is then a 5-line entry in `projects.ts` (instructions are in that file's header).
3. Curation picks were sampled evenly — to swap any photo, replace the numbered file in `public/work/<project>/` (same filename) and redeploy, or ask for a re-curation.
4. The Downloads zips and the Desktop `Video Samples` folder copy can be deleted whenever you're done (keep your own originals backed up elsewhere first).
5. The About section now shows the crew group photo from Jewel Changi, full group visible in a landscape frame.
