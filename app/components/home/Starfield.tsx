"use client";

import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  z: number;
  r: number;
  tw: number;
  phase: number;
  colorIndex: number;
}

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
}

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let raf = 0;
    let stars: Star[] = [];
    let meteors: Meteor[] = [];
    const mouse = { x: -9999, y: -9999 };
    const glow = { x: -9999, y: -9999 };
  const colorPalette = [
    [210, 205, 255],
    [173, 159, 255],
    [139, 92, 246],
    [244, 114, 182],
    [255, 189, 221],
  ];

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = w + "px";
      canvas!.style.height = h + "px";
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function seed() {
      const count = Math.round(((w * h) / 6500) * 1.4);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random() * 0.9 + 0.1,
        r: Math.random() * 1.3 + 0.3,
        tw: Math.random() * 0.02 + 0.004,
        phase: Math.random() * Math.PI * 2,
        colorIndex: Math.floor(Math.random() * colorPalette.length),
      }));
    }

    function spawnMeteor() {
      const colorIdx = Math.floor(Math.random() * colorPalette.length);
      const rgb = colorPalette[colorIdx];
      const color = `rgba(${rgb[0]},${rgb[1]},${rgb[2]})`;
      meteors.push({
        x: Math.random() * w * 0.6 + w * 0.25,
        y: Math.random() * h * 0.25,
        vx: -(Math.random() * 1.6 + 2.2),
        vy: Math.random() * 1.1 + 1.4,
        life: 0,
        max: 70 + Math.random() * 40,
        color,
      });
    }

    function tick() {
      ctx!.clearRect(0, 0, w, h);

      // nebula glow following mouse (slow)
      glow.x += (mouse.x - glow.x) * 0.02;
      glow.y += (mouse.y - glow.y) * 0.02;
      const gx = glow.x < -9000 ? w * 0.5 : glow.x;
      const gy = glow.y < -9000 ? h * 0.35 : glow.y;
      const glowGrad = ctx!.createRadialGradient(gx, gy, 0, gx, gy, 420);
      glowGrad.addColorStop(0, "rgba(124,92,255,0.045)");
      glowGrad.addColorStop(0.5, "rgba(79,124,255,0.025)");
      glowGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx!.fillStyle = glowGrad;
      ctx!.fillRect(0, 0, w, h);

      // stars
      for (const s of stars) {
        s.phase += s.tw;
        const color = colorPalette[s.colorIndex];
        const a = 0.32 + 0.5 * (0.5 + 0.5 * Math.sin(s.phase));
        ctx!.beginPath();
        ctx!.arc(s.x, s.y, s.r * (0.6 + s.z * 0.8), 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${(a * 0.7 * s.z + 0.12).toFixed(3)})`;
        ctx!.fill();
      }

// meteors
      if (!reduceMotion && Math.random() < 0.012 && meteors.length < 3) spawnMeteor();
      meteors = meteors.filter((m) => m.life < m.max);
      for (const m of meteors) {
        m.x += m.vx;
        m.y += m.vy;
        m.life++;
        const grad = ctx!.createLinearGradient(m.x, m.y, m.x - m.vx * 14, m.y - m.vy * 14);
        grad.addColorStop(0, m.color);
        grad.addColorStop(1, "rgba(200,190,255,0)");
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = 1.2;
        ctx!.beginPath();
        ctx!.moveTo(m.x, m.y);
        ctx!.lineTo(m.x - m.vx * 14, m.y - m.vy * 14);
        ctx!.stroke();
      }

      // interactivity: mouse attraction to stars
      const distX = mouse.x - w / 2;
      const distY = mouse.y - h / 2;
      const dist = Math.sqrt(distX * distX + distY * distY);
      if (dist < 400 && !reduceMotion) {
        const force = (400 - dist) / 400;
        for (const s of stars) {
          const dx = (mouse.x - s.x) / 100 * force;
          const dy = (mouse.y - s.y) / 100 * force;
          s.x += dx;
          s.y += dy;
        }
      }

      raf = requestAnimationFrame(tick);
    }

    function onMove(e: MouseEvent) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }
    function onLeave() {
      mouse.x = -9999;
      mouse.y = -9999;
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseout", onLeave);
    document.addEventListener("visibilitychange", () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(tick);
    });
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.9 }}
    />
  );
}