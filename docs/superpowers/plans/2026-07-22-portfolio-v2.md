# Apex Cinematics Portfolio v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the placeholder portfolio at `/` into the real Apex Cinematics site: photo/video project pages with galleries at `/work/[slug]`, direct contact (email/IG/Telegram), rebranded contact-driving copy, hero showreel, and cinematic flare.

**Architecture:** A `(portfolio)` route group owns the Oswald/Inter fonts and contains `/` plus the new statically-generated `/work/[slug]` pages. All project content lives in one data file (`projects.ts`) + `public/work/<slug>/` photo folders. New self-contained components: `Lightbox` (own code, no dependency), `YouTubeEmbed` (lazy, privacy-enhanced), `ProjectCard`. The 626-line `Portfolio.tsx` is edited in place (hero/services/about/contact/footer) — its structure is sound; only the work-grid section and dead code (fake form, coverr hover-videos) are replaced.

**Tech Stack:** Next.js 16 App Router, Tailwind v4 (`@theme` in `globals.css`), `next/image`, `next/font`, `@vercel/analytics` (new dep), vitest, Playwright for verification.

**Spec:** `docs/superpowers/specs/2026-07-22-portfolio-v2-design.md` — copy strings in this plan are verbatim from it.

## Global Constraints

- Brand is **Apex Cinematics** everywhere. Zero occurrences of "Apex Angles"/"apexangles" may survive.
- **No gear talk, no drone mentions, no public prices** anywhere in portfolio copy or tags.
- Contact targets, exactly: `mailto:chuajiajun2705@gmail.com`, `https://www.instagram.com/mynameisjiajun`, `https://t.me/mynameisjiajun`.
- **Zero links to the invoice app** from any portfolio page (`a[href*="invoices_login"]` count must be 0).
- Photos in `public/work/<slug>/`; videos via YouTube ID only. Placeholder projects keep their Unsplash covers until real content lands (marked `// PLACEHOLDER`).
- New external origins allowed in CSP: `https://www.youtube-nocookie.com` (frame-src), `https://i.ytimg.com` (img-src). `media-src` tightens to `'self'` (coverr hover-videos are removed). Never remove other existing sources.
- Copy strings marked "(verbatim)" must be used character-for-character.
- Existing vitest suite green after every task: `npm test`. Invoice app behaviour untouched.
- Dev hygiene: `pkill -f "next dev"; pkill -f "next start"` before starting servers.
- All work on a branch: `git checkout -b feat/portfolio-v2` before Task 1.

---

### Task 1: Project data layer

**Files:**
- Create: `src/components/portfolio/projects.ts`
- Modify: `src/components/portfolio/types.ts` (shrink to `Service` only)
- Test: `src/components/portfolio/projects.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (all exported from `projects.ts`, used by Tasks 2–3 and 6):
  - `type ProjectType = "video" | "photo"`
  - `type ProjectPhoto = { src: string; alt: string; caption?: string }`
  - `type Project = { slug: string; title: string; type: ProjectType; cover: string; story: string; tags: string[]; youtubeId?: string; photos: ProjectPhoto[] }`
  - `const PROJECTS: Project[]`
  - `function getProject(slug: string): Project | undefined`
  - `function projectSlugs(): string[]`

- [ ] **Step 1: Write the failing test**

```ts
// src/components/portfolio/projects.test.ts
import { describe, expect, it } from "vitest";
import { PROJECTS, getProject, projectSlugs } from "./projects";

