"use client";
import { useEffect, useRef } from "react";

// Cursor-reactive "darkroom" texture: drifting dust/bokeh particles over a
// near-black base, with a soft safelight glow that eases toward the pointer
// and gently pushes particles aside. Canvas 2D, no dependencies.
//
// Performance (this runs behind the whole first screen, so it has to be cheap):
//  • Only animates while the hero is on screen and the tab is visible —
//    scrolling the rest of the page costs nothing.
//  • Each particle is a pre-rendered sprite (drawn once per size/colour), so a
//    frame is ~90 drawImage calls instead of ~90 gradient builds.
//  • Soft glows don't need Retina pixels: rendered at ≤1.5× on desktop, 1× on
//    touch devices, and at 30fps on touch devices (slow drift looks the same).
export default function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const canvas: HTMLCanvasElement = canvasEl;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;
    const ctx: CanvasRenderingContext2D = context;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const touch = window.matchMedia("(pointer: coarse)").matches;
    const minFrameMs = touch ? 1000 / 30 : 0;

    let width = 0;
    let height = 0;
    const pointer = { x: 0.5, y: 0.4, tx: 0.5, ty: 0.4 };

    type Particle = {
      x: number; y: number; r: number;
      vx: number; vy: number; a: number; sprite: HTMLCanvasElement;
    };
    let particles: Particle[] = [];

    // One soft-dot sprite per (colour, radius), reused every frame.
    const sprites = new Map<string, HTMLCanvasElement>();
    function sprite(warm: boolean, r: number, dpr: number): HTMLCanvasElement {
      const key = `${warm}-${r}-${dpr}`;
      const hit = sprites.get(key);
      if (hit) return hit;
      const size = Math.ceil(r * 2 * dpr);
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const g = c.getContext("2d")!;
      const [cr, cg, cb] = warm ? [255, 107, 0] : [255, 244, 230];
      const peak = warm ? 0.8 : 0.35; // scaled per particle via globalAlpha
      const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, `rgba(${cr},${cg},${cb},${peak})`);
      grad.addColorStop(0.5, `rgba(${cr},${cg},${cb},${peak * 0.35})`);
      grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
      sprites.set(key, c);
      return c;
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, touch ? 1 : 1.5);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(90, Math.max(32, Math.round(width / 18)));
      particles = Array.from({ length: count }, () => {
        const warm = Math.random() < 0.35;
        const r = 3 + Math.round(Math.random() * 7); // integer radii → few sprites
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          r,
          vx: (Math.random() - 0.5) * 0.15,
          vy: (Math.random() - 0.5) * 0.15,
          a: 0.15 + Math.random() * 0.55,
          sprite: sprite(warm, r, dpr),
        };
      });
    }

    function drawFrame(steps: number) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#0A0A0A";
      ctx.fillRect(0, 0, width, height);

      pointer.x += (pointer.tx - pointer.x) * 0.06 * steps;
      pointer.y += (pointer.ty - pointer.y) * 0.06 * steps;
      const gx = pointer.x * width;
      const gy = pointer.y * height;

      const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(width, height) * 0.55);
      glow.addColorStop(0, "rgba(255,107,0,0.16)");
      glow.addColorStop(0.35, "rgba(255,107,0,0.05)");
      glow.addColorStop(1, "rgba(255,107,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      const rad = 160;
      for (const p of particles) {
        p.x += p.vx * steps;
        p.y += p.vy * steps;
        const dx = p.x - gx;
        const dy = p.y - gy;
        const d2 = dx * dx + dy * dy;
        if (d2 < rad * rad && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = ((rad - d) / rad) * 0.6 * steps;
          p.x += (dx / d) * push;
          p.y += (dy / d) * push;
        }
        if (p.x < -10) p.x = width + 10; else if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10; else if (p.y > height + 10) p.y = -10;

        ctx.globalAlpha = p.a;
        ctx.drawImage(p.sprite, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      }
    }

    let raf = 0;
    let last = 0;
    let onScreen = true;
    let running = false;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const elapsed = now - last;
      if (elapsed < minFrameMs) return;
      // Scale movement by elapsed time so 30fps drifts at the same speed as 60fps.
      drawFrame(last ? Math.min(elapsed / (1000 / 60), 3) : 1);
      last = now;
    };
    const start = () => {
      if (running || reduced || !onScreen || document.hidden) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const onPointer = (e: PointerEvent) => {
      if (!running) return;
      const rect = canvas.getBoundingClientRect();
      pointer.tx = (e.clientX - rect.left) / rect.width;
      pointer.ty = (e.clientY - rect.top) / rect.height;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) start(); else stop();
    });

    const onResize = () => {
      resize();
      if (!running) drawFrame(1);
    };

    resize();
    drawFrame(1);
    observer.observe(canvas);
    start();
    window.addEventListener("resize", onResize);
    // Window-level so the texture reacts even though hero content sits above it.
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 w-full h-full" />;
}
