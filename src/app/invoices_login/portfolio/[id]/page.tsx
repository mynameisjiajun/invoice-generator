"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  deletePhoto, deleteProject, getProjectRow, listPhotos, savePhotoOrder, updateProject, uploadPhotos,
} from "@/lib/portfolio/admin";
import { parseYouTubeId, photoUrl, type PhotoRow, type ProjectRow } from "@/components/portfolio/projects";
import { slugify } from "@/lib/slug";
import { IconCheck, IconChevron, IconExternal, IconStar, IconTrash } from "@/components/icons";
import ConfirmSheet from "@/components/ConfirmSheet";
import { refreshPublicSite } from "../actions";
import { DropOverlay, PhotoDropZone, TypePicker, splitImages, useWindowFileDrag } from "../ui";

type Draft = {
  title: string; type: ProjectRow["type"]; story: string; tags: string;
  youtube: string; instagram: string; slug: string;
};

const draftFrom = (p: ProjectRow): Draft => ({
  title: p.title, type: p.type, story: p.story, tags: p.tags.join(", "),
  youtube: p.youtube_id ? `https://youtu.be/${p.youtube_id}` : "", instagram: p.instagram_url ?? "", slug: p.slug,
});

export default function ProjectEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [pendingDeletePhoto, setPendingDeletePhoto] = useState<PhotoRow | null>(null);
  const [pendingDeleteProject, setPendingDeleteProject] = useState(false);

  useEffect(() => {
    Promise.all([getProjectRow(id), listPhotos(id)])
      .then(([p, ph]) => { setProject(p); setDraft(draftFrom(p)); setPhotos(ph); })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load this project"));
  }, [id]);

  async function publish() {
    try { await refreshPublicSite(); } catch { /* saved anyway; hourly refresh catches up */ }
  }

  async function run(fn: () => Promise<void>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await publish();
    } catch (e) {
      setError(e instanceof Error ? e.message : fallback);
    }
    setBusy(false);
  }

  // Picked, dropped on the zone, or dropped anywhere on the page.
  function onFiles(list: FileList) {
    if (!project || busy) return;
    const { images, skipped } = splitImages(list);
    const note = skipped.length ? `Skipped ${skipped.length === 1 ? skipped[0] : `${skipped.length} files`} (not a photo).` : null;
    if (images.length === 0) { setError(note ?? "No photos to upload"); return; }
    const target = project;
    const start = photos.length ? Math.max(...photos.map((x) => x.position)) + 1 : 0;
    run(async () => {
      try {
        const added = await uploadPhotos(target, images, start, (done, total) =>
          setUploadStatus(done < total ? `Uploading ${done + 1} of ${total}…` : null));
        setPhotos((cur) => [...cur, ...added]);
        if (note) setError(note);
      } catch (e) {
        // Keep whatever made it in before the failure.
        setPhotos(await listPhotos(target.id));
        throw e;
      } finally {
        setUploadStatus(null);
      }
    }, "Upload failed");
  }
  const draggingFiles = useWindowFileDrag(onFiles, !!project && !busy);

  if (!project || !draft) {
    return (
      <div className="page-container">
        {error ? <p style={{ color: "var(--warning)" }}>{error}</p> : (
          <>
            <div className="skeleton" style={{ height: 36, width: "60%", marginBottom: 20 }} />
            <div className="skeleton" style={{ height: 260 }} />
          </>
        )}
      </div>
    );
  }
  const p = project;
  const d = draft;
  const set = (patch: Partial<Draft>) => { setDraft({ ...d, ...patch }); setSaved(false); };

  function onSave() {
    const title = d.title.trim();
    if (!title) { setError("Title can't be empty"); return; }
    const youtubeId = d.youtube.trim() ? parseYouTubeId(d.youtube) : null;
    if (d.youtube.trim() && !youtubeId) { setError("That doesn't look like a YouTube link"); return; }
    const instagram = d.instagram.trim();
    if (instagram && !/^https:\/\/(www\.)?instagram\.com\//.test(instagram)) {
      setError("Instagram link should start with https://www.instagram.com/"); return;
    }
    const slug = slugify(d.slug) || slugify(title);
    if (!slug) { setError("Web address can't be empty"); return; }
    const patch = {
      title, type: d.type, story: d.story.trim(), slug,
      tags: d.tags.split(",").map((t) => t.trim()).filter(Boolean),
      youtube_id: youtubeId, instagram_url: instagram || null,
    };
    run(async () => {
      await updateProject(p.id, patch);
      const next = { ...p, ...patch };
      setProject(next);
      setDraft(draftFrom(next));
      setSaved(true);
    }, "Couldn't save");
  }

  function togglePublished() {
    if (!p.published && p.type === "photo" && photos.length === 0) {
      setError("Add at least one photo before showing this on the website"); return;
    }
    run(async () => {
      await updateProject(p.id, { published: !p.published });
      setProject({ ...p, published: !p.published });
    }, "Couldn't change visibility");
  }

  function movePhoto(index: number, delta: -1 | 1) {
    const next = [...photos];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    setPhotos(next);
    run(() => savePhotoOrder(next.map((x) => x.id)), "Couldn't save the new order");
  }

  function makeCover(photo: PhotoRow) {
    const cover = p.cover === photo.path ? null : photo.path;
    run(async () => {
      await updateProject(p.id, { cover });
      setProject({ ...p, cover });
    }, "Couldn't set the cover");
  }

  function confirmDeletePhoto() {
    const photo = pendingDeletePhoto;
    setPendingDeletePhoto(null);
    if (!photo) return;
    run(async () => {
      await deletePhoto(photo, p);
      setPhotos((cur) => cur.filter((x) => x.id !== photo.id));
      if (p.cover === photo.path) setProject({ ...p, cover: null });
    }, "Couldn't delete the photo");
  }

  function confirmDeleteProject() {
    setPendingDeleteProject(false);
    run(async () => {
      await deleteProject(p);
      router.push("/invoices_login/portfolio");
    }, "Couldn't delete the project");
  }

  // The cover used on the site: explicit, else the first photo.
  const coverPath = p.cover ?? photos[0]?.path;

  return (
    <main className="page-container animate-fade-in">
      <Link href="/invoices_login/portfolio" className="btn-ghost icon-btn" style={{ marginBottom: 8, paddingLeft: 0 }}>
        <IconChevron dir="left" /> All projects
      </Link>
      <h1 className="page-title" style={{ overflowWrap: "anywhere" }}>{p.title}</h1>

      {error && (
        <div style={{
          background: "var(--warning-bg)", color: "var(--warning)", padding: "10px 14px",
          borderRadius: "var(--radius-sm)", fontSize: "0.85rem", fontWeight: 600, marginBottom: 16,
        }}>{error}</div>
      )}

      {/* Visibility */}
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>{p.published ? "Showing on website" : "Hidden from website"}</div>
          <div style={{ color: "var(--text-tertiary)", fontSize: "0.78rem", marginTop: 2 }}>
            {p.published ? (
              <a href={`/work/${p.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
                View page <IconExternal size={11} />
              </a>
            ) : "Only you can see it here"}
          </div>
        </div>
        <button onClick={togglePublished} disabled={busy}
          className={`btn ${p.published ? "btn-secondary" : "btn-primary"}`}>
          {p.published ? "Hide" : "Show on website"}
        </button>
      </div>

      {/* Photos */}
      <div className="section-label">Photos ({photos.length})</div>
      <p style={{ color: "var(--text-tertiary)", fontSize: "0.78rem", marginBottom: 10 }}>
        Drag photos in to upload. Tap ★ to choose the cover (otherwise it&apos;s the first photo). Arrows change the order.
      </p>
      <PhotoDropZone onFiles={onFiles} disabled={busy} status={uploadStatus} highlight={draggingFiles} />
      {draggingFiles && <DropOverlay label={`Drop to add to “${p.title}”`} />}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginBottom: 28 }}>
        {photos.map((ph, i) => {
          const isCover = coverPath === ph.path;
          return (
            <div key={ph.id} style={{
              position: "relative", aspectRatio: "1", borderRadius: "var(--radius-sm)", overflow: "hidden",
              background: "var(--bg-surface-hover)", outline: isCover ? "3px solid var(--accent)" : undefined,
            }}>
              <Image src={photoUrl(ph.path)} alt={ph.alt || `Photo ${i + 1}`} fill sizes="(max-width: 560px) 50vw, 180px" style={{ objectFit: "cover" }} />
              <div style={{
                position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", justifyContent: "space-between",
                padding: 4, background: "linear-gradient(transparent, rgba(0,0,0,0.65))",
              }}>
                <PhotoBtn label="Move earlier" disabled={busy || i === 0} onClick={() => movePhoto(i, -1)}>
                  <IconChevron dir="left" size={15} />
                </PhotoBtn>
                <PhotoBtn label={isCover && p.cover ? "Unset cover" : "Make cover"} disabled={busy} onClick={() => makeCover(ph)}>
                  <IconStar size={15} filled={isCover} />
                </PhotoBtn>
                <PhotoBtn label="Delete photo" disabled={busy} onClick={() => setPendingDeletePhoto(ph)}>
                  <IconTrash size={15} />
                </PhotoBtn>
                <PhotoBtn label="Move later" disabled={busy || i === photos.length - 1} onClick={() => movePhoto(i, 1)}>
                  <IconChevron dir="right" size={15} />
                </PhotoBtn>
              </div>
            </div>
          );
        })}
      </div>

      {/* Details */}
      <div className="section-label">Details</div>
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        <div>
          <label className="input-label">Title</label>
          <input className="input" value={d.title} onChange={(e) => set({ title: e.target.value })} />
        </div>
        <TypePicker value={d.type} onChange={(type) => set({ type })} />
        <div>
          <label className="input-label">Description</label>
          <textarea className="input" rows={4} value={d.story} onChange={(e) => set({ story: e.target.value })}
            placeholder="A line or two about the shoot" />
        </div>
        <div>
          <label className="input-label">Tags (comma separated)</label>
          <input className="input" value={d.tags} onChange={(e) => set({ tags: e.target.value })}
            placeholder="Wedding, Sentosa" />
        </div>
        <div>
          <label className="input-label">YouTube link (optional)</label>
          <input className="input" inputMode="url" value={d.youtube} onChange={(e) => set({ youtube: e.target.value })}
            placeholder="https://youtu.be/…" />
        </div>
        <div>
          <label className="input-label">Instagram link (optional)</label>
          <input className="input" inputMode="url" value={d.instagram} onChange={(e) => set({ instagram: e.target.value })}
            placeholder="https://www.instagram.com/reel/…" />
        </div>
        <div>
          <label className="input-label">Web address</label>
          <input className="input" value={d.slug} onChange={(e) => set({ slug: e.target.value })} />
          <p style={{ color: "var(--text-tertiary)", fontSize: "0.75rem", marginTop: 4 }}>
            apexcinematics.tech/work/{slugify(d.slug) || slugify(d.title)} — changing it breaks old links to this project.
          </p>
        </div>
        <button onClick={onSave} disabled={busy} className="btn btn-primary icon-btn">
          <IconCheck size={15} /> {busy ? "Saving…" : saved ? "Saved" : "Save details"}
        </button>
      </div>

      <button onClick={() => setPendingDeleteProject(true)} disabled={busy}
        className="btn-danger icon-btn" style={{ marginBottom: 24 }}>
        <IconTrash size={14} /> Delete project
      </button>

      <ConfirmSheet
        open={pendingDeletePhoto !== null}
        danger
        title="Delete this photo?"
        message="It's removed from the website straight away. This can't be undone."
        confirmLabel="Delete"
        onConfirm={confirmDeletePhoto}
        onCancel={() => setPendingDeletePhoto(null)}
      />
      <ConfirmSheet
        open={pendingDeleteProject}
        danger
        title={`Delete “${p.title}”?`}
        message={`The project and its ${photos.length} photo${photos.length === 1 ? "" : "s"} are removed from the website. This can't be undone — use Hide instead if you might want it back.`}
        confirmLabel="Delete project"
        onConfirm={confirmDeleteProject}
        onCancel={() => setPendingDeleteProject(false)}
      />
    </main>
  );
}

function PhotoBtn({ label, disabled, onClick, children }: {
  label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}
      style={{
        width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center",
        border: "none", borderRadius: 8, background: "rgba(0,0,0,0.35)", color: "#fff",
        opacity: disabled ? 0.35 : 1, cursor: disabled ? "default" : "pointer",
      }}>
      {children}
    </button>
  );
}
