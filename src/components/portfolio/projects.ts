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
  {
    slug: "annexe-project-farewell",
    title: "ANNEXE Project Farewell Video",
    type: "video",
    cover: "https://i.ytimg.com/vi/bZzUS_2kVQQ/maxresdefault.jpg",
    story:
      "A farewell tribute film for the ANNEXE project — the people, the memories, and the moments worth holding onto.",
    tags: ["Documentary"],
    youtubeId: "bZzUS_2kVQQ",
    photos: [],
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
    photos: [],
  },
  {
    slug: "ig-reel-intro",
    title: "IG Reel Intro",
    type: "video",
    cover: "https://i.ytimg.com/vi/_fZ2r1al3WU/maxresdefault.jpg",
    story: "A vertical intro reel built to stop the scroll and introduce the story in seconds.",
    tags: ["Social Media", "Reel"],
    youtubeId: "_fZ2r1al3WU",
    photos: [],
  },
  {
    slug: "ig-reel-cooking",
    title: "IG Reel Cooking",
    type: "video",
    cover: "https://i.ytimg.com/vi/KgygKRnWNH0/maxresdefault.jpg",
    story: "A quick, punchy cooking reel — shot and cut for the platform, ready to post.",
    tags: ["Social Media", "Reel"],
    youtubeId: "KgygKRnWNH0",
    photos: [],
  },
  {
    slug: "new-zealand-holiday-shoot",
    title: "New Zealand Holiday Shoot",
    type: "video",
    cover: "https://i.ytimg.com/vi/mo3QcXb-XAw/maxresdefault.jpg",
    story: "A travel documentary following a road trip through New Zealand with friends.",
    tags: ["Travel", "New Zealand"],
    youtubeId: "mo3QcXb-XAw",
    photos: [],
  },
];

export function getProject(slug: string): Project | undefined {
  return PROJECTS.find((p) => p.slug === slug);
}

export function projectSlugs(): string[] {
  return PROJECTS.map((p) => p.slug);
}
