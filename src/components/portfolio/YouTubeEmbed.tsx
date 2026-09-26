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
        className="object-cover opacity-70 transition-all duration-700 group-hover:opacity-100 group-hover:scale-105"
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="w-20 h-20 bg-brand-orange flex items-center justify-center transition-transform group-hover:scale-110">
          <Play size={32} className="text-white translate-x-[2px]" />
        </span>
      </span>
    </button>
  );
}
