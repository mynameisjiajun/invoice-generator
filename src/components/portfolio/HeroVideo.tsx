"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

// Low-opacity static-glitch texture behind the hero title. Native <video>
// (self-hosted, media-src 'self') layered over HeroCanvas; the canvas stays
// as the base so a failed load or reduced-motion user still gets atmosphere.
// Plays only while the hero is on screen — decoding video behind the rest of
// the page would compete with scrolling, especially on phones.
export default function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  // Server render and reduced-motion users get no video.
  const enabled = useSyncExternalStore(subscribe, () => !window.matchMedia(REDUCED).matches, () => false);

  useEffect(() => {
    const video = videoRef.current;
    if (!enabled || !video) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) video.play().catch(() => {});
      else video.pause();
    });
    observer.observe(video);
    return () => observer.disconnect();
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <video
        ref={videoRef}
        src="/hero-static.mp4"
        muted
        loop
        playsInline
        preload="metadata"
        onPlaying={() => setPlaying(true)}
        onError={() => setPlaying(false)}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${playing ? "opacity-30" : "opacity-0"}`}
      />
      {/* keep it background-ish: dark veil so the headline stays dominant */}
      <div className="absolute inset-0 bg-black/50" />
    </div>
  );
}
