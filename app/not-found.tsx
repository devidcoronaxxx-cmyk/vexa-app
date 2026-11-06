"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

export default function NotFound() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d")!;

    const W = canvas.width;
    const H = canvas.height;

    type Star = {
      sx: number; sy: number;
      tx: number; ty: number;
      nfx: number; nfy: number;
      x: number; y: number;
      size: number; alpha: number;
      speed: number;
      twinkle: number; twinkleSpeed: number;
      hue: number;
      progress: number;
    };

    const step = 4;
    let stars: Star[] = [];
    let frame = 0;
    let animId: number;

    type Phase = "404" | "notfound";
    let phase: Phase = "404";
    let phaseStart = 0;
    const FPS = 60;
    const PHASE_DURATIONS: Record<Phase, number> = {
      "404":      5 * FPS,
      "notfound": 5 * FPS,
    };

    function sampleGlyph(text: string, font: string): { x: number; y: number }[] {
      const off = document.createElement("canvas");
      off.width = W;
      off.height = H;
      const octx = off.getContext("2d")!;
      octx.fillStyle = "#fff";
      octx.font = font;
      octx.textAlign = "center";
      octx.textBaseline = "middle";
      octx.fillText(text, W / 2, H / 2);
      const d = octx.getImageData(0, 0, W, H).data;
      const pts: { x: number; y: number }[] = [];
      for (let y = 0; y < H; y += step) {
        for (let x = 0; x < W; x += step) {
          if (d[(y * W + x) * 4 + 3] > 128) pts.push({ x, y });
        }
      }
      return pts;
    }

    function buildStars(
      pts404: { x: number; y: number }[],
      ptsNF:  { x: number; y: number }[]
    ): Star[] {
      const count = Math.max(pts404.length, ptsNF.length);
      const next: Star[] = [];
      for (let i = 0; i < count; i++) {
        const p4  = pts404[i % pts404.length];
        const pnf = ptsNF[i % ptsNF.length];
        next.push({
          sx:  Math.random() * W,
          sy:  Math.random() * H,
          tx:  p4.x  + (Math.random() - 0.5) * 3,
          ty:  p4.y  + (Math.random() - 0.5) * 3,
          nfx: pnf.x + (Math.random() - 0.5) * 3,
          nfy: pnf.y + (Math.random() - 0.5) * 3,
          x:   Math.random() * W,
          y:   Math.random() * H,
          size: Math.random() * 1.4 + 0.4,
          alpha: 0,
          speed: Math.random() * 0.04 + 0.02,
          twinkle: Math.random() * Math.PI * 2,
          twinkleSpeed: Math.random() * 0.03 + 0.01,
          hue: Math.random() < 0.25 ? 260 : 0,
          progress: Math.random() * -0.5,
        });
      }
      return next;
    }

    function drawFrame() {
      ctx.clearRect(0, 0, W, H);
      frame++;

      const elapsed = frame - phaseStart;
      const dur = PHASE_DURATIONS[phase];

      if (elapsed >= dur) {
        phaseStart = frame;
        phase = phase === "404" ? "notfound" : "404";
      }

      for (const s of stars) {
        s.progress = Math.min(1, s.progress + s.speed * 0.4);
        if (s.progress < 0) continue;

        let tx: number, ty: number;

        if (phase === "404") { tx = s.tx;  ty = s.ty;  }
        else                 { tx = s.nfx; ty = s.nfy; }

        s.x = s.x + (tx - s.x) * 0.05;
        s.y = s.y + (ty - s.y) * 0.05;
        s.alpha = s.progress * (0.6 + 0.4 * Math.sin(frame * s.twinkleSpeed + s.twinkle));

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);

        if (s.hue === 260) {
          ctx.fillStyle = `hsla(260,70%,85%,${s.alpha})`;
          if (s.size > 1) {
            ctx.shadowBlur  = 6;
            ctx.shadowColor = `hsla(260,80%,80%,0.7)`;
          }
        } else {
          ctx.fillStyle = `rgba(255,255,255,${s.alpha})`;
          if (s.size > 1) {
            ctx.shadowBlur  = 4;
            ctx.shadowColor = `rgba(255,255,255,0.6)`;
          }
        }

        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animId = requestAnimationFrame(drawFrame);
    }

    document.fonts.ready.then(() => {
      const font404 = `bold ${Math.floor(H * 0.85)}px Syne, sans-serif`;
      const fontNF  = `bold ${Math.floor(H * 0.42)}px Syne, sans-serif`;

      stars = buildStars(
        sampleGlyph("404",       font404),
        sampleGlyph("NOT FOUND", fontNF)
      );

      drawFrame();
    });

    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <>
      <style>{`
        body {
          overflow: hidden;
          background: #050507;
        }
        @keyframes nfDrift { 0% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(4%,-6%,0) scale(1.12); } 100% { transform: translate3d(0,0,0) scale(1); } }
        @keyframes nfDrift2 { 0% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(-5%,5%,0) scale(1.15); } 100% { transform: translate3d(0,0,0) scale(1); } }
        .nf-aur { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
        .nf-blob { position: absolute; border-radius: 50%; filter: blur(120px); will-change: transform; }
        .nf-blob-a { width: 55vw; height: 55vw; left: -18vw; top: -16vw; background: rgba(252,216,70,0.14); animation: nfDrift 22s ease-in-out infinite; }
        .nf-blob-b { width: 50vw; height: 50vw; right: -16vw; top: -8vw; background: rgba(167,139,250,0.18); animation: nfDrift2 26s ease-in-out infinite; }
        .nf-blob-c { width: 46vw; height: 46vw; left: 28vw; bottom: -22vw; background: rgba(196,181,253,0.12); animation: nfDrift 30s ease-in-out infinite reverse; }
      `}</style>

      <div className="nf-aur" aria-hidden>
        <div className="nf-blob nf-blob-a" />
        <div className="nf-blob nf-blob-b" />
        <div className="nf-blob nf-blob-c" />
      </div>

      <div className="grid-overlay" />

      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "32px 16px",
        position: "relative",
      }}>
        <div style={{ maxWidth: 520, position: "relative", zIndex: 2 }}>
          <canvas
            ref={canvasRef}
            width={520}
            height={160}
            style={{ display: "block", margin: "0 auto 24px", background: "transparent" }}
          />

          <div style={{
            fontFamily: "var(--font-head)",
            color: "#fcd846",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontSize: "0.85rem",
            marginBottom: 10,
          }}>
            Lost in space
          </div>

          <p style={{
            color: "#fff",
            marginBottom: 32,
            lineHeight: 1.7,
            fontSize: "0.95rem",
          }}>
            This page drifted off into the void.<br />
            It might have moved or never existed.
          </p>

          <Link
            href="/dashboard"
            style={{
              color: "#ffe98a",
              fontSize: "0.9rem",
              letterSpacing: "0.04em",
              textDecoration: "none",
              borderBottom: "1px solid rgba(217,249,157,0.3)",
              paddingBottom: 2,
              transition: "color 0.2s, border-color 0.2s",
            }}
            onMouseEnter={e => {
              (e.target as HTMLElement).style.color = "#fcd846";
              (e.target as HTMLElement).style.borderBottomColor = "rgba(252,216,70,0.7)";
            }}
            onMouseLeave={e => {
              (e.target as HTMLElement).style.color = "#ffe98a";
              (e.target as HTMLElement).style.borderBottomColor = "rgba(217,249,157,0.3)";
            }}
          >
            Return to dashboard
          </Link>
        </div>
      </div>
    </>
  );
}