import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";
import type { Project } from "./projects";

export default function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/work/${project.slug}`}
      className="group relative block aspect-video overflow-hidden border border-neutral-900 hover:border-brand-orange transition-colors bg-neutral-900"
    >
      <Image
        src={project.cover}
        alt={project.title}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
        className="object-cover opacity-80 transition-all duration-700 group-hover:opacity-100 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
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
