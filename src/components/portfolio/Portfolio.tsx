"use client";
import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  Aperture,
  Film,
  Menu,
  X,
  Instagram,
  Send,
  Mail,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { Service } from './types';
import { PROJECTS, type ProjectType } from './projects';
import ProjectCard from './ProjectCard';
import HeroCanvas from './HeroCanvas';
import HeroVideo from './HeroVideo';


// --- DATA ---

const SERVICES: Service[] = [
  {
    id: 's1',
    title: 'Event Coverage',
    description: "Weddings, corporate, nightlife, community — if it matters to you, it's worth capturing properly. Full-day or hourly coverage with fast turnaround highlight edits.",
    features: ['Full-day or hourly coverage', 'Highlight + full edits', 'Fast turnaround', 'Photo + video teams'],
    icon: 'video'
  },
  {
    id: 's2',
    title: 'Documentary',
    description: 'Real people, real stories. Interview-led films for brands, families, and causes that want something honest and lasting.',
    features: ['Interview-led storytelling', 'Research + planning included', 'Cinematic color + sound', 'Full usage rights'],
    icon: 'film'
  },
  {
    id: 's3',
    title: 'Social Media Content',
    description: 'Reels and TikToks built to perform — planned, shot, and cut for the platform, delivered ready to post.',
    features: ['Ready-to-post formats', 'Platform-native editing', 'Monthly packages', 'Trend-aware planning'],
    icon: 'aperture'
  }
];

// --- HELPER COMPONENTS ---

const ScrollReveal: React.FC<{ children: React.ReactNode; className?: string; delayMs?: number }> = ({ children, className = "", delayMs = 0 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => setIsVisible(entry.isIntersecting));
    }, { threshold: 0.1 }); // Trigger when 10% visible

    const currentRef = domRef.current;
    if (currentRef) observer.observe(currentRef);
    return () => { if (currentRef) observer.unobserve(currentRef); };
  }, []);

  return (
    <div
      ref={domRef}
      style={{ transitionDelay: `${delayMs}ms` }}
      className={`transition-all duration-1000 ease-out transform ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'
      } ${className}`}
    >
      {children}
    </div>
  );
};

// --- MAIN COMPONENTS ---

const SectionHeader: React.FC<{ title: string; subtitle: string; index?: string }> = ({ title, subtitle, index }) => (
  <div className="mb-16">
    <div className="flex items-center gap-3 mb-2">
      {index && <span className="font-mono text-xs text-neutral-600 tracking-widest">{index}</span>}
      <h3 className="text-brand-orange font-bold uppercase tracking-[0.2em] text-xs">{subtitle}</h3>
    </div>
    <h2 className="text-5xl md:text-7xl font-apex-display font-bold text-white uppercase leading-[0.9]">{title}</h2>
  </div>
);

