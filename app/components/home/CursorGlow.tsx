"use client";

import { useEffect, useRef } from "react";

export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || window.matchMedia("(pointer: coarse)").matches) return;

    let raf = 0;
    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let x = tx;
    let y = ty;
    let hoverScale = 1;

    const onMove = (e: MouseEvent) => {
      tx = e.clientX;
      ty = e.clientY;
    };

    const onEnter = () => {
      hoverScale = 1.3;
    };

    const onLeave = () => {
      hoverScale = 1;
    };

    const loop = () => {
      const targetX = tx;
      const targetY = ty;
      x += (targetX - x) * 0.15 * hoverScale;
      y += (targetY - y) * 0.15 * hoverScale;
      const scaled = 300 * hoverScale;
      el.style.transform = `translate(${x - scaled}px, ${y - scaled}px)`;
      el.style.boxShadow = `
        0 0 20px rgba(124,92,255,0.25 * ${hoverScale}),
        0 0 40px rgba(56,189,248,0.18 * ${hoverScale})
      `;
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("mousemove", onMove);
    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: 600,
        height: 600,
        borderRadius: "50%",
        pointerEvents: "none",
        zIndex: 0,
        background: "radial-gradient(circle, rgba(124,92,255,0.09) 0%, rgba(56,189,248,0.05) 35%, transparent 70%)",
        willChange: "transform, box-shadow",
      }}
    />
  );
}
