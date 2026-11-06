"use client";

import { useEffect, useRef } from "react";

export function Aurora() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    let tx = 0;
    let ty = 0;
    let curX = 0;
    let curY = 0;
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      tx = (e.clientX - r.left - r.width / 2) / r.width;
      ty = (e.clientY - r.top - r.height / 2) / r.height;
    };
    const onLeave = () => {
      tx = 0;
      ty = 0;
    };

    const tick = () => {
      curX += (tx - curX) * 0.05;
      curY += (ty - curY) * 0.05;
      el.style.setProperty("--mx", curX.toFixed(4));
      el.style.setProperty("--my", curY.toFixed(4));
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseout", onLeave);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeave);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      style={{
        position: "absolute",
        inset: "-20%",
        overflow: "hidden",
        pointerEvents: "none",
        perspective: "1200px",
      }}
    >
      <style>{`
        .vx-aurora-band {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 140vmax;
          height: 140vmax;
          border-radius: 50%;
          filter: blur(90px);
          opacity: 0.55;
          transform: translate(-50%, -50%) translateZ(-120px)
            translate(calc(var(--mx, 0) * 60px), calc(var(--my, 0) * 60px));
          will-change: transform;
        }
        @keyframes vxAuroraSpin { from { transform: translate(-50%, -50%) rotate(0deg) translateZ(-120px) translate(calc(var(--mx, 0) * 60px), calc(var(--my, 0) * 60px)); } to { transform: translate(-50%, -50%) rotate(360deg) translateZ(-120px) translate(calc(var(--mx, 0) * 60px), calc(var(--my, 0) * 60px)); } }
        .vx-aurora-a { background: conic-gradient(from 90deg at 50% 50%, rgba(124,92,255,0.35), rgba(56,189,248,0.18), rgba(244,114,182,0.16), rgba(124,92,255,0.35)); animation: vxAuroraSpin 60s linear infinite; }
        .vx-aurora-b { background: conic-gradient(from 200deg at 50% 50%, rgba(56,189,248,0.22), rgba(139,92,246,0.18), rgba(52,211,153,0.10), rgba(56,189,248,0.22)); animation: vxAuroraSpin 90s linear infinite reverse; opacity: 0.4; }
      `}</style>
      <div className="vx-aurora-band vx-aurora-a" />
      <div className="vx-aurora-band vx-aurora-b" />
    </div>
  );
}
