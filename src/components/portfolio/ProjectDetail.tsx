"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Instagram } from "lucide-react";
import type { Project } from "./projects";
import { projectKind } from "./ProjectCard";
import Lightbox from "./Lightbox";
import YouTubeEmbed from "./YouTubeEmbed";
import InstagramEmbed from "./InstagramEmbed";

export default function ProjectDetail({ project }: { project: Project }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <main className="min-h-dvh bg-brand-dark text-brand-paper font-apex-sans selection:bg-brand-accent selection:text-brand-dark">
      <div className="mx-auto flex max-w-350 items-center justify-between px-4 pt-6 md:px-10">
        <Link href="/#work" className="inline-flex items-center gap-2 text-brand-muted hover:text-brand-paper">
          <ArrowLeft size={16} /> All work
        </Link>
        <Link href="/" className="font-apex-display text-[1.6rem] font-semibold text-brand-paper">Apex Cinematics</Link>
      </div>

      {/* Lead media */}
      <div className="mx-auto mt-8 max-w-350 px-4 md:px-10">
        {project.youtubeId ? (
          <YouTubeEmbed id={project.youtubeId} title={project.title} />
        ) : project.instagramUrl ? (
          <InstagramEmbed url={project.instagramUrl} title={project.title} />
        ) : project.cover ? (
          <div className="relative aspect-3/2 md:aspect-[2.39/1] overflow-hidden bg-brand-gray">
            <Image src={project.cover} alt={project.title} fill sizes="(max-width: 1400px) 100vw, 1400px" priority className="object-cover" />
          </div>
        ) : null}
      </div>

      {/* Title + story */}
      <div className="mx-auto max-w-350 px-4 py-14 md:px-10 md:py-20">
        <p className="text-brand-muted">{projectKind(project)}</p>
        <h1 className="mt-3 max-w-4xl font-apex-display text-5xl leading-[1.02] md:text-7xl">{project.title}</h1>
        <p className="mt-8 max-w-2xl text-lg leading-relaxed text-brand-muted">{project.story}</p>
        {project.youtubeId && project.instagramUrl && (
          <a href={project.instagramUrl} target="_blank" rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 text-brand-paper underline decoration-brand-paper/25 underline-offset-4 hover:decoration-brand-paper">
            <Instagram size={16} /> Also on Instagram
          </a>
        )}
      </div>

      {/* Gallery */}
      {project.photos.length > 0 && (
        <div className="mx-auto max-w-350 px-4 pb-20 md:px-10">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3">
            {project.photos.map((photo, i) => (
              <button key={photo.src} onClick={() => setLightboxIndex(i)} aria-label={`Open photo ${i + 1} of ${project.photos.length}`}
                className="group relative aspect-4/5 overflow-hidden bg-brand-gray">
                <Image src={photo.src} alt={photo.alt} fill sizes="(max-width: 768px) 50vw, 460px"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]" />
              </button>
            ))}
          </div>
        </div>
      )}

      <section className="border-t border-brand-rule px-4 py-20 text-center md:py-28">
        <h2 className="mx-auto max-w-2xl font-apex-display text-4xl leading-tight md:text-6xl">Planning something similar?</h2>
        <Link href="/#enquire" className="mt-9 inline-block bg-brand-paper px-8 py-3.5 font-medium text-brand-dark hover:bg-white">
          Enquire about a shoot
        </Link>
      </section>

      {lightboxIndex !== null && (
        <Lightbox photos={project.photos} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onNavigate={setLightboxIndex} />
      )}
    </main>
  );
}
