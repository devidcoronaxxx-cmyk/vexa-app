"use client";

import React, { useRef } from "react";

const ICONS: Record<string, React.ReactElement> = {
  roblox: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="8" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </svg>
  ),
  plugin: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  ),
  free: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  models: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.07 4.93A10 10 0 0 0 2.93 19.07M4.93 4.93a10 10 0 0 0 14.14 14.14" />
    </svg>
  ),
  simple: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  code: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  ),
};

interface Feature {
  title: string;
  desc: string;
  color: string;
  glow: string;
  icon: string;
}

/* ---- mini visual decorations ---- */

function Vignette({ color }: { color: string }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        right: -40,
        top: -40,
        width: 220,
        height: 220,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color}26, transparent 70%)`,
        filter: "blur(6px)",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}

function OrbitVisual({ color }: { color: string }) {
  return (
    <div aria-hidden style={{ position: "absolute", right: 14, bottom: 10, width: 88, height: 88, opacity: 0.9, pointerEvents: "none", zIndex: 0 }}>
      <style>{`@keyframes vxBentoOrbit { from { transform: rotate(0deg) translateX(30px) rotate(0deg); } to { transform: rotate(360deg) translateX(30px) rotate(-360deg); } }`}</style>
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `1px solid ${color}33` }}>
        <span style={{ position: "absolute", left: "50%", top: "50%", width: 9, height: 9, margin: -4, borderRadius: "50%", background: color, boxShadow: `0 0 14px ${color}`, animation: "vxBentoOrbit 5s linear infinite" }} />
      </div>
      <span style={{ position: "absolute", left: "50%", top: "50%", width: 13, height: 13, margin: -6, borderRadius: "50%", background: "radial-gradient(circle, #fff, " + color + ")", boxShadow: `0 0 18px ${color}88` }} />
    </div>
  );
}

function ChipsVisual() {
  const chips = ["Fast", "Pro", "Balanced", "Precise"];
  return (
    <div aria-hidden style={{ position: "absolute", right: 14, bottom: 12, display: "flex", gap: 6, flexWrap: "wrap", maxWidth: 190, justifyContent: "flex-end", pointerEvents: "none", zIndex: 0 }}>
      {chips.map((c, i) => (
        <span key={c} style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.5px", padding: "3px 9px", borderRadius: 100, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", animation: `vxBentoChip 3.6s ease-in-out ${i * 0.5}s infinite` }}>
          {c}
        </span>
      ))}
      <style>{`@keyframes vxBentoChip { 0%,100% { transform: translateY(0); opacity: 0.6; } 50% { transform: translateY(-4px); opacity: 1; } }`}</style>
    </div>
  );
}

function LayersVisual() {
  return (
    <div aria-hidden style={{ position: "absolute", right: 14, bottom: 12, width: 130, height: 70, pointerEvents: "none", zIndex: 0 }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 8, background: "rgba(252,216,70,0.12)", border: "1px solid rgba(252,216,70,0.3)", transform: "translateY(-8px)", animation: "vxBentoLayerA 4s ease-in-out infinite" }} />
      <div style={{ position: "absolute", inset: "0 26px", borderRadius: 8, background: "rgba(167,139,250,0.10)", border: "1px solid rgba(167,139,250,0.25)", transform: "translateY(6px)", animation: "vxBentoLayerB 4s ease-in-out infinite" }} />
      <div style={{ position: "absolute", inset: "0 52px", borderRadius: 8, background: "rgba(196,181,253,0.10)", border: "1px solid rgba(196,181,253,0.25)", transform: "translateY(18px)", animation: "vxBentoLayerC 4s ease-in-out infinite" }} />
      <style>{`
        @keyframes vxBentoLayerA { 0%,100% { transform: translateY(-8px) } 50% { transform: translateY(-12px) } }
        @keyframes vxBentoLayerB { 0%,100% { transform: translateY(6px) } 50% { transform: translateY(2px) } }
        @keyframes vxBentoLayerC { 0%,100% { transform: translateY(18px) } 50% { transform: translateY(14px) } }
      `}</style>
    </div>
  );
}

function FlameVisual({ color }: { color: string }) {
  return (
    <div aria-hidden style={{ position: "absolute", right: 16, bottom: 12, width: 70, height: 84, pointerEvents: "none", zIndex: 0 }}>
      <style>{`@keyframes vxBentoFlame { 0%,100% { transform: scaleY(1) translateY(0); } 50% { transform: scaleY(1.22) translateY(-5px); } }`}</style>
      <div style={{ position: "absolute", left: 20, bottom: 0, width: 30, height: 58, borderRadius: "50% 50% 44% 44%", background: `radial-gradient(circle at 50% 100%, ${color}55, ${color}22)`, filter: "blur(2px)", transformOrigin: "bottom", animation: "vxBentoFlame 0.9s ease-in-out infinite" }} />
      <div style={{ position: "absolute", left: 27, bottom: 0, width: 16, height: 40, borderRadius: "50% 50% 44% 44%", background: `radial-gradient(circle at 50% 100%, ${color}99, ${color}33)`, filter: "blur(1px)", transformOrigin: "bottom", animation: "vxBentoFlame 0.7s ease-in-out infinite 0.15s" }} />
    </div>
  );
}

function ArrowVisual() {
  return (
    <div aria-hidden style={{ position: "absolute", right: 16, bottom: 12, pointerEvents: "none", zIndex: 0 }}>
      <svg width="86" height="40" viewBox="0 0 86 40" fill="none">
        <path d="M6 32 C 30 30, 46 14, 80 8" stroke="url(#vxArrowGrad)" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 6" />
        <defs>
          <linearGradient id="vxArrowGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7c5cff" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#7c5cff" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function CodeLineVisual() {
  return (
    <div aria-hidden style={{ position: "absolute", right: 16, bottom: 12, width: 210, display: "flex", flexDirection: "column", gap: 5, pointerEvents: "none", zIndex: 0 }}>
      <div style={{ height: 5, width: "88%", borderRadius: 3, background: "linear-gradient(90deg, #a78bfa55, #fcd84622)" }} />
      <div style={{ height: 5, width: "64%", borderRadius: 3, background: "linear-gradient(90deg, #fcd84655, transparent)" }} />
      <div style={{ height: 5, width: "76%", borderRadius: 3, background: "linear-gradient(90deg, #c4b5fd55, transparent)" }} />
    </div>
  );
}

/* ---- bento spans ---- */

const SPANS = [2, 2, 2, 3, 3, 6, 3, 3];

function visualFor(i: number, f: Feature): React.ReactElement {
  switch (i) {
    case 3: return <ChipsVisual />;
    case 4: return <FlameVisual color="#a78bfa" />;
    case 5: return <CodeLineVisual />;
    case 6: return <OrbitVisual color="#fcd846" />;
    case 7: return <ArrowVisual />;
    case 2: return <LayersVisual />;
    default: return <Vignette color={f.color} />;
  }
}

export function FeatureCards({ features }: { features: Feature[] }) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget as HTMLDivElement;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--sx", `${e.clientX - r.left}px`);
    el.style.setProperty("--sy", `${e.clientY - r.top}px`);
    el.style.setProperty("--sa", "1");
  };

  return (
    <div ref={ref} style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14, width: "100%", textAlign: "left" }}>
      {features.map((f, i) => {
        const span = SPANS[i] ?? 2;
        return (
          <div
            key={i}
            style={{
              gridColumn: `span ${span}`,
              background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 16,
              padding: "clamp(20px, 3.5vw, 26px)",
              backdropFilter: "blur(var(--glass-blur))",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07)",
              transition: "transform 0.2s cubic-bezier(0.16,1,0.3,1), border-color 0.2s, box-shadow 0.2s",
              cursor: "default",
              minWidth: 0,
              position: "relative",
              overflow: "hidden",
            }}
            onMouseMove={onMove}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.borderColor = f.color + "55";
              el.style.transform = "translateY(-4px)";
              el.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,0.07), 0 20px 60px rgba(0,0,0,0.45), 0 0 40px ${f.color}22`;
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.borderColor = "rgba(255,255,255,0.09)";
              el.style.transform = "translateY(0)";
              el.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.07)";
              el.style.setProperty("--sa", "0");
            }}
          >
            <div
              className="vx-spotlight"
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                opacity: "var(--sa, 0)",
                background: "radial-gradient(500px circle at var(--sx, 50%) var(--sy, 50%), rgba(252,216,70,0.10), transparent 45%)",
                transition: "opacity 0.25s ease",
                zIndex: 1,
              }}
            />
            {visualFor(i, f)}
            <div style={{ position: "relative", zIndex: 2 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                  flexShrink: 0,
                  color: f.color,
                  background: `linear-gradient(180deg, ${f.color}22, ${f.glow})`,
                  border: `1px solid ${f.color}38`,
                  boxShadow: `0 6px 20px ${f.color}1c, inset 0 1px 0 rgba(255,255,255,0.12)`,
                }}
              >
                {ICONS[f.icon] ?? ICONS.code}
              </div>
              <h3 style={{ fontSize: 15.5, fontWeight: 700, color: "#fff", letterSpacing: "-0.3px", marginBottom: 7, fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>{f.title}</h3>
              <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, margin: 0, maxWidth: 460 }}>{f.desc}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
