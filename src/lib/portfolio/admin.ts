// Browser-side portfolio editing for /invoices_login/portfolio. Talks to
// Supabase directly as the logged-in owner; RLS (017_portfolio.sql) is what
// actually stops anyone else. Callers run refreshPublicSite() after changes.
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/slug";
import { prepareUpload } from "@/lib/portfolio/resize";
import { LEGACY_ABOUT_PHOTO, LEGACY_PROJECTS } from "@/components/portfolio/legacy-projects";
import { PORTFOLIO_BUCKET, type PhotoRow, type ProjectRow, type ProjectType } from "@/components/portfolio/projects";

const db = () => createClient();

function ok<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/** Storage paths are ours; full URLs and "/work/…" legacy paths are not. */
const isStoragePath = (ref: string | null | undefined): ref is string =>
  !!ref && !/^https?:\/\//.test(ref) && !ref.startsWith("/");

async function removeObjects(paths: string[]): Promise<void> {
  const mine = paths.filter(isStoragePath);
  if (mine.length === 0) return;
  // Best effort: a leftover file costs a few KB; failing the delete over it
  // would leave the UI and database out of step.
  const { error } = await db().storage.from(PORTFOLIO_BUCKET).remove(mine);
  if (error) console.warn("portfolio: couldn't remove files", error.message);
}

async function uploadBlob(folder: string, blob: Blob): Promise<string> {
  const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db().storage.from(PORTFOLIO_BUCKET)
    .upload(path, blob, { contentType: blob.type || "image/jpeg", cacheControl: "31536000" });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}

// ── Projects ──

export async function listProjects(): Promise<ProjectRow[]> {
  return ok(await db().from("portfolio_projects").select("*").order("position"));
}

export async function countPhotos(): Promise<Record<string, number>> {
  const rows = ok(await db().from("portfolio_photos").select("project_id")) as { project_id: string }[];
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.project_id] = (counts[r.project_id] ?? 0) + 1;
  return counts;
}

export async function getProjectRow(id: string): Promise<ProjectRow> {
  return ok(await db().from("portfolio_projects").select("*").eq("id", id).single());
}

/** A slug not used by any other project: "my-shoot", then "my-shoot-2", … */
export function uniqueSlug(title: string, taken: Iterable<string>): string {
  const base = slugify(title) || "project";
  const set = new Set(taken);
  let slug = base;
  for (let n = 2; set.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

export async function createProject(title: string, type: ProjectType): Promise<ProjectRow> {
  const existing = await listProjects();
  const slug = uniqueSlug(title, existing.map((p) => p.slug));
  // New projects go to the top of the site; everything else shifts down one.
  const res = ok(await db().from("portfolio_projects")
    .insert({ title: title.trim(), type, slug, position: -1, published: false })
    .select().single()) as ProjectRow;
  await saveProjectOrder([res.id, ...existing.map((p) => p.id)]);
  return { ...res, position: 0 };
}

export async function updateProject(id: string, patch: Partial<Omit<ProjectRow, "id">>): Promise<void> {
  const res = await db().from("portfolio_projects").update(patch).eq("id", id).select().single();
  if (res.error?.code === "23505") throw new Error("Another project already uses that web address");
  ok(res);
}

export async function deleteProject(project: ProjectRow): Promise<void> {
  const photos = await listPhotos(project.id);
  ok(await db().from("portfolio_projects").delete().eq("id", project.id).select());
  await removeObjects([...photos.map((p) => p.path), ...(project.cover ? [project.cover] : [])]);
}

export async function saveProjectOrder(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id, position) =>
    db().from("portfolio_projects").update({ position }).eq("id", id).then(ok)));
}

// ── Photos ──

export async function listPhotos(projectId: string): Promise<PhotoRow[]> {
  return ok(await db().from("portfolio_photos").select("*").eq("project_id", projectId).order("position"));
}

