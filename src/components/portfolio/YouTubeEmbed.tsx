"use client";
import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";

// Renders a thumbnail until clicked — no YouTube JS/cookies on page load.
export default function YouTubeEmbed({ id, title }: { id: string; title: string }) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="relative aspect-video bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setPlaying(true)}
      className="group relative block w-full aspect-video overflow-hidden bg-black text-left"
      aria-label={`Play video: ${title}`}
    >
      <Image
        src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
        alt={title}
        fill
        sizes="100vw"
        className="object-cover opacity-85 transition-opacity duration-500 group-hover:opacity-100"
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-paper/95 text-brand-dark transition-transform duration-300 group-hover:scale-105">
          <Play size={28} className="translate-x-0.5" fill="currentColor" />
        </span>
      </span>
    </button>
  );
}
