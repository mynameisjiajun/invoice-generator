// Server-side reads for the public portfolio. Plain fetches to PostgREST with
// the anon key (RLS only exposes published projects), cached under the
// "portfolio" tag: pages are served from cache and rebuilt when the admin
// page saves (refreshPublicSite → updateTag) or hourly as a backstop. If
// Supabase is unreachable during a rebuild, Next keeps serving the last good
// page instead of an error.
import { cache } from "react";
import { LEGACY_ABOUT_PHOTO, LEGACY_PROJECTS } from "@/components/portfolio/legacy-projects";
import { photoUrl, rowsToProjects, type PhotoRow, type Project, type ProjectRow } from "@/components/portfolio/projects";

export const PORTFOLIO_TAG = "portfolio";

async function rest<T>(query: string): Promise<T> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  const res = await fetch(`${url}/rest/v1/${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    next: { tags: [PORTFOLIO_TAG], revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status} for ${query.split("?")[0]}`);
  return res.json() as Promise<T>;
}

export type PortfolioContent = { projects: Project[]; aboutPhoto: string };

export const getPortfolio = cache(async (): Promise<PortfolioContent> => {
  try {
    const [projects, photos, site] = await Promise.all([
      rest<ProjectRow[]>("portfolio_projects?select=*&published=eq.true&order=position"),
      rest<PhotoRow[]>("portfolio_photos?select=id,project_id,path,alt,position&order=position"),
      rest<{ about_photo: string | null }[]>("portfolio_site?select=about_photo&id=eq.1"),
    ]);
    const about = site[0]?.about_photo;
    return {
      // Until the first import/project exists, keep showing the old portfolio.
      projects: projects.length > 0 ? rowsToProjects(projects, photos) : LEGACY_PROJECTS,
      aboutPhoto: about ? photoUrl(about) : LEGACY_ABOUT_PHOTO,
    };
  } catch (e) {
    console.error("portfolio: falling back to built-in projects:", e);
    return { projects: LEGACY_PROJECTS, aboutPhoto: LEGACY_ABOUT_PHOTO };
  }
});

export async function getProject(slug: string): Promise<Project | undefined> {
  return (await getPortfolio()).projects.find((p) => p.slug === slug);
}