/** Uploads one at a time (keeps phone memory and bandwidth sane), appending
 *  to the end of the gallery. Reports progress; stops at the first failure
 *  with the photos before it kept. */
export async function uploadPhotos(
  project: ProjectRow,
  files: File[],
  startPosition: number,
  onProgress?: (done: number, total: number) => void,
): Promise<PhotoRow[]> {
  const added: PhotoRow[] = [];
  for (let i = 0; i < files.length; i++) {
    onProgress?.(i, files.length);
    const path = await uploadBlob(project.id, await prepareUpload(files[i]));
    const row = ok(await db().from("portfolio_photos")
      .insert({ project_id: project.id, path, alt: "", position: startPosition + i })
      .select().single()) as PhotoRow;
    added.push(row);
  }
  onProgress?.(files.length, files.length);
  return added;
}

export async function deletePhoto(photo: PhotoRow, project: ProjectRow): Promise<void> {
  ok(await db().from("portfolio_photos").delete().eq("id", photo.id).select());
  if (project.cover === photo.path) await updateProject(project.id, { cover: null });
  await removeObjects([photo.path]);
}

export async function savePhotoOrder(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id, position) =>
    db().from("portfolio_photos").update({ position }).eq("id", id).then(ok)));
}

// ── Site-wide ──

export async function getAboutPhoto(): Promise<string | null> {
  const rows = ok(await db().from("portfolio_site").select("about_photo").eq("id", 1)) as { about_photo: string | null }[];
  return rows[0]?.about_photo ?? null;
}

export async function setAboutPhoto(file: File): Promise<string> {
  const previous = await getAboutPhoto();
  const path = await uploadBlob("site", await prepareUpload(file));
  ok(await db().from("portfolio_site").update({ about_photo: path }).eq("id", 1).select().single());
  if (previous && previous !== path) await removeObjects([previous]);
  return path;
}

// ── One-time import of the old file-based portfolio ──

async function fetchAsBlob(src: string): Promise<Blob> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Couldn't load ${src} (${res.status})`);
  return res.blob();
}

/** Copies LEGACY_PROJECTS (photos served from public/work/) into Supabase.
 *  Safe to re-run: projects whose slug already exists are skipped, so an
 *  interrupted import can simply be started again. */
export async function importLegacyPortfolio(onProgress?: (label: string) => void): Promise<void> {
  const existing = await listProjects();
  const taken = new Set(existing.map((p) => p.slug));
  const offset = existing.length;

  for (let i = 0; i < LEGACY_PROJECTS.length; i++) {
    const lp = LEGACY_PROJECTS[i];
    if (taken.has(lp.slug)) continue;
    onProgress?.(`${lp.title}…`);
    const coverIsExternal = !!lp.cover && /^https?:\/\//.test(lp.cover);
    const project = ok(await db().from("portfolio_projects").insert({
      slug: lp.slug, title: lp.title, type: lp.type, story: lp.story, tags: lp.tags,
      youtube_id: lp.youtubeId ?? null, instagram_url: lp.instagramUrl ?? null,
      cover: coverIsExternal ? lp.cover : null,
      position: offset + i, published: false,
    }).select().single()) as ProjectRow;

    for (let j = 0; j < lp.photos.length; j++) {
      onProgress?.(`${lp.title} — photo ${j + 1} of ${lp.photos.length}`);
      const path = await uploadBlob(project.id, await fetchAsBlob(lp.photos[j].src));
      ok(await db().from("portfolio_photos")
        .insert({ project_id: project.id, path, alt: lp.photos[j].alt, position: j }).select());
    }
    // Publish only once every photo is in, so the site never shows a half-copied gallery.
    await updateProject(project.id, { published: true });
  }

  if (!(await getAboutPhoto())) {
    onProgress?.("Studio photo…");
    const path = await uploadBlob("site", await fetchAsBlob(LEGACY_ABOUT_PHOTO));
    ok(await db().from("portfolio_site").update({ about_photo: path }).eq("id", 1).select().single());
  }
}
