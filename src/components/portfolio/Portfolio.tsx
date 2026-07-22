"use client";
import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  Aperture,
  Film,
  Menu,
  X,
  Instagram,
  Linkedin,
  Twitter,
  Mail,
  ArrowRight,
  Zap,
  Layout,
  Maximize2
} from 'lucide-react';
import { PortfolioCategory, Project, Service } from './types';

// --- ASSETS & CONSTANTS ---

const NOISE_PATTERN = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.5'/%3E%3C/svg%3E`;

// --- DATA ---

const PROJECTS: Project[] = [
  {
    id: '1',
    title: 'Neon Nights: Clarke Quay',
    category: PortfolioCategory.EVENTS,
    image: 'https://images.unsplash.com/photo-1563251433-89a5df263c9b?q=80&w=1600&auto=format&fit=crop',
    videoUrl: 'https://cdn.coverr.co/videos/coverr-people-dancing-at-a-concert-5447/1080p.mp4',
    description: 'High-energy aftermovie for a sold-out warehouse rave in Singapore.',
    tags: ['Nightlife', 'Sony A7SIII', 'VFX']
  },
  {
    id: '2',
    title: 'Urban Solitude: Tiong Bahru',
    category: PortfolioCategory.CINEMATIC,
    image: 'https://images.unsplash.com/photo-1626084478170-0e57dfc920e5?q=80&w=1600&auto=format&fit=crop',
    videoUrl: 'https://cdn.coverr.co/videos/coverr-walking-in-an-alley-at-night-4436/1080p.mp4',
    description: 'A moody short film exploring the quiet corners of SG heritage estates.',
    tags: ['Documentary', 'Color Grading', 'Atmospheric']
  },
  {
    id: '3',
    title: 'Streetwear Drop: Haji Lane',
    category: PortfolioCategory.COMMERCIAL,
    image: 'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?q=80&w=1600&auto=format&fit=crop',
    videoUrl: 'https://cdn.coverr.co/videos/coverr-skating-in-a-parking-lot-2280/1080p.mp4',
    description: 'Lookbook and reels for a local sustainable fashion brand.',
    tags: ['Fashion', 'Social Media', 'Flash Photo']
  },
  {
    id: '4',
    title: 'Golden Hour at MBS',
    category: PortfolioCategory.LIFESTYLE,
    image: 'https://images.unsplash.com/photo-1506318137071-a8bcbf67119d?q=80&w=1600&auto=format&fit=crop',
    videoUrl: 'https://cdn.coverr.co/videos/coverr-woman-looking-at-sunset-4606/1080p.mp4',
    description: 'Influencer campaign featuring the iconic Singapore skyline.',
    tags: ['Golden Hour', 'Portrait', 'Luxury']
  },
  {
    id: '5',
    title: 'The Craftsman',
    category: PortfolioCategory.EDITORIAL,
    image: 'https://images.unsplash.com/photo-1545648719-2fc513476837?q=80&w=1600&auto=format&fit=crop',
    videoUrl: 'https://cdn.coverr.co/videos/coverr-potter-working-with-clay-2591/1080p.mp4',
    description: 'Profile feature on a traditional lantern maker in Chinatown.',
    tags: ['Storytelling', 'Interview', 'Heritage']
  },
  {
    id: '6',
    title: 'Speed & Motion',
    category: PortfolioCategory.CINEMATIC,
    image: 'https://images.unsplash.com/photo-1616423640778-28d1b53229bd?q=80&w=1600&auto=format&fit=crop',
    videoUrl: 'https://cdn.coverr.co/videos/coverr-driving-fast-at-night-4623/1080p.mp4',
    description: 'Automotive cinematography for a local car meet.',
    tags: ['Automotive', 'Fast Cuts', 'Sound Design']
  }
];

const SERVICES: Service[] = [
  {
    id: 's1',
    title: 'Social Media',
    price: 'From $250 SGD',
    description: 'Viral-ready Reels and TikToks for brands that want to speak Gen Z.',
    features: ['Vertical Video', 'Trend Analysis', 'Fast Turnaround', 'Monthly Packages'],
    icon: 'film'
  },
  {
    id: 's2',
    title: 'Event Coverage',
    price: 'From $1,200 SGD',
    description: 'We capture the vibe, not just the crowd. Perfect for nightlife and launches.',
    features: ['Highlight Reel', 'Raw Footage', 'Drone Add-on', 'Same-Day Edit'],
    icon: 'video'
  },
  {
    id: 's3',
    title: 'Photography',
    price: 'From $150 SGD',
    description: 'High-flash, gritty, or polished studio shots. Whatever the aesthetic needs.',
    features: ['Studio/Location', 'Art Direction', 'Retouching', 'Full Usage Rights'],
    icon: 'aperture'
  }
];

