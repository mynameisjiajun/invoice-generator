"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  countPhotos, createProject, getAboutPhoto, importLegacyPortfolio, listPhotos, listProjects,
  saveProjectOrder, setAboutPhoto,
} from "@/lib/portfolio/admin";
import { LEGACY_PROJECTS } from "@/components/portfolio/legacy-projects";
import { photoUrl, youTubeThumbnail, type ProjectRow, type ProjectType } from "@/components/portfolio/projects";
import { Thumb, TypePicker } from "./ui";
import { IconAdd, IconCheck, IconChevron, IconExternal } from "@/components/icons";
import { refreshPublicSite } from "./actions";

const LEGACY_PHOTO_COUNT = LEGACY_PROJECTS.reduce((n, p) => n + p.photos.length, 0);

type Loaded = {
  rows: ProjectRow[];
  counts: Record<string, number>;
  about: string | null;
  covers: Record<string, string | undefined>;
};

async function fetchAll(): Promise<Loaded> {
  const [rows, counts, about] = await Promise.all([listProjects(), countPhotos(), getAboutPhoto()]);
  // Thumbnail = explicit cover, else first photo, else YouTube thumbnail.
  const entries = await Promise.all(rows.map(async (p) => {
    if (p.cover) return [p.id, photoUrl(p.cover)] as const;
    const first = (counts[p.id] ?? 0) > 0 ? (await listPhotos(p.id))[0] : undefined;
    if (first) return [p.id, photoUrl(first.path)] as const;
    return [p.id, p.youtube_id ? youTubeThumbnail(p.youtube_id) : undefined] as const;
  }));
  return { rows, counts, about, covers: Object.fromEntries(entries) };
}