describe("portfolio projects data", () => {
  it("has at least one project and unique slugs", () => {
    expect(PROJECTS.length).toBeGreaterThan(0);
    const slugs = projectSlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every project has the fields the pages rely on", () => {
    for (const p of PROJECTS) {
      expect(p.slug).toMatch(/^[a-z0-9-]+$/);
      expect(p.title.length).toBeGreaterThan(0);
      expect(["video", "photo"]).toContain(p.type);
      expect(p.cover.length).toBeGreaterThan(0);
      expect(p.story.length).toBeGreaterThan(0);
      expect(p.photos.length).toBeGreaterThan(0);
    }
  });

  it("never mentions gear or drones in tags/copy (user has neither)", () => {
    const banned = /sony|a7s|drone|lens|glass/i;
    for (const p of PROJECTS) {
      expect(p.tags.join(" ")).not.toMatch(banned);
      expect(p.story).not.toMatch(banned);
    }
  });

  it("getProject finds by slug and returns undefined for unknown", () => {
    expect(getProject(PROJECTS[0].slug)).toBe(PROJECTS[0]);
    expect(getProject("nope")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/portfolio/projects.test.ts`
Expected: FAIL — cannot resolve `./projects`.

- [ ] **Step 3: Create the data file**

```ts
// src/components/portfolio/projects.ts
// ── The single source of truth for portfolio content. ──
// TO ADD A PROJECT:
//   1. Drop JPGs into public/work/<slug>/  (e.g. public/work/my-wedding/01.jpg)
//   2. Add an entry below: photos reference "/work/<slug>/01.jpg" etc.
//   3. Video projects: upload to YouTube (unlisted is fine), set youtubeId
//      to the 11-char ID from the URL. Photo projects: omit youtubeId.
// Tags are what/where only ("Wedding · Sentosa") — never camera/lens/gear.

export type ProjectType = "video" | "photo";

export type ProjectPhoto = { src: string; alt: string; caption?: string };

export type Project = {
  slug: string;
  title: string;
  type: ProjectType;
  cover: string;
  story: string;
  tags: string[];
  youtubeId?: string;
  photos: ProjectPhoto[];
};

// PLACEHOLDER projects — replace each with real work as folders/links arrive.
// Covers are Unsplash stock; galleries reuse the cover so the lightbox works.
export const PROJECTS: Project[] = [
  {
    slug: "neon-nights-clarke-quay",
    title: "Neon Nights: Clarke Quay",
    type: "video",
    cover: "https://images.unsplash.com/photo-1563251433-89a5df263c9b?q=80&w=1600&auto=format&fit=crop",
    story: "High-energy aftermovie for a sold-out warehouse event in Singapore.",
    tags: ["Event", "Clarke Quay"],
    photos: [{ src: "https://images.unsplash.com/photo-1563251433-89a5df263c9b?q=80&w=1600&auto=format&fit=crop", alt: "Concert crowd under neon light" }],
  },
  {
    slug: "urban-solitude-tiong-bahru",
    title: "Urban Solitude: Tiong Bahru",
    type: "video",
    cover: "https://images.unsplash.com/photo-1626084478170-0e57dfc920e5?q=80&w=1600&auto=format&fit=crop",
    story: "A moody short documentary exploring the quiet corners of SG heritage estates.",
    tags: ["Documentary", "Tiong Bahru"],
    photos: [{ src: "https://images.unsplash.com/photo-1626084478170-0e57dfc920e5?q=80&w=1600&auto=format&fit=crop", alt: "Alley at night in Tiong Bahru" }],
  },
  {
    slug: "streetwear-drop-haji-lane",
    title: "Streetwear Drop: Haji Lane",
    type: "photo",
    cover: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?q=80&w=1600&auto=format&fit=crop",
    story: "Lookbook and social content for a local sustainable fashion brand.",
    tags: ["Brand", "Haji Lane"],
    photos: [{ src: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?q=80&w=1600&auto=format&fit=crop", alt: "Streetwear portrait" }],
  },
  {
    slug: "golden-hour-at-mbs",
    title: "Golden Hour at MBS",
    type: "photo",
    cover: "https://images.unsplash.com/photo-1506318137071-a8bcbf67119d?q=80&w=1600&auto=format&fit=crop",
    story: "Influencer campaign featuring the iconic Singapore skyline.",
    tags: ["Lifestyle", "Marina Bay"],
    photos: [{ src: "https://images.unsplash.com/photo-1506318137071-a8bcbf67119d?q=80&w=1600&auto=format&fit=crop", alt: "Golden hour skyline portrait" }],
  },
  {
    slug: "the-craftsman",
    title: "The Craftsman",
    type: "video",
    cover: "https://images.unsplash.com/photo-1545648719-2fc513476837?q=80&w=1600&auto=format&fit=crop",
    story: "Profile documentary on a traditional lantern maker in Chinatown.",
    tags: ["Documentary", "Chinatown"],
    photos: [{ src: "https://images.unsplash.com/photo-1545648719-2fc513476837?q=80&w=1600&auto=format&fit=crop", alt: "Craftsman at work" }],
  },
  {
    slug: "speed-and-motion",
    title: "Speed & Motion",
    type: "video",
    cover: "https://images.unsplash.com/photo-1616423640778-28d1b53229bd?q=80&w=1600&auto=format&fit=crop",
    story: "Event coverage for a local automotive meet.",
    tags: ["Event", "Automotive"],
    photos: [{ src: "https://images.unsplash.com/photo-1616423640778-28d1b53229bd?q=80&w=1600&auto=format&fit=crop", alt: "Car in motion at night" }],
  },
];

export function getProject(slug: string): Project | undefined {
  return PROJECTS.find((p) => p.slug === slug);
}

export function projectSlugs(): string[] {
  return PROJECTS.map((p) => p.slug);
}
```

- [ ] **Step 4: Shrink `types.ts`**

Replace the entire contents of `src/components/portfolio/types.ts` with:

```ts
export interface Service {
  id: string;
  title: string;
  description: string;
  features: string[];
  icon: string;
}
```

(`PortfolioCategory`, `Project`, and `ChatMessage` go — Task 2 removes their last usages in `Portfolio.tsx`; `price` leaves `Service` because prices are dropped. `npx tsc --noEmit` will fail until Task 2's edits land, so it is NOT run in this task — the vitest test only imports `projects.ts`.)

- [ ] **Step 5: Run the new test**

Run: `npx vitest run src/components/portfolio/projects.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/portfolio/projects.ts src/components/portfolio/projects.test.ts src/components/portfolio/types.ts
git commit -m "feat: portfolio project data layer (slugs, types, placeholder entries)"
```

---

### Task 2: Route group, work grid, and copy/rebrand of the one-pager

**Files:**
- Create: `src/app/(portfolio)/layout.tsx`, `src/components/portfolio/ProjectCard.tsx`
- Move: `src/app/page.tsx` → `src/app/(portfolio)/page.tsx` (contents replaced)
- Modify: `src/components/portfolio/Portfolio.tsx` (many anchored edits below), `src/app/layout.tsx` (metadata), `next.config.ts` (media-src + remotePatterns)

**Interfaces:**
- Consumes: `PROJECTS`, `Project`, `ProjectType` from `./projects` (Task 1).
- Produces: `ProjectCard` default-exports `ProjectCard({ project }: { project: Project })` rendering a `<Link href={`/work/${project.slug}`}>`; the `(portfolio)` layout provides Oswald/Inter vars + `data-apex-root` for every route in the group (Task 3's pages rely on this).

- [ ] **Step 1: Create the route-group layout and move the home page**

Create `src/app/(portfolio)/layout.tsx`:

```tsx
import { Inter, Oswald } from "next/font/google";

// Self-hosted via next/font. These variables feed the font-apex-* utilities
// (see the `@theme inline` block in globals.css — `inline` is load-bearing).
const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
});

export default function PortfolioLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div data-apex-root className={`${oswald.variable} ${inter.variable} flex-1`}>
      {children}
    </div>
  );
}
```

Then:

```bash
git mv src/app/page.tsx "src/app/(portfolio)/page.tsx"
```

and replace the moved file's entire contents with:

```tsx
import Portfolio from "@/components/portfolio/Portfolio";

export default function HomePage() {
  return <Portfolio />;
}
```

- [ ] **Step 2: Update root-layout metadata for the new brand**

In `src/app/layout.tsx`, replace the `metadata` export with:

```tsx
export const metadata: Metadata = {
  metadataBase: new URL("https://apexcinematics.tech"),
  title: "Apex Cinematics | Videography & Photography, Singapore",
  description:
    "Apex Cinematics is a Singapore-based studio covering events, documentaries, and social content — cinematic photo and video for everyone and anyone.",
};
```

(`metadataBase` makes Task 3's relative OG images resolve to absolute URLs.)

- [ ] **Step 3: Create `ProjectCard`**

Create `src/components/portfolio/ProjectCard.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";
import type { Project } from "./projects";

export default function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/work/${project.slug}`}
      className="group relative block aspect-video overflow-hidden border border-neutral-900 hover:border-brand-orange transition-colors bg-neutral-900"
    >
      <Image
        src={project.cover}
        alt={project.title}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
        className="object-cover opacity-80 transition-all duration-700 group-hover:opacity-100 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
      {project.type === "video" && (
        <div className="absolute top-4 right-4 w-10 h-10 bg-black/60 border border-white/20 backdrop-blur-sm flex items-center justify-center text-white group-hover:bg-brand-orange group-hover:border-brand-orange transition-all">
          <Play size={16} className="translate-x-[1px]" />
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <span className="text-brand-orange text-[10px] font-bold uppercase tracking-widest">
          {project.type === "video" ? "Video" : "Photo"} — {project.tags.join(" · ")}
        </span>
        <h3 className="text-2xl font-apex-display font-bold text-white uppercase leading-none mt-2">
          {project.title}
        </h3>
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Rewire `Portfolio.tsx` — imports, data, filter**

All edits in `src/components/portfolio/Portfolio.tsx`, using these exact anchors:

a) Replace `import { PortfolioCategory, Project, Service } from './types';` with:

```ts
import { Service } from './types';
import { PROJECTS, type ProjectType } from './projects';
import ProjectCard from './ProjectCard';
```

b) Delete the whole in-file `const PROJECTS: Project[] = [ … ];` block (starts `// --- DATA ---` region, from `const PROJECTS` to its closing `];`) — the data now comes from `projects.ts`. Keep the `SERVICES` array (rewritten in Step 5).

c) Delete the entire `VideoProjectCard` component (from `const VideoProjectCard: React.FC<{ project: Project }> = ({ project }) => {` through its closing `};`) — the coverr hover-videos go with it.

d) In the `Portfolio` component, replace:

```ts
  const [filter, setFilter] = useState<PortfolioCategory>(PortfolioCategory.ALL);
```

with:

```ts
  const [filter, setFilter] = useState<"all" | ProjectType>("all");
```

and replace:

```ts
  const filteredProjects = PROJECTS.filter(p => 
    filter === PortfolioCategory.ALL || p.category === filter
  );
```

with:

```ts
  const filteredProjects = PROJECTS.filter(p => filter === "all" || p.type === filter);
```

e) Replace the filter buttons block (anchor: `{Object.values(PortfolioCategory).map((cat) => (` through its closing `))}`) with:

