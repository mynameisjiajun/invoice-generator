// Portfolio content types plus the pure helpers shared by the public site
// (src/lib/portfolio/data.ts) and the admin page (/invoices_login/portfolio).
// Content itself lives in Supabase: tables portfolio_projects,
// portfolio_photos and portfolio_site, images in the `portfolio` bucket
// (see supabase/migrations/017_portfolio.sql).
// Tags are what/where only ("Wedding · Sentosa") — never camera/lens/gear.

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

export type ProjectRow = {
  id: string;
  slug: string;
  title: string;
  type: ProjectType;
  story: string;
  tags: string[];
  youtube_id: string | null;
  instagram_url: string | null;
  cover: string | null;
  position: number;
  published: boolean;
};

export type PhotoRow = {
  id: string;
  project_id: string;
  path: string;
  alt: string;
  position: number;
};

export const PORTFOLIO_BUCKET = "portfolio";

/** A stored image reference → something an <img>/<Image> can load. Rows hold
 *  either a Storage object path ("chroma-car-care/abc.jpg"), a full URL
 *  (YouTube thumbnails), or a site-relative path ("/work/…", legacy files). */
export function photoUrl(ref: string, supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""): string {
  if (/^https?:\/\//.test(ref) || ref.startsWith("/")) return ref;
  const encoded = ref.split("/").map(encodeURIComponent).join("/");
  return `${supabaseUrl}/storage/v1/object/public/${PORTFOLIO_BUCKET}/${encoded}`;
}

/** Accepts a bare 11-char YouTube ID or any common YouTube URL form. */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|[?&]v=|\/(?:embed|shorts|live)\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function youTubeThumbnail(id: string): string {
  return `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
}

/** Rows (any order) → public Projects, sorted by position. Cover falls back
 *  to the first photo, then the YouTube thumbnail. */
export function rowsToProjects(projects: ProjectRow[], photos: PhotoRow[], supabaseUrl?: string): Project[] {
  const byProject = new Map<string, PhotoRow[]>();
  for (const ph of photos) {
    const list = byProject.get(ph.project_id) ?? [];
    list.push(ph);
    byProject.set(ph.project_id, list);
  }
  return [...projects]
    .sort((a, b) => a.position - b.position)
    .map((p) => {
      const gallery = (byProject.get(p.id) ?? [])
        .sort((a, b) => a.position - b.position)
        .map((ph, i) => ({ src: photoUrl(ph.path, supabaseUrl), alt: ph.alt || `${p.title} — photo ${i + 1}` }));
      const cover = p.cover
        ? photoUrl(p.cover, supabaseUrl)
        : gallery[0]?.src ?? (p.youtube_id ? youTubeThumbnail(p.youtube_id) : undefined);
      return {
        slug: p.slug,
        title: p.title,
        type: p.type,
        cover,
        story: p.story,
        tags: p.tags,
        youtubeId: p.youtube_id ?? undefined,
        instagramUrl: p.instagram_url ?? undefined,
        photos: gallery,
      };
    });
}