// --- HELPER COMPONENTS ---

const ScrollReveal: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => {
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
      className={`transition-all duration-1000 ease-out transform ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'
      } ${className}`}
    >
      {children}
    </div>
  );
};

const VideoProjectCard: React.FC<{ project: Project }> = ({ project }) => {
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (isHovered && videoRef.current) {
      videoRef.current.play().catch(e => console.log("Auto-play prevented"));
    } else if (!isHovered && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isHovered]);

  return (
    <div 
      className="group relative aspect-video bg-neutral-900 overflow-hidden cursor-pointer border border-neutral-900 hover:border-brand-orange transition-colors"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Image */}
      <img 
        src={project.image} 
        alt={project.title} 
        loading="lazy"
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${isHovered ? 'opacity-0' : 'opacity-80 group-hover:opacity-100'}`}
      />

      {/* Background Video Preview */}
      <video
        ref={videoRef}
        src={project.videoUrl}
        muted
        loop
        playsInline
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
      />
      
      {/* Overlay Content */}
      <div className={`absolute inset-0 bg-black/70 flex flex-col justify-between p-6 transition-all duration-300 ${isHovered ? 'opacity-0 translate-y-4' : 'opacity-0 group-hover:opacity-100'}`}>
        <div className="self-end">
          <Maximize2 className="text-brand-orange" size={24} />
        </div>
        <div>
          <span className="text-brand-orange text-xs font-bold uppercase tracking-widest mb-2 block">{project.category}</span>
          <h3 className="text-2xl font-apex-display font-bold text-white uppercase leading-none mb-3">{project.title}</h3>
          <div className="flex flex-wrap gap-2">
            {project.tags.map(tag => (
              <span key={tag} className="text-[10px] uppercase font-bold px-2 py-1 bg-white text-black">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Always visible title when NOT hovered (Mobile friendly) */}
      <div className={`absolute bottom-0 left-0 p-4 transition-opacity duration-300 ${isHovered ? 'opacity-0' : 'opacity-100 md:opacity-0'}`}>
         <h3 className="text-xl font-apex-display font-bold text-white uppercase drop-shadow-md">{project.title}</h3>
      </div>
    </div>
  );
}

// --- MAIN COMPONENTS ---

const SectionHeader: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div className="mb-16">
    <h3 className="text-brand-orange font-bold uppercase tracking-[0.2em] text-xs mb-2">{subtitle}</h3>
    <h2 className="text-5xl md:text-7xl font-apex-display font-bold text-white uppercase leading-[0.9]">{title}</h2>
  </div>
);

const NavBar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Work', href: '#portfolio' },
    { name: 'Services', href: '#rates' },
    { name: 'Studio', href: '#about' },
  ];

  return (
    <nav className={`fixed top-0 w-full z-40 transition-all duration-300 border-b ${scrolled ? 'bg-black/90 backdrop-blur-md border-neutral-800 py-3' : 'bg-transparent border-transparent py-6'}`}>
      <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
        <a href="#home" className="text-3xl font-apex-display font-bold text-white tracking-tighter uppercase italic z-50">
          Apex<span className="text-brand-orange not-italic">Angles</span>
        </a>

        {/* Desktop Nav */}
        <div className="hidden md:flex gap-12 items-center">
          {navLinks.map(link => (
            <a 
              key={link.name} 
              href={link.href} 
              className="text-sm font-bold uppercase tracking-widest text-neutral-400 hover:text-white transition-colors"
            >
              {link.name}
            </a>
          ))}
          <a href="#contact" className="px-6 py-2 bg-white text-black font-apex-display font-bold uppercase tracking-wider hover:bg-brand-orange hover:text-white transition-all skew-x-[-10deg]">
            <span className="skew-x-[10deg] inline-block">Book Shoot</span>
          </a>
        </div>

        {/* Mobile Toggle */}
        <button className="md:hidden text-white z-50" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black flex flex-col justify-center items-center gap-8 animate-fade-in">
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
            Let's Talk
          </a>
        </div>
      )}
    </nav>
  );
};

// --- MAIN APP COMPONENT ---

const Portfolio: React.FC = () => {
  const [filter, setFilter] = useState<PortfolioCategory>(PortfolioCategory.ALL);

  // Contact Form State
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const filteredProjects = PROJECTS.filter(p => 
    filter === PortfolioCategory.ALL || p.category === filter
  );

  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setContactForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { name, email, subject, message } = contactForm;
    const mailtoLink = `mailto:shoot@apexangles.sg?subject=${encodeURIComponent(subject || 'Shoot Inquiry')}&body=${encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`)}`;
    window.location.href = mailtoLink;
  };

  return (
    <div className="min-h-screen bg-brand-dark text-neutral-200 selection:bg-brand-orange selection:text-white font-apex-sans">
      <NavBar />
      
      {/* HERO SECTION */}
      <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden border-b border-white/5 pt-20 md:pt-0">
        
        {/* Grain Overlay */}
        <div 
          className="absolute inset-0 z-[1] pointer-events-none opacity-20"
          style={{ backgroundImage: `url("${NOISE_PATTERN}")` }}
        ></div>
        
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-brand-dark/80 to-transparent z-10"></div>
          <div className="absolute inset-0 bg-black/40 z-10"></div>
          <img 
            src="https://images.unsplash.com/photo-1542998966-267597da09f4?q=80&w=2670&auto=format&fit=crop" 
            className="w-full h-full object-cover opacity-80"
            alt="Singapore Cityscape"
          />
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
                  Apex Angles is a creative visual studio specializing in cinematic videography and high-impact photography for the digital age.
                </p>
              </ScrollReveal>
            </div>

            <div className="flex flex-col gap-4 w-full md:w-auto animate-fade-in" style={{ animationDelay: '500ms' }}>
              <a href="#portfolio" className="px-8 py-4 bg-brand-orange text-white font-bold uppercase tracking-wider hover:bg-orange-600 transition-all text-center">
                View Portfolio
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
      <section id="portfolio" className="py-24 bg-brand-dark relative">
        <div className="max-w-[1800px] mx-auto px-6">
          <ScrollReveal>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-6">
              <SectionHeader title="Visual Log" subtitle="Selected Works" />
              
              {/* Filters */}
              <div className="flex flex-wrap gap-4">
                {Object.values(PortfolioCategory).map((cat) => (
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
              <ScrollReveal key={project.id} className={`delay-[${idx * 100}ms]`}>
                <VideoProjectCard project={project} />
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICES SECTION */}
      <section id="rates" className="py-24 bg-neutral-900 border-y border-neutral-800">
        <div className="max-w-7xl mx-auto px-6">
          <ScrollReveal>
            <SectionHeader title="Capabilities" subtitle="Services" />
          </ScrollReveal>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {SERVICES.map((service, idx) => (
              <ScrollReveal key={service.id} className={`delay-[${idx * 150}ms]`}>
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
                  <div className="text-lg text-brand-orange font-bold mb-6 font-mono">{service.price}</div>
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
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT SECTION */}
      <section id="about" className="py-24 bg-brand-dark relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          <ScrollReveal className="order-2 lg:order-1">
            <h3 className="text-brand-orange font-bold uppercase tracking-[0.2em] text-xs mb-6">The Studio</h3>
            <h2 className="text-5xl md:text-6xl font-apex-display font-bold text-white uppercase leading-none mb-8">
              Based in Singapore. <br/> <span className="text-neutral-700">Shooting Everywhere.</span>
            </h2>
            
            <div className="space-y-6 text-neutral-400 text-lg font-light">
              <p>
                Apex Angles isn't about traditional videography. It's about movement, texture, and feeling. 
                We are a Gen Z-led creative house that understands the speed of culture.
              </p>
              <p>
                From the neon-soaked streets of Geylang to the polished boardrooms of CBD, we translate reality into 
                digital assets that stop the scroll.
              </p>
            </div>

            <div className="mt-12 border-t border-neutral-800 pt-8 grid grid-cols-2 gap-8">
              <div>
                <h4 className="text-white font-apex-display font-bold uppercase text-xl mb-2">Vision</h4>
                <p className="text-sm text-neutral-500">To bridge the gap between cinematic art and social speed.</p>
              </div>
              <div>
                <h4 className="text-white font-apex-display font-bold uppercase text-xl mb-2">Gear</h4>
                <p className="text-sm text-neutral-500">Sony Cinema Line, Vintage Glass, Heavy Drone Artillery.</p>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal className="order-1 lg:order-2 relative group delay-200">
            <div className="aspect-[3/4] bg-neutral-800 relative z-10 overflow-hidden">
              <img src="https://images.unsplash.com/photo-1549488497-2374e2a86577?q=80&w=1600&auto=format&fit=crop" alt="Singapore Streets" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
              <div className="absolute inset-0 bg-brand-orange mix-blend-multiply opacity-20 group-hover:opacity-0 transition-opacity"></div>
            </div>
            
            {/* Decorative Elements */}
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-brand-orange z-0"></div>
            <div className="absolute -top-4 -left-4 w-full h-full border border-neutral-700 z-20"></div>
          </ScrollReveal>

        </div>
      </section>

      {/* CONTACT SECTION */}
      <section id="contact" className="py-24 bg-black border-t border-neutral-900">
        <div className="max-w-6xl mx-auto px-6">
          <ScrollReveal>
            <div className="text-center mb-16">
              <h2 className="text-6xl md:text-8xl font-apex-display font-bold text-white uppercase mb-4">Start The Project</h2>
              <p className="text-neutral-400 text-lg">Currently accepting bookings for Q3 & Q4 2024.</p>
            </div>
          </ScrollReveal>

          <ScrollReveal className="delay-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 bg-neutral-900/50 p-8 md:p-12 border border-neutral-800">
              
              {/* Contact Info */}
              <div className="flex flex-col justify-between h-full gap-12">
                <div>
                  <h3 className="text-2xl font-apex-display font-bold text-white uppercase mb-8">Direct Line</h3>
                  <div className="space-y-6">
                    <a href="mailto:shoot@apexangles.sg" className="flex items-center gap-4 text-xl text-white hover:text-brand-orange transition-colors group">
                      <div className="w-12 h-12 bg-neutral-800 flex items-center justify-center group-hover:bg-brand-orange group-hover:text-black transition-all">
                        <Mail size={20} />
                      </div>
                      shoot@apexangles.sg
                    </a>
                    <div className="flex items-center gap-4 text-xl text-neutral-400">
                      <div className="w-12 h-12 bg-neutral-800 flex items-center justify-center">
                        <Layout size={20} />
                      </div>
                      Singapore, SG
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold uppercase text-neutral-500 mb-4">Socials</h4>
                  <div className="flex gap-4">
                    {[Instagram, Linkedin, Twitter].map((Icon, i) => (
                      <a key={i} href="#" className="w-12 h-12 border border-neutral-700 flex items-center justify-center text-white hover:bg-white hover:text-black transition-all">
                        <Icon size={20} />
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleContactSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold uppercase text-neutral-500 mb-2">Name</label>
                    <input 
                      type="text" 
                      name="name"
                      value={contactForm.name}
                      onChange={handleContactChange}
                      className="w-full bg-black border border-neutral-700 p-4 text-white focus:outline-none focus:border-brand-orange transition-colors font-mono text-sm" 
                      placeholder="NAME" 
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-neutral-500 mb-2">Email</label>
                    <input 
                      type="email" 
                      name="email"
                      value={contactForm.email}
                      onChange={handleContactChange}
                      className="w-full bg-black border border-neutral-700 p-4 text-white focus:outline-none focus:border-brand-orange transition-colors font-mono text-sm" 
                      placeholder="EMAIL" 
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-neutral-500 mb-2">Subject</label>
                  <input 
                    type="text" 
                    name="subject"
                    value={contactForm.subject}
                    onChange={handleContactChange}
                    className="w-full bg-black border border-neutral-700 p-4 text-white focus:outline-none focus:border-brand-orange transition-colors font-mono text-sm" 
                    placeholder="PROJECT TYPE" 
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-neutral-500 mb-2">Brief</label>
                  <textarea 
                    rows={4} 
                    name="message"
                    value={contactForm.message}
                    onChange={handleContactChange}
                    className="w-full bg-black border border-neutral-700 p-4 text-white focus:outline-none focus:border-brand-orange transition-colors font-mono text-sm" 
                    placeholder="TELL US THE VISION..."
                    required
                  ></textarea>
                </div>
                <button type="submit" className="w-full py-5 bg-brand-orange text-white font-bold uppercase tracking-widest hover:bg-orange-600 transition-all flex items-center justify-center gap-2 group">
                  Send Request <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </form>

            </div>
          </ScrollReveal>
        </div>
      </section>

      <footer className="py-12 bg-black border-t border-neutral-900">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-2xl font-apex-display font-bold text-white uppercase italic">
            Apex<span className="text-brand-orange not-italic">Angles</span>
          </div>
          <p className="text-neutral-600 text-xs font-mono uppercase tracking-widest">
            © 2024 Apex Angles SG. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Portfolio;