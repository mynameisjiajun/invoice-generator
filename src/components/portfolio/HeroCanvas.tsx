"use client";
import { useEffect, useRef } from "react";

// Cursor-reactive "darkroom" texture: drifting dust/bokeh particles over a
// near-black base, with a soft safelight glow that eases toward the pointer
// and gently pushes particles aside. Canvas 2D, no dependencies.
export default function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const canvas: HTMLCanvasElement = canvasEl;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ctx: CanvasRenderingContext2D = context;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    const pointer = { x: 0.5, y: 0.4, tx: 0.5, ty: 0.4 };

    type Particle = {
      x: number; y: number; r: number;
      vx: number; vy: number; a: number; warm: boolean;
    };
    let particles: Particle[] = [];

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(90, Math.max(32, Math.round(width / 18)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 3 + Math.random() * 7,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        a: 0.15 + Math.random() * 0.55,
        warm: Math.random() < 0.35,
      }));
    }

    function drawFrame() {
      ctx.fillStyle = "#0A0A0A";
      ctx.fillRect(0, 0, width, height);

      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;
      const gx = pointer.x * width;
      const gy = pointer.y * height;

      const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(width, height) * 0.55);
      glow.addColorStop(0, "rgba(255,107,0,0.16)");
      glow.addColorStop(0.35, "rgba(255,107,0,0.05)");
      glow.addColorStop(1, "rgba(255,107,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        const dx = p.x - gx;
        const dy = p.y - gy;
        const d2 = dx * dx + dy * dy;
        const rad = 160;
        if (d2 < rad * rad && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = ((rad - d) / rad) * 0.6;
          p.x += (dx / d) * push;
          p.y += (dy / d) * push;
        }
        if (p.x < -10) p.x = width + 10; else if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10; else if (p.y > height + 10) p.y = -10;

        // Soft radial glow instead of a hard-edged dot — reads as a diffuse
        // dust mote / bokeh light rather than flat, aliased static.
        const [cr, cg, cb] = p.warm ? [255, 107, 0] : [255, 244, 230];
        const peakA = p.warm ? p.a * 0.8 : p.a * 0.35;
        const dot = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        dot.addColorStop(0, `rgba(${cr},${cg},${cb},${peakA})`);
        dot.addColorStop(0.5, `rgba(${cr},${cg},${cb},${peakA * 0.35})`);
        dot.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = dot;
        ctx.fill();
      }
    }

    let raf = 0;
    let running = !reduced;
    const loop = () => {
      drawFrame();
      if (running) raf = requestAnimationFrame(loop);
    };

    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.tx = (e.clientX - rect.left) / rect.width;
      pointer.ty = (e.clientY - rect.top) / rect.height;
    };
    const onVisibility = () => {
      if (reduced) return;
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(loop);
      }
    };

    resize();
    if (reduced) drawFrame();
    else raf = requestAnimationFrame(loop);
    window.addEventListener("resize", resize);
    // Window-level so the texture reacts even though hero content sits above it.
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 w-full h-full" />;
}
