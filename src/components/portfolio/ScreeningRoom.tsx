"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Project } from "./projects";

const HOLD_MS = 5500;

type Reel = { slug: string; title: string; src: string };

/** One frame per project. Galleries give a frame from inside the shoot (not
 *  the cover, which the work grid already shows); films fall back to their
 *  cover. Photo projects lead, since a video thumbnail may carry burned-in
 *  subtitles. */
function pickReels(projects: Project[]): Reel[] {
  const reels = projects.flatMap((p): Reel[] => {
    const src = p.photos[Math.min(1, p.photos.length - 1)]?.src ?? p.cover;
    return src ? [{ slug: p.slug, title: p.title, src }] : [];
  });
  const hasGallery = new Set(projects.filter((p) => p.photos.length > 0).map((p) => p.slug));
  return [...reels.filter((r) => hasGallery.has(r.slug)), ...reels.filter((r) => !hasGallery.has(r.slug))].slice(0, 6);
}

// The opening screen: a letterboxed (2.39:1) frame that slowly cross-fades
// through frames from the work, with the page's headline set beneath it like
// a subtitle. It is the one piece of motion on the page; with reduced motion
// it holds on the first frame.
export default function ScreeningRoom({ projects }: { projects: Project[] }) {
  const reels = pickReels(projects);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reels.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % reels.length), HOLD_MS);
    return () => clearInterval(t);
  }, [reels.length]);

  const current = reels[index];

  return (
    <section id="home" className="min-h-dvh flex flex-col justify-center pt-20 pb-12 md:pt-24">
      <div className="mx-auto w-full max-w-350 px-4 md:px-10">
        <div className="relative mx-auto w-full aspect-4/5 sm:aspect-3/2 md:aspect-[2.39/1] md:max-w-[calc((100dvh-320px)*2.39)] overflow-hidden bg-black">
          {reels.map((p, i) => (
            <Image
              key={p.slug}
              src={p.src}
              alt=""
              fill
              priority={i === 0}
              sizes="(max-width: 1400px) 100vw, 1400px"
              className={`object-cover transition-opacity duration-[1600ms] ease-in-out ${i === index ? "opacity-100" : "opacity-0"}`}
            />
          ))}
        </div>
        {current && (
          <p className="mx-auto mt-3 md:max-w-[calc((100dvh-320px)*2.39)] text-sm text-brand-muted">
            Now showing:{" "}
            <Link href={`/work/${current.slug}`} className="text-brand-paper/85 underline decoration-brand-paper/25 underline-offset-4 hover:text-brand-paper">
              {current.title}
            </Link>
          </p>
        )}

        <h1 className="mx-auto mt-8 md:mt-9 max-w-5xl text-center font-apex-display italic text-[1.9rem] leading-[1.15] md:text-[2.5rem] text-brand-paper">
          <span aria-hidden className="block mx-auto mb-4 h-px w-10 bg-brand-accent" />
          Photo and film for events, stories and brands in Singapore.
        </h1>

        <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
          <a href="#work" className="w-full sm:w-auto text-center px-7 py-3.5 bg-brand-paper text-brand-dark font-medium hover:bg-white transition-colors">
            See the work
          </a>
          <a href="#enquire" className="w-full sm:w-auto text-center px-7 py-3.5 text-brand-paper underline decoration-brand-paper/30 underline-offset-[6px] hover:decoration-brand-paper">
            Enquire about a shoot
          </a>
        </div>
      </div>
    </section>
  );
}