```tsx
                {(["all", "video", "photo"] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilter(cat)}
                    className={`text-sm font-bold uppercase tracking-wider transition-all border-b-2 pb-1 ${
                      filter === cat
                        ? 'text-brand-orange border-brand-orange'
                        : 'text-neutral-500 border-transparent hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
```

f) Replace the grid block:

```tsx
            {filteredProjects.map((project, idx) => (
              <ScrollReveal key={project.id} className={`delay-[${idx * 100}ms]`}>
                <VideoProjectCard project={project} />
              </ScrollReveal>
            ))}
```

with:

```tsx
            {filteredProjects.map((project, idx) => (
              <ScrollReveal key={project.slug} delayMs={idx * 80}>
                <ProjectCard project={project} />
              </ScrollReveal>
            ))}
```

g) Update `ScrollReveal` to support real stagger (the old `delay-[${idx*100}ms]` built class names at runtime, which Tailwind can never generate — it silently never worked). Replace its signature and wrapper div:

```tsx
const ScrollReveal: React.FC<{ children: React.ReactNode; className?: string; delayMs?: number }> = ({ children, className = "", delayMs = 0 }) => {
```

and on its `<div>` add a style prop:

```tsx
    <div
      ref={domRef}
      style={{ transitionDelay: `${delayMs}ms` }}
      className={`transition-all duration-1000 ease-out transform ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'
      } ${className}`}
    >
```

- [ ] **Step 5: Rebrand + rewrite copy (anchored, copy verbatim from spec)**

Still in `Portfolio.tsx`:

a) Brand name — 3 occurrences of the split logo. Replace both `Apex<span className="text-brand-orange not-italic">Angles</span>` (NavBar line ~230 and footer line ~615) with `Apex<span className="text-brand-orange not-italic">Cinematics</span>`. Replace the footer line `© 2024 Apex Angles SG. All rights reserved.` with `© 2026 Apex Cinematics SG. All rights reserved.`

b) Hero subtitle — replace the `<p>` content `Apex Angles is a creative visual studio specializing in cinematic videography and high-impact photography for the digital age.` with (verbatim):

```
Apex Cinematics is a Singapore-based studio covering events, documentaries, and social content — cinematic photo and video for everyone and anyone.
```

c) Hero buttons: `View Portfolio` → `View Work`; `Get In Touch` stays.

d) `SERVICES` array — replace the whole array with (verbatim copy):

```ts
const SERVICES: Service[] = [
  {
    id: 's1',
    title: 'Event Coverage',
    description: "Weddings, corporate, nightlife, community — if it matters to you, it's worth capturing properly. Full-day or hourly coverage with fast turnaround highlight edits.",
    features: ['Full-day or hourly coverage', 'Highlight + full edits', 'Fast turnaround', 'Photo + video teams'],
    icon: 'video'
  },
  {
    id: 's2',
    title: 'Documentary',
    description: 'Real people, real stories. Interview-led films for brands, families, and causes that want something honest and lasting.',
    features: ['Interview-led storytelling', 'Research + planning included', 'Cinematic color + sound', 'Full usage rights'],
    icon: 'film'
  },
  {
    id: 's3',
    title: 'Social Media Content',
    description: 'Reels and TikToks built to perform — planned, shot, and cut for the platform, delivered ready to post.',
    features: ['Ready-to-post formats', 'Platform-native editing', 'Monthly packages', 'Trend-aware planning'],
    icon: 'aperture'
  }
];
```

e) Service card render — delete the price line `<div className="text-lg text-brand-orange font-bold mb-6 font-mono">{service.price}</div>` and, after the closing `</ul>` of the features list, add:

```tsx
                  <a href="#contact" className="mt-8 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-brand-orange hover:text-white transition-colors">
                    Let's talk <ArrowRight size={14} />
                  </a>
```

f) About section — replace the two `<p>` paragraphs (anchors: `Apex Angles isn't about traditional videography…` and `From the neon-soaked streets…`) with one paragraph (verbatim):

```tsx
              <p>
                Apex Cinematics shoots photo and video for everyone and anyone — from one-person passion
                projects to full-scale corporate events. No gear talk, no jargon: just high-quality
                coverage, delivered how you need it.
              </p>
```

and replace the Vision/Gear grid's two inner `<div>`s with:

```tsx
              <div>
                <h4 className="text-white font-apex-display font-bold uppercase text-xl mb-2">Coverage</h4>
                <p className="text-sm text-neutral-500">Events, documentaries, and social content — photo and video.</p>
              </div>
              <div>
                <h4 className="text-white font-apex-display font-bold uppercase text-xl mb-2">Promise</h4>
                <p className="text-sm text-neutral-500">High-quality work, clear communication, delivered on time.</p>
              </div>
```

g) After the about paragraphs (directly before the `mt-12 border-t` grid), add a contact funnel line:

```tsx
            <a href="#contact" className="mt-8 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-brand-orange hover:text-white transition-colors">
              Let's talk <ArrowRight size={14} />
            </a>
```

h) Contact section header — replace `Currently accepting bookings for Q3 & Q4 2024.` with `Tell me what you're planning — I'll get back within a day.`

