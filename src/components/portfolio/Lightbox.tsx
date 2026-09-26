"use client";
import { useEffect, useRef } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import type { ProjectPhoto } from "./projects";

export default function Lightbox({
  photos,
  index,
  onClose,
  onNavigate,
}: {
  photos: ProjectPhoto[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const touchStartX = useRef<number | null>(null);
  const prev = () => onNavigate((index - 1 + photos.length) % photos.length);
  const next = () => onNavigate((index + 1) % photos.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, photos.length]);

  const photo = photos[index];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.alt}
      className="fixed inset-0 z-[100] bg-brand-dark/97 flex items-center justify-center"
      onClick={onClose}
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (dx > 50) prev();
        else if (dx < -50) next();
      }}
    >
      <button onClick={onClose} aria-label="Close" className="absolute top-5 right-5 z-10 w-12 h-12 flex items-center justify-center text-brand-paper hover:text-white transition-colors">
        <X size={28} />
      </button>
      <span className="absolute top-7 left-6 text-sm text-brand-muted">
        {index + 1} of {photos.length}
      </span>
      {photos.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); prev(); }} aria-label="Previous photo" className="absolute left-2 md:left-6 z-10 w-12 h-12 hidden sm:flex items-center justify-center text-brand-paper hover:text-white transition-colors">
            <ChevronLeft size={32} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); next(); }} aria-label="Next photo" className="absolute right-2 md:right-6 z-10 w-12 h-12 hidden sm:flex items-center justify-center text-brand-paper hover:text-white transition-colors">
            <ChevronRight size={32} />
          </button>
        </>
      )}
      <figure className="relative w-[92vw] h-[80vh]" onClick={(e) => e.stopPropagation()}>
        <Image src={photo.src} alt={photo.alt} fill sizes="92vw" className="object-contain" priority />
        {photo.caption && (
          <figcaption className="absolute -bottom-8 left-0 right-0 text-center text-sm text-brand-muted">
            {photo.caption}
          </figcaption>
        )}
      </figure>
    </div>
  );
}
