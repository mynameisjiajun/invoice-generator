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
