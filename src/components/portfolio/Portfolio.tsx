"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import type { Project, ProjectType } from "./projects";
import ProjectCard from "./ProjectCard";
import ScreeningRoom from "./ScreeningRoom";
import EnquiryForm from "./EnquiryForm";

const SERVICES = [
  {
    title: "Events",
    description: "Weddings, corporate, nightlife, community. If it matters to you, it's worth capturing properly.",
    features: ["Full-day or hourly coverage", "Highlight film and full edit", "Fast turnaround", "Photo and video together"],
  },
  {
    title: "Documentary",
    description: "Real people, real stories. Interview-led films for brands, families and causes that want something honest and lasting.",
    features: ["Interview-led storytelling", "Research and planning included", "Colour grading and sound", "Full usage rights"],
  },
  {
    title: "Social media content",
    description: "Reels and TikToks planned, shot and cut for the platform, delivered ready to post.",
    features: ["Vertical, ready-to-post formats", "Edited for each platform", "Monthly packages", "Planned around what's trending"],
  },
];

const CONTACTS = [
  { label: "Email", value: "chuajiajun2705@gmail.com", href: "mailto:chuajiajun2705@gmail.com" },
  { label: "Instagram", value: "@mynameisjiajun", href: "https://www.instagram.com/mynameisjiajun" },
  { label: "Telegram", value: "@mynameisjiajun", href: "https://t.me/mynameisjiajun" },
];

const NAV = [
  { name: "Work", id: "work" },
  { name: "Services", id: "services" },
  { name: "About", id: "about" },
];

export function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`font-apex-display text-[1.6rem] font-semibold tracking-[0.01em] text-brand-paper ${className}`}>Apex Cinematics</span>;
}