- [ ] **Step 6: Replace the contact form with direct links**

a) In the `Portfolio` component, delete the `contactForm` state, `handleContactChange`, and `handleContactSubmit` (everything from `// Contact Form State` through the closing `};` of `handleContactSubmit`).

b) Replace the contact card grid — the whole block from `<div className="grid grid-cols-1 md:grid-cols-2 gap-12 bg-neutral-900/50 p-8 md:p-12 border border-neutral-800">` through the `</form>`'s parent `</div>` (ends just before `</ScrollReveal>`) — with:

```tsx
            <div className="bg-neutral-900/50 p-8 md:p-12 border border-neutral-800">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <a href="mailto:chuajiajun2705@gmail.com" className="group flex flex-col items-center gap-4 p-8 bg-black border border-neutral-800 hover:border-brand-orange hover:-translate-y-1 transition-all text-center">
                  <div className="w-14 h-14 bg-neutral-900 flex items-center justify-center text-white group-hover:bg-brand-orange transition-colors">
                    <Mail size={24} />
                  </div>
                  <div>
                    <div className="text-white font-apex-display font-bold uppercase tracking-wider">Email</div>
                    <div className="text-neutral-500 text-sm mt-1 break-all">chuajiajun2705@gmail.com</div>
                  </div>
                </a>
                <a href="https://www.instagram.com/mynameisjiajun" target="_blank" rel="noopener noreferrer" className="group flex flex-col items-center gap-4 p-8 bg-black border border-neutral-800 hover:border-brand-orange hover:-translate-y-1 transition-all text-center">
                  <div className="w-14 h-14 bg-neutral-900 flex items-center justify-center text-white group-hover:bg-brand-orange transition-colors">
                    <Instagram size={24} />
                  </div>
                  <div>
                    <div className="text-white font-apex-display font-bold uppercase tracking-wider">Instagram</div>
                    <div className="text-neutral-500 text-sm mt-1">@mynameisjiajun</div>
                  </div>
                </a>
                <a href="https://t.me/mynameisjiajun" target="_blank" rel="noopener noreferrer" className="group flex flex-col items-center gap-4 p-8 bg-black border border-neutral-800 hover:border-brand-orange hover:-translate-y-1 transition-all text-center">
                  <div className="w-14 h-14 bg-neutral-900 flex items-center justify-center text-white group-hover:bg-brand-orange transition-colors">
                    <Send size={24} />
                  </div>
                  <div>
                    <div className="text-white font-apex-display font-bold uppercase tracking-wider">Telegram</div>
                    <div className="text-neutral-500 text-sm mt-1">@mynameisjiajun</div>
                  </div>
                </a>
              </div>
              <p className="text-center text-neutral-500 text-sm mt-8 font-mono uppercase tracking-widest">Based in Singapore · Available for travel</p>
            </div>
```

