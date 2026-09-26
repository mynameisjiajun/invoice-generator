// ── The single source of truth for portfolio content. ──
// ADD / REMOVE / REORDER PHOTOS in a project:
//   Just add or delete image files in public/work/<slug>/ — every JPG/PNG/WebP
//   in the folder shows up automatically, in file-name order (01, 02, … 10).
//   The first photo is the cover unless `cover` is set.
// TO ADD A PROJECT:
//   1. Make a folder public/work/<slug>/ and drop the photos in
//      (slug = lowercase-with-dashes, e.g. public/work/my-wedding/).
//   2. Copy an entry below and set photos: folderPhotos("<slug>", "<alt text>").
//   3. Video projects: upload to YouTube (unlisted is fine), set youtubeId
//      to the 11-char ID from the URL. Photo projects: omit youtubeId.
// REORDER PROJECTS: move entries up/down — the top one shows first.
// Tags are what/where only ("Wedding · Sentosa") — never camera/lens/gear.

import workPhotos from "./work-photos.json";

export type ProjectType = "video" | "photo";

export type ProjectPhoto = { src: string; alt: string; caption?: string };

export type Project = {
  slug: string;
  title: string;
  type: ProjectType;
  cover?: string;
  story: string;
  tags: string[];
  youtubeId?: string;
  instagramUrl?: string;
  photos: ProjectPhoto[];
};

// The photo in the "Studio" section on the home page.
export const ABOUT_PHOTO = "/work/ggs-iceland.jpg";

// Every image in public/work/<slug>/ (see scripts/scan-work-photos.mjs).
function folderPhotos(slug: string, altPrefix: string): ProjectPhoto[] {
  const files: string[] = (workPhotos as Record<string, string[]>)[slug] ?? [];
  return files.map((src, i) => ({ src, alt: `${altPrefix} — photo ${i + 1}` }));
}

const ENTRIES: Project[] = [
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
    story:
      "Brand shoot for Chroma Car Care — paintwork gloss, product details, and the finishing touches that sell the shine.",
    tags: ["Brand", "Automotive"],
    photos: folderPhotos("chroma-car-care", "Chroma Car Care shoot"),
  },
  {
    slug: "floraisons-pr-event",
    title: "Floraisons.Co PR Event",
    type: "photo",
    story:
      "Event coverage for Floraisons.Co's PR launch — the florals, the guests, and the in-between moments that made the room feel alive.",
    tags: ["Event", "PR Launch"],
    photos: folderPhotos("floraisons-pr-event", "Floraisons.Co PR event"),
  },
  {
    slug: "school-orientation-shoot",
    title: "School Orientation Shoot",
    type: "photo",
    story:
      "Editorial studio portraits for a school orientation batch — colored gel lighting and a playful, uniform-inspired styling.",
    tags: ["Editorial", "Studio"],
    photos: folderPhotos("school-orientation-shoot", "School Orientation Shoot"),
  },
  {
    slug: "design-your-dream-future",
    title: "Design Your Dream Future",
    type: "video",
    cover: "https://i.ytimg.com/vi/ND4Ct0ticVE/maxresdefault.jpg",
    story:
      "Event coverage for a panel and workshop session on designing your future — the conversation, the crowd, and the moments in between.",
    tags: ["Event", "Panel"],
    youtubeId: "ND4Ct0ticVE",
    instagramUrl: "https://www.instagram.com/reel/DV7jBB1EjIj/",
    photos: [],
  },
];

// A photo project's cover falls back to its first photo.
export const PROJECTS: Project[] = ENTRIES.map((p) => ({ ...p, cover: p.cover ?? p.photos[0]?.src }));

export function getProject(slug: string): Project | undefined {
  return PROJECTS.find((p) => p.slug === slug);
}

export function projectSlugs(): string[] {
  return PROJECTS.map((p) => p.slug);
}
