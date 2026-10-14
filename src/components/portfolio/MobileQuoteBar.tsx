"use client";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { quoteBarVisible } from "./quote";

// Phone-only "Get a Quote" bar: one tap from anywhere on the page, but out
// of the way over the hero (which has its own button) and over the form.
export default function MobileQuoteBar() {
  const [heroInView, setHeroInView] = useState(true);
  const [contactInView, setContactInView] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("home");
    const contact = document.getElementById("contact");
    if (!hero || !contact) return;
    const observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === hero) setHeroInView(e.isIntersecting);
        if (e.target === contact) setContactInView(e.isIntersecting);
      }
    });
    observer.observe(hero);
    observer.observe(contact);
    return () => observer.disconnect();
  }, []);

  const visible = quoteBarVisible(heroInView, contactInView);

  return (
    <div
      aria-hidden={!visible}
      className={`md:hidden fixed inset-x-0 bottom-0 z-40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black via-black/90 to-transparent transition-[opacity,transform] duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-full pointer-events-none"
      }`}
    >
      <a
        href="#contact"
        tabIndex={visible ? 0 : -1}
        className="flex items-center justify-center gap-2 w-full py-4 bg-brand-orange text-white font-bold uppercase tracking-wider"
      >
        Get a Quote <ArrowRight size={18} />
      </a>
    </div>
  );
}
