"use client";
import { useEffect, useRef, useState } from "react";

// Low-opacity static-glitch texture behind the hero title. Native <video>
// (self-hosted, media-src 'self') layered over HeroCanvas; the canvas stays
// as the base so a failed load or reduced-motion user still gets atmosphere.
export default function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  if (!enabled) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <video
        ref={videoRef}
        src="/hero-static.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        onPlaying={() => setPlaying(true)}
        onError={() => setPlaying(false)}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${playing ? "opacity-30" : "opacity-0"}`}
      />
      {/* keep it background-ish: dark veil so the headline stays dominant */}
      <div className="absolute inset-0 bg-black/50" />
    </div>
  );
}