export default function PortfolioAdminPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [covers, setCovers] = useState<Record<string, string | undefined>>({});
  const [about, setAbout] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<ProjectType>("photo");
  const aboutInput = useRef<HTMLInputElement | null>(null);

  function apply(data: Loaded) {
    setProjects(data.rows);
    setCounts(data.counts);
    setAbout(data.about);
    setCovers(data.covers);
  }
  const onLoadError = (e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load your portfolio");
  const load = () => fetchAll().then(apply).catch(onLoadError);

  useEffect(() => { fetchAll().then(apply).catch(onLoadError); }, []);

  async function publish() {
    try { await refreshPublicSite(); } catch { /* the edit itself saved; the hourly refresh will catch up */ }
  }

  async function move(index: number, delta: -1 | 1) {
    if (!projects) return;
    const next = [...projects];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    setProjects(next);
    setError(null);
    try {
      await saveProjectOrder(next.map((p) => p.id));
      await publish();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the new order");
      load();
    }
  }

  async function onCreate() {
    if (!newTitle.trim()) { setError("Give the project a title"); return; }
    setBusy(true);
    setError(null);
    try {
      const p = await createProject(newTitle, newType);
      router.push(`/invoices_login/portfolio/${p.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the project");
      setBusy(false);
    }
  }

  async function onImport() {
    setBusy(true);
    setError(null);
    try {
      await importLegacyPortfolio(setImportStatus);
      await publish();
      await load();
    } catch (e) {
      setError(`${e instanceof Error ? e.message : "Import failed"} — tap Import again to pick up where it stopped.`);
    }
    setImportStatus(null);
    setBusy(false);
  }

  async function onAboutFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setAbout(await setAboutPhoto(file));
      await publish();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload that photo");
    }
    setBusy(false);
  }

  if (!projects) {
    return (
      <div className="page-container">
        {error ? <p style={{ color: "var(--warning)" }}>{error}</p> : (
          <>
            <div className="skeleton" style={{ height: 36, width: "40%", marginBottom: 10 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
              {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 84 }} />)}
            </div>
          </>
        )}
      </div>
    );
  }

  const importedAll = LEGACY_PROJECTS.every((lp) => projects.some((p) => p.slug === lp.slug));

  return (
    <main className="page-container animate-fade-in">
      <h1 className="page-title">Website</h1>
      <p className="page-subtitle">
        What visitors see at{" "}
        <a href="/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
          apexcinematics.tech <IconExternal size={12} />
        </a>
        . Changes go live as soon as you save.
      </p>

      {error && (
        <div style={{
          background: "var(--warning-bg)", color: "var(--warning)", padding: "10px 14px",
          borderRadius: "var(--radius-sm)", fontSize: "0.85rem", fontWeight: 600, marginBottom: 16,
        }}>{error}</div>
      )}

      {!importedAll && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-label">Bring over your current site</div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: 12 }}>
            Copies the {LEGACY_PROJECTS.length} projects and {LEGACY_PHOTO_COUNT} photos already on your
            website into here so you can edit them. Until then the site keeps showing them as-is.
          </p>
          <button onClick={onImport} disabled={busy} className="btn btn-primary" style={{ width: "100%" }}>
            {importStatus ? `Importing ${importStatus}` : "Import current website"}
          </button>
        </div>
      )}

      {adding ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-label">New project</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label className="input-label">Title</label>
              <input className="input" autoFocus value={newTitle} placeholder="e.g. Sarah & Ming's Wedding"
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onCreate()} />
            </div>
            <TypePicker value={newType} onChange={setNewType} />
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button onClick={() => { setAdding(false); setNewTitle(""); setError(null); }}
                disabled={busy} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={onCreate} disabled={busy} className="btn btn-primary icon-btn" style={{ flex: 1 }}>
                <IconCheck size={15} /> {busy ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => { setAdding(true); setError(null); }}
          className="btn btn-secondary icon-btn" style={{ marginBottom: 16 }}>
          <IconAdd size={15} /> New project
        </button>
      )}

      <div className="section-label">Projects — top shows first</div>
      {projects.length === 0 && (
        <p style={{ color: "var(--text-tertiary)", marginBottom: 16 }}>No projects yet.</p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
        {projects.map((p, i) => (
          <div key={p.id} className="card" style={{ display: "flex", alignItems: "center", gap: 12, padding: 10 }}>
            <Link href={`/invoices_login/portfolio/${p.id}`}
              style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, textDecoration: "none", color: "inherit" }}>
              <Thumb src={covers[p.id]} alt={p.title} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                <div style={{ color: "var(--text-tertiary)", fontSize: "0.78rem", marginTop: 2 }}>
                  {p.type === "video" ? "Video" : "Photo"} · {counts[p.id] ?? 0} photo{(counts[p.id] ?? 0) === 1 ? "" : "s"}
                  {!p.published && <span className="badge badge-draft" style={{ marginLeft: 8 }}>Hidden</span>}
                </div>
              </div>
            </Link>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
              <button className="btn-ghost icon-btn" aria-label={`Move ${p.title} up`}
                disabled={i === 0} onClick={() => move(i, -1)}><IconChevron dir="up" /></button>
              <button className="btn-ghost icon-btn" aria-label={`Move ${p.title} down`}
                disabled={i === projects.length - 1} onClick={() => move(i, 1)}><IconChevron dir="down" /></button>
            </div>
          </div>
        ))}
      </div>

      <div className="section-label">Studio section photo</div>
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, marginBottom: 24 }}>
        <Thumb src={about ? photoUrl(about) : undefined} alt="Studio section photo" tall />
        <div style={{ flex: 1, color: "var(--text-secondary)", fontSize: "0.85rem" }}>
          The tall photo beside “Based in Singapore”.
        </div>
        <input ref={aboutInput} type="file" accept="image/*" hidden
          onChange={(e) => { onAboutFile(e.target.files?.[0]); e.target.value = ""; }} />
        <button className="btn btn-secondary" disabled={busy} onClick={() => aboutInput.current?.click()}>Change</button>
      </div>
    </main>
  );
}
