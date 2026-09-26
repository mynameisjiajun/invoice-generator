import Image from "next/image";
import Link from "next/link";
import { Instagram, Play } from "lucide-react";
import type { Project } from "./projects";

/** What the project is, in plain words: "Film, documentary, Make-A-Wish Singapore". */
export function projectKind(project: Project): string {
  const kind = project.type === "video" ? "Film" : "Photography";
  return [kind, ...project.tags.map((t, i) => (i === 0 ? t.toLowerCase() : t))].join(", ");
}

// Photo first, caption underneath — the frame is never covered by text.
export default function ProjectCard({ project, featured = false }: { project: Project; featured?: boolean }) {
  return (
    <Link href={`/work/${project.slug}`} className="group block">
      <div className={`relative overflow-hidden bg-brand-gray ${featured ? "aspect-3/2 md:aspect-[2.39/1]" : "aspect-3/2"}`}>
        {project.cover ? (
          <Image
            src={project.cover}
            alt={project.title}
            fill
            sizes={featured ? "(max-width: 1400px) 100vw, 1400px" : "(max-width: 768px) 100vw, 700px"}
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.015]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Instagram size={40} className="text-brand-muted" />
          </div>
        )}
        {project.type === "video" && (
          <span className="absolute right-4 bottom-4 flex h-11 w-11 items-center justify-center rounded-full bg-brand-dark/70 text-brand-paper backdrop-blur-sm">
            <Play size={16} className="translate-x-px" aria-label="Film" />
          </span>
        )}
      </div>
      <div className="mt-4 flex flex-col gap-1">
        <h3 className={`font-apex-display text-brand-paper leading-tight group-hover:text-white ${featured ? "text-3xl md:text-4xl" : "text-2xl md:text-[1.75rem]"}`}>
          {project.title}
        </h3>
        <p className="text-sm text-brand-muted">{projectKind(project)}</p>
      </div>
    </Link>
  );
}
