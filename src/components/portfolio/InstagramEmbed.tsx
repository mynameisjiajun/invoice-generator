import { Instagram } from "lucide-react";

// Instagram's embed widget only renders reliably on instagram.com itself,
// so rather than a flaky in-page embed we link straight out to the post.
export default function InstagramEmbed({ url, title }: { url: string; title: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col items-center justify-center gap-4 aspect-video bg-brand-gray text-center"
      aria-label={`Watch on Instagram: ${title}`}
    >
      <Instagram size={44} className="text-brand-muted group-hover:text-brand-paper transition-colors" />
      <span className="text-brand-paper underline decoration-brand-paper/30 underline-offset-4 group-hover:decoration-brand-paper">
        Watch on Instagram
      </span>
    </a>
  );
}
