import Image from "next/image";
import Link from "next/link";
import { Instagram, Play } from "lucide-react";
import type { Project } from "./projects";

// `aspectClass` lets the grid make a card span two columns while keeping it
// the same height as its neighbours (see Portfolio's work grid).
export default function ProjectCard({ project, aspectClass = "aspect-video", wide = false }: {
  project: Project; aspectClass?: string; wide?: boolean;
}) {
  return (
    <Link
      href={`/work/${project.slug}`}
      className={`group relative block ${aspectClass} overflow-hidden border border-neutral-900 hover:border-brand-orange transition-colors bg-neutral-900`}
    >
      {project.cover ? (
        <Image
          src={project.cover}
          alt={project.title}
          fill
          sizes={wide ? "(max-width: 768px) 100vw, 850px" : "(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 420px"}
          className={`object-cover ${wide ? "object-[center_30%]" : ""} opacity-80 transition-[opacity,transform] duration-700 group-hover:opacity-100 group-hover:scale-105`}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-neutral-900 to-black">
          <Instagram size={48} className="text-neutral-700 group-hover:text-brand-orange transition-colors" />
        </div>
      )}
      {/* Deeper fade over the bottom half so the orange tags and title stay
          readable on busy frames (and over subtitles burned into video stills). */}
      <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black via-black/70 to-transparent" />
      {project.type === "video" && (
        <div className="absolute top-4 right-4 w-10 h-10 bg-black/60 border border-white/20 backdrop-blur-sm flex items-center justify-center text-white group-hover:bg-brand-orange group-hover:border-brand-orange transition-all">
          <Play size={16} className="translate-x-[1px]" />
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <span className="text-brand-orange text-[10px] font-bold uppercase tracking-widest">
          {project.type === "video" ? "Video" : "Photo"} — {project.tags.join(" · ")}
        </span>
        <h3 className="text-2xl font-apex-display font-bold text-white uppercase leading-none mt-2">
          {project.title}
        </h3>
      </div>
    </Link>
  );
}
