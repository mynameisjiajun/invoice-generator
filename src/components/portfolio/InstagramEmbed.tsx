import { ArrowRight, Instagram } from "lucide-react";

// Instagram's embed widget only renders reliably on instagram.com itself,
// so rather than a flaky in-page embed we link straight out to the post.
export default function InstagramEmbed({ url, title }: { url: string; title: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col items-center justify-center gap-4 aspect-video bg-linear-to-br from-neutral-900 to-black text-center"
      aria-label={`Watch on Instagram: ${title}`}
    >
      <Instagram size={48} className="text-neutral-600 group-hover:text-brand-orange transition-colors" />
      <span className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-white group-hover:text-brand-orange transition-colors">
        Watch on Instagram <ArrowRight size={16} />
      </span>
    </a>
  );
}
