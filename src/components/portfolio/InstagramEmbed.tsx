"use client";
import { useEffect } from "react";

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

// Renders Instagram's official embed widget for a public post/reel URL.
export default function InstagramEmbed({ url, title }: { url: string; title: string }) {
  useEffect(() => {
    const scriptId = "instagram-embed-script";
    if (window.instgrm) {
      window.instgrm.Embeds.process();
      return;
    }
    if (document.getElementById(scriptId)) return;
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://www.instagram.com/embed.js";
    script.async = true;
    document.body.appendChild(script);
  }, [url]);

  return (
    <div className="flex justify-center bg-neutral-900 py-6">
      <blockquote
        className="instagram-media"
        data-instgrm-permalink={url}
        data-instgrm-version="14"
        style={{ background: "#000", border: 0, borderRadius: 3, margin: "0 auto", maxWidth: 540, minWidth: 326, width: "99%" }}
      >
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Watch on Instagram: ${title}`}>
          Watch on Instagram
        </a>
      </blockquote>
    </div>
  );
}