const NavBar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeId, setActiveId] = useState('home');

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scrollspy: highlight the nav link for the section in view.
  useEffect(() => {
    const ids = ['home', 'portfolio', 'rates', 'about', 'contact'];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }
      },
      // A slim horizontal band ~40% down the viewport decides the active section.
      { rootMargin: '-40% 0px -55% 0px' }
    );
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Scroll-lock + Escape while the mobile menu is open.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [mobileMenuOpen]);

  const navLinks = [
    { name: 'Work', href: '#portfolio', id: 'portfolio' },
    { name: 'Services', href: '#rates', id: 'rates' },
    { name: 'Studio', href: '#about', id: 'about' },
  ];

  return (
    <>
      <nav className={`fixed top-0 w-full z-40 transition-all duration-300 border-b ${scrolled ? 'bg-black/90 backdrop-blur-md border-neutral-800 py-3' : 'bg-transparent border-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <a href="#home" className="text-3xl font-apex-display font-bold text-white tracking-tighter uppercase italic z-50">
            Apex<span className="text-brand-orange not-italic">Cinematics</span>
          </a>

          {/* Desktop Nav */}
          <div className="hidden md:flex gap-12 items-center">
            {navLinks.map(link => (
              <a
                key={link.name}
                href={link.href}
                aria-current={activeId === link.id ? 'true' : undefined}
                className={`text-sm font-bold uppercase tracking-widest transition-colors border-b-2 pb-1 ${
                  activeId === link.id
                    ? 'text-brand-orange border-brand-orange'
                    : 'text-neutral-400 border-transparent hover:text-white'
                }`}
              >
                {link.name}
              </a>
            ))}
            <a href="#contact" className="px-6 py-2 bg-white text-black font-apex-display font-bold uppercase tracking-wider hover:bg-brand-orange hover:text-white transition-all skew-x-[-10deg]">
              <span className="skew-x-[10deg] inline-block">Book Shoot</span>
            </a>
          </div>

          {/* Mobile Toggle */}
          <button
            className="md:hidden text-white z-50"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu — a SIBLING of <nav>, never a descendant: the scrolled
          nav's backdrop-filter would otherwise become the containing block
          for this fixed overlay and shrink it to the nav strip. */}
      {mobileMenuOpen && (
        <div role="dialog" aria-modal="true" className="md:hidden fixed inset-0 z-50 bg-black flex flex-col justify-center items-center gap-8 animate-fade-in">
          <button
            className="absolute top-6 right-6 text-white"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={28} />
          </button>
          {navLinks.map(link => (
            <a
              key={link.name}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="text-5xl font-apex-display font-bold text-neutral-500 hover:text-white hover:text-brand-orange uppercase transition-all duration-300"
            >
              {link.name}
            </a>
          ))}
          <a
            href="#contact"
            onClick={() => setMobileMenuOpen(false)}
            className="text-4xl font-apex-display font-bold text-brand-orange mt-8 border-b-2 border-brand-orange"
          >
            Let&apos;s Talk
          </a>
        </div>
      )}
    </>
  );
};

// --- MAIN APP COMPONENT ---

const Portfolio: React.FC = () => {
  const [filter, setFilter] = useState<"all" | ProjectType>("all");

  const filteredProjects = PROJECTS.filter(p => filter === "all" || p.type === filter);

  return (
    <div className="min-h-dvh bg-brand-dark text-neutral-200 selection:bg-brand-orange selection:text-white font-apex-sans">
      <NavBar />

      {/* HERO SECTION */}
      <section id="home" className="relative min-h-dvh flex items-center justify-center overflow-hidden border-b border-white/5 pt-20 md:pt-0">

        {/* Background: cursor-reactive animated texture (no photo needed) */}
        <div className="absolute inset-0 z-0">
          <HeroCanvas />
          <HeroVideo />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-transparent to-transparent z-10"></div>
          {/* Cinematic letterbox bars */}
          <div className="absolute top-0 left-0 right-0 h-5 bg-black z-20"></div>
          <div className="absolute bottom-0 left-0 right-0 h-5 bg-black z-20"></div>
          {/* Timecode chip — top-28 clears the fixed navbar (its tallest,
              unscrolled state is ~py-6 plus a 3xl logo, roughly 90px) so it
              never overlaps nav links/Book Shoot regardless of scroll state. */}
          <div className="absolute top-28 right-6 z-20 font-mono text-[10px] tracking-[0.3em] text-neutral-400 uppercase hidden md:flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-orange animate-pulse"></span>
            REC • APX • SG
          </div>
        </div>

        <div className="container mx-auto px-6 relative z-20 w-full">
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-12 pb-20 md:pb-0">
            <div className="max-w-4xl">
              <ScrollReveal>
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-[1px] w-12 bg-brand-orange"></div>
                  <span className="text-brand-orange font-bold tracking-widest uppercase text-sm">Singapore Based</span>
                </div>
              </ScrollReveal>

              <ScrollReveal className="delay-100">
                <h1 className="text-5xl md:text-8xl lg:text-9xl font-apex-display font-bold text-white leading-[0.85] tracking-tighter uppercase mb-8 drop-shadow-lg">
                  Capturing <br/>
                  <span className="text-transparent stroke-text hover:text-brand-orange transition-colors duration-500" style={{ WebkitTextStroke: '2px white' }}>The Unseen</span>
                </h1>
              </ScrollReveal>

              <ScrollReveal className="delay-200">
                <p className="max-w-xl text-lg md:text-xl text-neutral-200 font-light leading-relaxed border-l-2 border-brand-orange pl-6 backdrop-blur-sm bg-black/20 py-2">
                  Apex Cinematics is a Singapore-based studio covering events, documentaries, and social content — cinematic photo and video for everyone and anyone.
                </p>
              </ScrollReveal>
            </div>

            <div className="flex flex-col gap-4 w-full md:w-auto animate-fade-in" style={{ animationDelay: '500ms' }}>
              <a href="#portfolio" className="px-8 py-4 bg-brand-orange text-white font-bold uppercase tracking-wider hover:bg-orange-600 transition-all text-center">
                View Work
              </a>
              <a href="#contact" className="px-8 py-4 border border-white/20 backdrop-blur-md bg-black/30 text-white font-bold uppercase tracking-wider hover:bg-white hover:text-black transition-all text-center">
                Get In Touch
              </a>
            </div>
          </div>
        </div>

        {/* Scrolling Ticker */}
        <div className="absolute bottom-0 w-full border-t border-white/10 bg-black py-3 overflow-hidden z-20">
           <div className="whitespace-nowrap animate-marquee-right flex gap-8">
             {[...Array(20)].map((_, i) => (
               <span key={i} className="text-neutral-500 font-apex-display font-bold uppercase tracking-widest text-sm mx-4">
                 VIDEO • PHOTO • SOCIALS •
               </span>
             ))}
           </div>
        </div>
      </section>

      {/* PORTFOLIO SECTION */}
      <section id="portfolio" className="py-24 bg-brand-dark relative scroll-mt-20">
        <div className="max-w-[1800px] mx-auto px-6">
          <ScrollReveal>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-6">
              <SectionHeader title="Visual Log" subtitle="Selected Works" index="01" />

              {/* Filters */}
              <div className="flex flex-wrap gap-4">
                {(["all", "video", "photo"] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilter(cat)}
                    className={`text-sm font-bold uppercase tracking-wider transition-all border-b-2 pb-1 ${
                      filter === cat
                        ? 'text-brand-orange border-brand-orange'
                        : 'text-neutral-500 border-transparent hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </ScrollReveal>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
            {filteredProjects.map((project, idx) => (
              <ScrollReveal key={project.slug} delayMs={idx * 80}>
                <ProjectCard project={project} />
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICES SECTION */}
      <section id="rates" className="py-24 bg-neutral-900 border-y border-neutral-800 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6">
          <ScrollReveal>
            <SectionHeader title="Capabilities" subtitle="Services" index="02" />
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {SERVICES.map((service, idx) => (
              <ScrollReveal key={service.id} delayMs={idx * 150}>
                <div className="p-8 border border-neutral-800 hover:border-brand-orange bg-black transition-all duration-300 group flex flex-col h-full hover:-translate-y-2">
                  <div className="flex justify-between items-start mb-8">
                    <div className="p-3 bg-neutral-900 text-white group-hover:bg-brand-orange transition-colors">
                      {service.icon === 'film' && <Film size={24} />}
                      {service.icon === 'video' && <Video size={24} />}
                      {service.icon === 'aperture' && <Aperture size={24} />}
                    </div>
                    <span className="text-xs font-mono text-neutral-500">0{idx + 1}</span>
                  </div>

                  <h3 className="text-2xl font-apex-display font-bold text-white uppercase mb-2">{service.title}</h3>
                  <p className="text-neutral-400 text-sm mb-8 leading-relaxed border-b border-neutral-800 pb-8 flex-grow">
                    {service.description}
                  </p>

                  <ul className="space-y-3">
                    {service.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm text-neutral-300 font-medium">
                        <Zap size={12} className="text-brand-orange" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <a href="#contact" className="mt-8 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-brand-orange hover:text-white transition-colors">
                    Let&apos;s talk <ArrowRight size={14} />
                  </a>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT SECTION */}
      <section id="about" className="py-24 bg-brand-dark relative overflow-hidden scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          <ScrollReveal className="order-2 lg:order-1">
            <h3 className="text-brand-orange font-bold uppercase tracking-[0.2em] text-xs mb-6">The Studio</h3>
            <h2 className="text-5xl md:text-6xl font-apex-display font-bold text-white uppercase leading-none mb-8">
              Based in Singapore. <br/> <span className="text-neutral-700">Shooting Everywhere.</span>
            </h2>

            <div className="space-y-6 text-neutral-400 text-lg font-light">
              <p>
                Apex Cinematics shoots photo and video for everyone and anyone — from one-person passion
                projects to full-scale corporate events. No gear talk, no jargon: just high-quality
                coverage, delivered how you need it.
              </p>
            </div>

            <a href="#contact" className="mt-8 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-brand-orange hover:text-white transition-colors">
              Let&apos;s talk <ArrowRight size={14} />
            </a>

            <div className="mt-12 border-t border-neutral-800 pt-8 grid grid-cols-2 gap-8">
              <div>
                <h4 className="text-white font-apex-display font-bold uppercase text-xl mb-2">Coverage</h4>
                <p className="text-sm text-neutral-500">Events, documentaries, and social content — photo and video.</p>
              </div>
              <div>
                <h4 className="text-white font-apex-display font-bold uppercase text-xl mb-2">Promise</h4>
                <p className="text-sm text-neutral-500">High-quality work, clear communication, delivered on time.</p>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal className="order-1 lg:order-2 relative group delay-200">
            <div className="aspect-3/2 bg-neutral-800 relative z-10 overflow-hidden">
              <img src="/work/ggs-iceland.jpg" alt="GGS Iceland Climate Action Event" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
              <div className="absolute inset-0 bg-brand-orange mix-blend-multiply opacity-20 group-hover:opacity-0 transition-opacity"></div>
            </div>

            {/* Decorative Elements */}
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-brand-orange z-0"></div>
            <div className="absolute -top-4 -left-4 w-full h-full border border-neutral-700 z-20"></div>
          </ScrollReveal>

        </div>
      </section>

      {/* CONTACT SECTION */}
      <section id="contact" className="py-24 bg-black border-t border-neutral-900 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-6">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-6xl md:text-8xl font-apex-display font-bold text-white uppercase mb-4">Start The Project</h2>
              <p className="text-neutral-400 text-lg">Tell me what you&apos;re planning — I&apos;ll get back within a day.</p>
            </div>
          </ScrollReveal>

          <ScrollReveal delayMs={200}>
            <div className="bg-neutral-900/50 p-8 md:p-12 border border-neutral-800">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <a href="mailto:chuajiajun2705@gmail.com" className="group flex flex-col items-center gap-4 p-8 bg-black border border-neutral-800 hover:border-brand-orange hover:-translate-y-1 transition-all text-center">
                  <div className="w-14 h-14 bg-neutral-900 flex items-center justify-center text-white group-hover:bg-brand-orange transition-colors">
                    <Mail size={24} />
                  </div>
                  <div>
                    <div className="text-white font-apex-display font-bold uppercase tracking-wider">Email</div>
                    <div className="text-neutral-500 text-sm mt-1 break-all">chuajiajun2705@gmail.com</div>
                  </div>
                </a>
                <a href="https://www.instagram.com/mynameisjiajun" target="_blank" rel="noopener noreferrer" className="group flex flex-col items-center gap-4 p-8 bg-black border border-neutral-800 hover:border-brand-orange hover:-translate-y-1 transition-all text-center">
                  <div className="w-14 h-14 bg-neutral-900 flex items-center justify-center text-white group-hover:bg-brand-orange transition-colors">
                    <Instagram size={24} />
                  </div>
                  <div>
                    <div className="text-white font-apex-display font-bold uppercase tracking-wider">Instagram</div>
                    <div className="text-neutral-500 text-sm mt-1">@mynameisjiajun</div>
                  </div>
                </a>
                <a href="https://t.me/mynameisjiajun" target="_blank" rel="noopener noreferrer" className="group flex flex-col items-center gap-4 p-8 bg-black border border-neutral-800 hover:border-brand-orange hover:-translate-y-1 transition-all text-center">
                  <div className="w-14 h-14 bg-neutral-900 flex items-center justify-center text-white group-hover:bg-brand-orange transition-colors">
                    <Send size={24} />
                  </div>
                  <div>
                    <div className="text-white font-apex-display font-bold uppercase tracking-wider">Telegram</div>
                    <div className="text-neutral-500 text-sm mt-1">@mynameisjiajun</div>
                  </div>
                </a>
              </div>
              <p className="text-center text-neutral-500 text-sm mt-8 font-mono uppercase tracking-widest">Based in Singapore · Available for travel</p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <footer className="py-12 bg-black border-t border-neutral-900">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-2xl font-apex-display font-bold text-white uppercase italic">
            Apex<span className="text-brand-orange not-italic">Cinematics</span>
          </div>
          <p className="text-neutral-600 text-xs font-mono uppercase tracking-widest">
            © 2026 Apex Cinematics SG. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Portfolio;