function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("home");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Highlight the link for the section in view.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-40% 0px -55% 0px" },
    );
    ["home", ...NAV.map((n) => n.id), "enquire"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <nav className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${scrolled ? "bg-brand-dark/92 backdrop-blur-md border-b border-brand-rule" : "border-b border-transparent"}`}>
        <div className="mx-auto flex max-w-350 items-center justify-between px-4 py-4 md:px-10">
          <a href="#home" aria-label="Apex Cinematics, back to top"><Wordmark /></a>
          <div className="hidden md:flex items-center gap-9">
            {NAV.map((n) => (
              <a key={n.id} href={`#${n.id}`} aria-current={active === n.id ? "true" : undefined}
                className={`text-[0.95rem] transition-colors ${active === n.id ? "text-brand-accent" : "text-brand-muted hover:text-brand-paper"}`}>
                {n.name}
              </a>
            ))}
            <a href="#enquire" className="border border-brand-paper/40 px-5 py-2 text-[0.95rem] text-brand-paper hover:border-brand-paper transition-colors">
              Enquire
            </a>
          </div>
          <button className="md:hidden p-1 text-brand-paper" onClick={() => setOpen(true)} aria-expanded={open} aria-label="Open menu">
            <Menu size={24} />
          </button>
        </div>
      </nav>

      {/* A sibling of <nav>, not a child: the scrolled nav's backdrop-filter
          would otherwise become this fixed overlay's containing block. */}
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Menu" className="md:hidden fixed inset-0 z-50 flex flex-col bg-brand-dark px-6 pt-5 pb-10">
          <div className="flex items-center justify-between">
            <Wordmark />
            <button className="p-1 text-brand-paper" onClick={() => setOpen(false)} aria-label="Close menu"><X size={26} /></button>
          </div>
          <div className="mt-auto flex flex-col gap-5">
            {[...NAV, { name: "Enquire", id: "enquire" }].map((n) => (
              <a key={n.id} href={`#${n.id}`} onClick={() => setOpen(false)}
                className="font-apex-display text-5xl text-brand-paper hover:text-brand-accent">
                {n.name}
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function SectionHeading({ id, children, intro }: { id: string; children: React.ReactNode; intro?: string }) {
  return (
    <div className="mb-12 md:mb-16 max-w-2xl">
      <h2 id={`${id}-title`} className="font-apex-display text-5xl md:text-6xl leading-[1.02] text-brand-paper">{children}</h2>
      {intro && <p className="mt-5 text-lg leading-relaxed text-brand-muted">{intro}</p>}
    </div>
  );
}

const FILTERS: { value: "all" | ProjectType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "video", label: "Films" },
  { value: "photo", label: "Photography" },
];

export default function Portfolio({ projects, aboutPhoto }: { projects: Project[]; aboutPhoto: string }) {
  const [filter, setFilter] = useState<"all" | ProjectType>("all");
  const shown = projects.filter((p) => filter === "all" || p.type === filter);
  const [lead, ...rest] = shown;

  return (
    <div className="min-h-dvh bg-brand-dark text-brand-paper font-apex-sans selection:bg-brand-accent selection:text-brand-dark">
      <NavBar />
      <ScreeningRoom projects={projects} />

      {/* WORK */}
      <section id="work" aria-labelledby="work-title" className="scroll-mt-20 py-24 md:py-32">
        <div className="mx-auto max-w-350 px-4 md:px-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <SectionHeading id="work">Selected work</SectionHeading>
            <div role="group" aria-label="Filter work" className="mb-12 md:mb-16 flex gap-6">
              {FILTERS.map((f) => (
                <button key={f.value} onClick={() => setFilter(f.value)} aria-pressed={filter === f.value}
                  className={`pb-1 text-[0.95rem] border-b transition-colors ${filter === f.value ? "text-brand-paper border-brand-accent" : "text-brand-muted border-transparent hover:text-brand-paper"}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {lead && <ProjectCard project={lead} featured />}
          {rest.length > 0 && (
            <div className="mt-14 grid grid-cols-1 gap-x-8 gap-y-14 md:grid-cols-2">
              {rest.map((p) => <ProjectCard key={p.slug} project={p} />)}
            </div>
          )}
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" aria-labelledby="services-title" className="scroll-mt-20 border-t border-brand-rule py-24 md:py-32">
        <div className="mx-auto max-w-350 px-4 md:px-10">
          <SectionHeading id="services" intro="Rates depend on the day and what you need. Tell me about your shoot and I'll send a quote.">
            What I shoot
          </SectionHeading>
          <div className="grid grid-cols-1 gap-14 md:grid-cols-3 md:gap-12">
            {SERVICES.map((s) => (
              <div key={s.title} className="border-t border-brand-rule pt-7">
                <h3 className="font-apex-display text-3xl text-brand-paper">{s.title}</h3>
                <p className="mt-4 leading-relaxed text-brand-muted">{s.description}</p>
                <ul className="mt-6 space-y-2 text-brand-paper/90">
                  {s.features.map((f) => <li key={f}>{f}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" aria-labelledby="about-title" className="scroll-mt-20 border-t border-brand-rule py-24 md:py-32">
        <div className="mx-auto grid max-w-350 grid-cols-1 items-center gap-12 px-4 md:grid-cols-12 md:gap-16 md:px-10">
          <div className="relative aspect-4/5 w-full max-w-md overflow-hidden bg-brand-gray md:col-span-5">
            <Image src={aboutPhoto} alt="Jia Jun of Apex Cinematics, holding a camera" fill sizes="(max-width: 768px) 100vw, 500px" className="object-cover" />
          </div>
          <div className="md:col-span-7 max-w-xl">
            <h2 id="about-title" className="font-apex-display text-5xl md:text-6xl leading-[1.02] text-brand-paper">
              Based in Singapore, shooting wherever the story is.
            </h2>
            <p className="mt-7 text-lg leading-relaxed text-brand-muted">
              Apex Cinematics shoots photo and video for everyone and anyone, from one-person passion
              projects to full-scale corporate events. No gear talk, no jargon: just high-quality
              coverage, delivered how you need it.
            </p>
            <dl className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <dt className="font-apex-display text-2xl text-brand-paper">What I cover</dt>
                <dd className="mt-2 text-brand-muted">Events, documentaries and social content, in photo and video.</dd>
              </div>
              <div>
                <dt className="font-apex-display text-2xl text-brand-paper">What you can count on</dt>
                <dd className="mt-2 text-brand-muted">Clear communication, and work delivered when I said it would be.</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* ENQUIRE */}
      <section id="enquire" aria-labelledby="enquire-title" className="scroll-mt-20 border-t border-brand-rule py-24 md:py-32">
        <div className="mx-auto grid max-w-350 grid-cols-1 gap-16 px-4 md:grid-cols-12 md:px-10">
          <div className="md:col-span-8">
            <SectionHeading id="enquire" intro="A few details are enough to start. I reply within a day.">
              Tell me about your shoot
            </SectionHeading>
            <EnquiryForm />
          </div>
          <aside className="md:col-span-4 md:pt-4">
            <h3 className="font-apex-display text-2xl text-brand-paper">Rather message directly?</h3>
            <ul className="mt-6 space-y-5">
              {CONTACTS.map((c) => (
                <li key={c.label}>
                  <div className="text-sm text-brand-muted">{c.label}</div>
                  <a href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer"
                    className="break-all text-brand-paper underline decoration-brand-paper/25 underline-offset-4 hover:decoration-brand-paper">
                    {c.value}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-brand-muted">Based in Singapore, available for travel.</p>
          </aside>
        </div>
      </section>

      <footer className="border-t border-brand-rule py-10">
        <div className="mx-auto flex max-w-350 flex-col gap-4 px-4 md:flex-row md:items-center md:justify-between md:px-10">
          <Wordmark className="text-xl" />
          <div className="flex gap-6 text-sm text-brand-muted">
            <Link href="/privacy" className="hover:text-brand-paper">Privacy</Link>
            <span>© {new Date().getFullYear()} Apex Cinematics</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