c) Update the lucide import list: add `Send`, `Play` is used only by `ProjectCard` (not here); remove now-unused icons — after all Task 2 edits, run `npx tsc --noEmit` and delete any import it flags as unused (expected to go: `Layout`, `Linkedin`, `Twitter`, `Maximize2`, possibly `Video`/`Aperture`/`Film` stay for service icons — keep whatever compiles clean with zero unused).

- [ ] **Step 7: CSP + image config in `next.config.ts`**

a) Replace `"media-src 'self' https://cdn.coverr.co",` with `"media-src 'self'",` (coverr is gone; the hero showreel in Task 4 is `'self'`).

b) Add to `nextConfig` (sibling of `turbopack`):

```ts
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
    ],
  },
```

(next/image needs this for the placeholder Unsplash covers and Task 3's YouTube thumbnails; drop the unsplash entry later when real photos replace placeholders.)

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit && npm test && npx next build`
Expected: all green; build shows `○ /` (static). Then `grep -rn "Apex Angles\|apexangles\|Drone\|Sony" src/components/portfolio src/app` → zero hits.

- [ ] **Step 9: Commit**

```bash
git add -A src/app src/components/portfolio next.config.ts
git commit -m "feat: work grid from data file, Apex Cinematics rebrand, direct-contact section"
```

---

### Task 3: Project pages with gallery, lightbox, and YouTube embed

**Files:**
- Create: `src/app/(portfolio)/work/[slug]/page.tsx`, `src/components/portfolio/ProjectDetail.tsx`, `src/components/portfolio/Lightbox.tsx`, `src/components/portfolio/YouTubeEmbed.tsx`
- Modify: `next.config.ts:20-31` (CSP frame-src/img-src)

**Interfaces:**
- Consumes: `getProject`, `projectSlugs`, `Project`, `ProjectPhoto` from `@/components/portfolio/projects` (Task 1); the `(portfolio)` layout fonts (Task 2).
- Produces: route `/work/[slug]` (statically generated). `Lightbox` props: `{ photos: ProjectPhoto[]; index: number; onClose: () => void; onNavigate: (index: number) => void }`. `YouTubeEmbed` props: `{ id: string; title: string }`.

- [ ] **Step 1: CSP for YouTube**

In `next.config.ts`:
- `"frame-src https://vercel.live",` → `"frame-src https://vercel.live https://www.youtube-nocookie.com",`
- `"img-src 'self' data: blob: https://vercel.live https://vercel.com https://images.unsplash.com",` → append ` https://i.ytimg.com` inside the string.

- [ ] **Step 2: `YouTubeEmbed` (lazy, privacy-enhanced)**

Create `src/components/portfolio/YouTubeEmbed.tsx`:

```tsx
"use client";
import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";

// Renders a thumbnail until clicked — no YouTube JS/cookies on page load.
export default function YouTubeEmbed({ id, title }: { id: string; title: string }) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="relative aspect-video bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setPlaying(true)}
      className="group relative block w-full aspect-video overflow-hidden bg-black text-left"
      aria-label={`Play video: ${title}`}
    >
      <Image
        src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
        alt={title}
        fill
        sizes="100vw"
        className="object-cover opacity-70 transition-all duration-700 group-hover:opacity-100 group-hover:scale-105"
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="w-20 h-20 bg-brand-orange flex items-center justify-center transition-transform group-hover:scale-110">
          <Play size={32} className="text-white translate-x-[2px]" />
        </span>
      </span>
    </button>
  );
}
```

- [ ] **Step 3: `Lightbox`**

Create `src/components/portfolio/Lightbox.tsx`:

```tsx
"use client";
import { useEffect, useRef } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import type { ProjectPhoto } from "./projects";

export default function Lightbox({
  photos,
  index,
  onClose,
  onNavigate,
}: {
  photos: ProjectPhoto[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const touchStartX = useRef<number | null>(null);
  const prev = () => onNavigate((index - 1 + photos.length) % photos.length);
  const next = () => onNavigate((index + 1) % photos.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, photos.length]);

  const photo = photos[index];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.alt}
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center animate-fade-in"
      onClick={onClose}
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (dx > 50) prev();
        else if (dx < -50) next();
      }}
    >
      <button onClick={onClose} aria-label="Close" className="absolute top-5 right-5 z-10 w-12 h-12 flex items-center justify-center text-white hover:text-brand-orange transition-colors">
        <X size={28} />
      </button>
      <span className="absolute top-7 left-6 text-neutral-400 font-mono text-sm tracking-widest">
        {String(index + 1).padStart(2, "0")} / {String(photos.length).padStart(2, "0")}
      </span>
      {photos.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); prev(); }} aria-label="Previous photo" className="absolute left-2 md:left-6 z-10 w-12 h-12 hidden sm:flex items-center justify-center text-white hover:text-brand-orange transition-colors">
            <ChevronLeft size={32} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); next(); }} aria-label="Next photo" className="absolute right-2 md:right-6 z-10 w-12 h-12 hidden sm:flex items-center justify-center text-white hover:text-brand-orange transition-colors">
            <ChevronRight size={32} />
          </button>
        </>
      )}
      <figure className="relative w-[92vw] h-[80vh]" onClick={(e) => e.stopPropagation()}>
        <Image src={photo.src} alt={photo.alt} fill sizes="92vw" className="object-contain" priority />
        {photo.caption && (
          <figcaption className="absolute -bottom-8 left-0 right-0 text-center text-neutral-400 font-mono text-xs uppercase tracking-widest">
            {photo.caption}
          </figcaption>
        )}
      </figure>
    </div>
  );
}
```

- [ ] **Step 4: `ProjectDetail` + the page**

Create `src/components/portfolio/ProjectDetail.tsx`:

```tsx
"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Project } from "./projects";
import Lightbox from "./Lightbox";
import YouTubeEmbed from "./YouTubeEmbed";

export default function ProjectDetail({ project }: { project: Project }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <main className="min-h-screen bg-brand-dark text-neutral-200 selection:bg-brand-orange selection:text-white font-apex-sans">
      {/* Top bar */}
      <div className="max-w-[1400px] mx-auto px-6 pt-8 flex items-center justify-between">
        <Link href="/#portfolio" className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-neutral-400 hover:text-white transition-colors">
          <ArrowLeft size={16} /> All work
        </Link>
        <span className="text-2xl font-apex-display font-bold text-white uppercase italic">
          Apex<span className="text-brand-orange not-italic">Cinematics</span>
        </span>
      </div>

      {/* Lead media */}
      <div className="max-w-[1400px] mx-auto px-6 mt-8 animate-fade-in">
        {project.youtubeId ? (
          <YouTubeEmbed id={project.youtubeId} title={project.title} />
        ) : (
          <div className="relative aspect-video overflow-hidden bg-neutral-900">
            <Image src={project.cover} alt={project.title} fill sizes="100vw" priority className="object-cover" />
          </div>
        )}
      </div>

      {/* Title + story */}
      <div className="max-w-[1400px] mx-auto px-6 py-12">
        <span className="text-brand-orange font-bold uppercase tracking-[0.2em] text-xs">
          {project.type === "video" ? "Video" : "Photo"} — {project.tags.join(" · ")}
        </span>
        <h1 className="text-4xl md:text-6xl font-apex-display font-bold text-white uppercase leading-[0.9] mt-3 mb-6">
          {project.title}
        </h1>
        <p className="max-w-2xl text-lg text-neutral-400 font-light leading-relaxed border-l-2 border-brand-orange pl-6">
          {project.story}
        </p>
      </div>

      {/* Gallery */}
      <div className="max-w-[1400px] mx-auto px-6 pb-16">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
          {project.photos.map((photo, i) => (
            <button key={photo.src} onClick={() => setLightboxIndex(i)} aria-label={`Open photo: ${photo.alt}`} className="group relative aspect-square overflow-hidden bg-neutral-900">
              <Image src={photo.src} alt={photo.alt} fill sizes="(max-width: 768px) 50vw, 33vw" className="object-cover opacity-90 transition-all duration-500 group-hover:opacity-100 group-hover:scale-105" />
            </button>
          ))}
        </div>
      </div>

      {/* CTA banner */}
      <section className="py-20 bg-black border-t border-neutral-900 text-center px-6">
        <h2 className="text-4xl md:text-6xl font-apex-display font-bold text-white uppercase mb-8">
          Like this? Let's shoot yours.
        </h2>
        <Link href="/#contact" className="inline-flex items-center gap-3 px-10 py-5 bg-brand-orange text-white font-bold uppercase tracking-widest hover:bg-orange-600 transition-all">
          Get in touch <ArrowRight size={20} />
        </Link>
      </section>

      {lightboxIndex !== null && (
        <Lightbox
          photos={project.photos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </main>
  );
}
```

Create `src/app/(portfolio)/work/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProject, projectSlugs } from "@/components/portfolio/projects";
import ProjectDetail from "@/components/portfolio/ProjectDetail";

export function generateStaticParams() {
  return projectSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return {};
  return {
    title: `${project.title} | Apex Cinematics`,
    description: project.story,
    openGraph: { title: project.title, description: project.story, images: [project.cover] },
  };
}

export default async function WorkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();
  return <ProjectDetail project={project} />;
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm test && npx next build`
Expected: green; build lists `● /work/[slug]` (SSG) with 6 paths. Then production smoke:

```bash
pkill -f "next dev"; pkill -f "next start"
npx next start -p 3131 & sleep 3
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3131/work/neon-nights-clarke-quay   # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3131/work/does-not-exist            # 404
pkill -f "next start"
```

- [ ] **Step 6: Commit**

```bash
git add "src/app/(portfolio)/work" src/components/portfolio/ProjectDetail.tsx src/components/portfolio/Lightbox.tsx src/components/portfolio/YouTubeEmbed.tsx next.config.ts
git commit -m "feat: per-project pages with photo gallery, lightbox, lazy YouTube embed"
```

---

### Task 4: Hero showreel + cinematic flare

**Files:**
- Modify: `src/components/portfolio/Portfolio.tsx` (hero section, SectionHeader), `src/app/globals.css` (apex block at the end)

**Interfaces:**
- Consumes: nothing new. Optional runtime asset: `public/showreel.mp4` (user supplies later; everything must work without it).
- Produces: nothing downstream.

- [ ] **Step 1: Ken Burns + letterbox CSS**

In `src/app/globals.css`, inside the existing Apex block (after the `html:has([data-apex-root])` rule), add:

```css
@keyframes kenburns {
  0% { transform: scale(1); }
  100% { transform: scale(1.08); }
}
.apex-kenburns { animation: kenburns 24s ease-in-out infinite alternate; }
```

- [ ] **Step 2: Hero — showreel video with graceful poster fallback**

In `Portfolio.tsx`, the `Portfolio` component gains one state line (put it next to the `filter` state):

```ts
  const [showreelOk, setShowreelOk] = useState(true);
```

Replace the hero background block:

```tsx
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-brand-dark/80 to-transparent z-10"></div>
          <div className="absolute inset-0 bg-black/40 z-10"></div>
          <img 
            src="https://images.unsplash.com/photo-1542998966-267597da09f4?q=80&w=2670&auto=format&fit=crop" 
            className="w-full h-full object-cover opacity-80"
            alt="Singapore Cityscape"
          />
        </div>
```

with:

```tsx
        {/* Background: showreel loop with poster fallback (public/showreel.mp4 is
            optional — until it exists, the still + Ken Burns zoom carries the hero) */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-brand-dark/80 to-transparent z-10"></div>
          <div className="absolute inset-0 bg-black/40 z-10"></div>
          <img
            src="https://images.unsplash.com/photo-1542998966-267597da09f4?q=80&w=2670&auto=format&fit=crop"
            className="w-full h-full object-cover opacity-80 apex-kenburns"
            alt="Showreel still"
          />
          {showreelOk && (
            <video
              src="/showreel.mp4"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              onError={() => setShowreelOk(false)}
              className="absolute inset-0 w-full h-full object-cover opacity-80"
            />
          )}
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

(The `<img>` stays beneath the video: it doubles as the poster while the video buffers and the permanent hero if `/showreel.mp4` 404s. Swap the Unsplash URL for the user's own still when they supply one.)

- [ ] **Step 3: Numbered section headers**

Replace the `SectionHeader` component with:

```tsx
const SectionHeader: React.FC<{ title: string; subtitle: string; index?: string }> = ({ title, subtitle, index }) => (
  <div className="mb-16">
    <div className="flex items-center gap-3 mb-2">
      {index && <span className="font-mono text-xs text-neutral-600 tracking-widest">{index}</span>}
      <h3 className="text-brand-orange font-bold uppercase tracking-[0.2em] text-xs">{subtitle}</h3>
    </div>
    <h2 className="text-5xl md:text-7xl font-apex-display font-bold text-white uppercase leading-[0.9]">{title}</h2>
  </div>
);
```

and update the two call sites: `<SectionHeader title="Visual Log" subtitle="Selected Works" index="01" />` and `<SectionHeader title="Capabilities" subtitle="Services" index="02" />`.

- [ ] **Step 4: Verify visually**

Run: `npx tsc --noEmit && npx next build`, then production server + screenshot (desktop 1440×900 and mobile 390×844) with the established Playwright pattern; confirm: letterbox bars top/bottom of hero, REC chip on desktop, slow zoom on the hero still, numbered headers, no console/CSP errors, no horizontal overflow. (In the sandbox, Unsplash/ytimg requests may fail with `ERR_BLOCKED_BY_ORB` — network-level, not CSP; ignore those, they load in real browsers.)

- [ ] **Step 5: Commit**

```bash
git add src/components/portfolio/Portfolio.tsx src/app/globals.css
git commit -m "feat: hero showreel with poster fallback, letterbox + timecode flare"
```

---

### Task 5: Analytics, sitemap, robots

**Files:**
- Create: `src/app/sitemap.ts`, `src/app/robots.ts`
- Modify: `src/app/layout.tsx` (Analytics), `package.json` (dep)

**Interfaces:**
- Consumes: `projectSlugs` from `@/components/portfolio/projects` (Task 1).
- Produces: `/sitemap.xml`, `/robots.txt`, pageview analytics.

- [ ] **Step 1: Install and wire analytics**

```bash
npm install @vercel/analytics
```

In `src/app/layout.tsx`: add `import { Analytics } from "@vercel/analytics/react";` and, inside `<body>`, after `{children}`, add `<Analytics />`.

- [ ] **Step 2: Sitemap + robots**

Create `src/app/sitemap.ts`:

```ts
import type { MetadataRoute } from "next";
import { projectSlugs } from "@/components/portfolio/projects";

const BASE = "https://apexcinematics.tech";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE, changeFrequency: "monthly", priority: 1 },
    ...projectSlugs().map((slug) => ({
      url: `${BASE}/work/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
```

Create `src/app/robots.ts`:

```ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/invoices_login", "/api"] }],
    sitemap: "https://apexcinematics.tech/sitemap.xml",
  };
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm test && npx next build`, then:

```bash
npx next start -p 3131 & sleep 3
curl -s http://localhost:3131/sitemap.xml | head -5     # XML with apexcinematics.tech URLs
curl -s http://localhost:3131/robots.txt                # disallow /invoices_login
pkill -f "next start"
```

- [ ] **Step 4: Commit**

```bash
git add src/app/sitemap.ts src/app/robots.ts src/app/layout.tsx package.json package-lock.json
git commit -m "feat: analytics, sitemap, robots (invoice app disallowed)"
```

---

### Task 6: Full verification + ship

**Files:** none new.

- [ ] **Step 1: Full pass**

Run: `npx tsc --noEmit && npm test && npx next build`. Then production server + the established Playwright verification on `/`, `/work/neon-nights-clarke-quay` (both viewports): zero console errors, zero CSP violations (`ERR_BLOCKED_BY_ORB` on unsplash/ytimg is sandbox-only, ignore), zero `a[href*="invoices_login"]`, no horizontal overflow, screenshots reviewed. Also verify the invoice app still works: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3131/invoices_login` → 200.

- [ ] **Step 2: Grep gates**

```bash
grep -rn "Apex Angles\|apexangles\|Drone\|Sony A7\|coverr" src && echo "FAIL — fix above" || echo OK
grep -rn "invoices_login" src/components/portfolio "src/app/(portfolio)" && echo "FAIL" || echo OK
```

- [ ] **Step 3: Merge + push (with user confirmation)**

Use superpowers:finishing-a-development-branch. On merge choice: merge `feat/portfolio-v2` → `main`, re-run `npm test`, push. Vercel auto-deploys.

- [ ] **Step 4: Post-deploy hand-off (tell the user)**

1. Site is live rebranded; placeholder projects remain until content arrives.
2. To add real work: folder of JPGs → `public/work/<slug>/`, entry in `src/components/portfolio/projects.ts`, YouTube ID for videos. Remove `// PLACEHOLDER` entries as they're replaced.
3. Hero showreel: export a 10–20s montage — 1080p H.264 MP4, no audio track, ~5–8 MB — save as `public/showreel.mp4`, commit. Until then the still carries the hero.
4. Supply one portrait for the About section and one hero still to replace the Unsplash city shot.
5. When the last placeholder is gone, remove `images.unsplash.com` from the CSP `img-src` and from `images.remotePatterns` in `next.config.ts`.
