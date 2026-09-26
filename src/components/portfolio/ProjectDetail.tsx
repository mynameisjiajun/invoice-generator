"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Instagram } from "lucide-react";
import type { Project } from "./projects";
import Lightbox from "./Lightbox";
import YouTubeEmbed from "./YouTubeEmbed";
import InstagramEmbed from "./InstagramEmbed";

export default function ProjectDetail({ project }: { project: Project }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <main className="min-h-dvh bg-brand-dark text-neutral-200 selection:bg-brand-orange selection:text-white font-apex-sans">
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
        ) : project.instagramUrl ? (
          <InstagramEmbed url={project.instagramUrl} title={project.title} />
        ) : project.cover ? (
          <div className="relative aspect-video overflow-hidden bg-neutral-900">
            <Image src={project.cover} alt={project.title} fill sizes="100vw" priority className="object-cover" />
          </div>
        ) : null}

        {project.youtubeId && project.instagramUrl && (
          <a
            href={project.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-3 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-neutral-400 hover:text-brand-orange transition-colors"
          >
            <Instagram size={16} /> Also on Instagram <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
          </a>
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
      {project.photos.length > 0 && (
      <div className="max-w-[1400px] mx-auto px-6 pb-16">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
          {project.photos.map((photo, i) => (
            <button key={photo.src} onClick={() => setLightboxIndex(i)} aria-label={`Open photo: ${photo.alt}`} className="group relative aspect-square overflow-hidden bg-neutral-900">
              <Image src={photo.src} alt={photo.alt} fill sizes="(max-width: 768px) 50vw, 33vw" className="object-cover opacity-90 transition-all duration-500 group-hover:opacity-100 group-hover:scale-105" />
            </button>
          ))}
        </div>
      </div>
      )}

      {/* CTA banner */}
      <section className="py-20 bg-black border-t border-neutral-900 text-center px-6">
        <h2 className="text-4xl md:text-6xl font-apex-display font-bold text-white uppercase mb-8">
          Like this? Let&apos;s shoot yours.
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
