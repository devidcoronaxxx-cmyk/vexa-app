"use client";

import { useEffect, useRef, useState } from "react";

const INTER = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const MONO = "'JetBrains Mono', monospace";

type Tok = [string, string];

const C = {
  kw: "#c4b5fd",
  id: "#e5e7eb",
  fn: "#7dd3fc",
  svc: "#38bdf8",
  str: "#fcd846",
  num: "#fdba74",
  cm: "#64748b",
  plain: "#a1a1aa",
};

const CODE: Tok[][] = [
  [["-- Vexa generated combat system", C.cm]],
  [["", C.plain]],
  [["local ", C.kw], ["Players", C.id], [" = ", C.plain], ["game:GetService", C.svc], ["(", C.plain], ['"Players"', C.str], [")", C.plain]],
  [["", C.plain]],
  [["local ", C.kw], ["Combat", C.id], [" = {} ", C.plain], ["-- module", C.cm]],
  [["Combat.__index", C.id], [" = ", C.plain], ["Combat", C.id]],
  [["", C.plain]],
  [["function ", C.kw], ["Combat.new", C.id], ["(", C.plain], ["player", C.id], [")", C.plain]],
  [["    ", C.plain], ["local ", C.kw], ["self", C.id], [" = ", C.plain], ["setmetatable({}, Combat)", C.plain]],
  [["    ", C.plain], ["self.player", C.id], [" = ", C.plain], ["player", C.id]],
  [["    ", C.plain], ["self.damage", C.id], [" = ", C.plain], ["25", C.num]],
  [["    ", C.plain], ["self.armor", C.id], [" = ", C.plain], ["10", C.num]],
  [["    ", C.plain], ["return ", C.kw], ["self", C.id]],
  [["end", C.kw]],
  [["", C.plain]],
  [["function ", C.kw], ["Combat", C.id], [":dealDamage", C.fn], ["(", C.plain], ["target", C.id], [")", C.plain]],
  [["    ", C.plain], ["local ", C.kw], ["health", C.id], [" = ", C.plain], ["target:FindFirstChild", C.svc], ["(", C.plain], ['"Health"', C.str], [")", C.plain]],
  [["    ", C.plain], ["if ", C.kw], ["health ", C.plain], ["then", C.kw]],
  [["        ", C.plain], ["health.Value", C.id], [" -= ", C.plain], ["self.damage", C.id]],
  [["    ", C.plain], ["end", C.kw]],
  [["end", C.kw]],
  [["", C.plain]],
  [["return ", C.kw], ["Combat", C.id]],
];

const TREE = [
  { label: "Workspace", depth: 0, open: true, active: false },
  { label: "CombatSystem", depth: 1, open: true, active: false },
  { label: "DamageHandler (ModuleScript)", depth: 2, open: false, active: false },
  { label: "Health (NumberValue)", depth: 2, open: false, active: false },
  { label: "Hitboxes (Folder)", depth: 2, open: false, active: false },
  { label: "combat_system.lua", depth: 2, open: false, active: true },
];

function lineGap(i: number): number {
  const gaps: Record<number, number> = { 0: 0, 7: 320, 15: 420 };
  return gaps[i] ?? 160;
}

export function IdeMock() {
  const [count, setCount] = useState(1);
  const [done, setDone] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState("");

  useEffect(() => {
    let alive = true;
    let t: ReturnType<typeof setTimeout>;
    const run = () => {
      let i = 0;
      const step = () => {
        if (!alive) return;
        i += 1;
        if (i <= CODE.length) {
          setCount(i);
          t = setTimeout(step, lineGap(i - 1) + (i === CODE.length ? 1400 : 0));
        } else {
          setDone(true);
          t = setTimeout(() => {
            setDone(false);
            setCount(0);
            t = setTimeout(step, 400);
          }, 3200);
        }
      };
      t = setTimeout(step, 500);
    };
    run();
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, []);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt(`perspective(1400px) rotateY(${(px * 7).toFixed(2)}deg) rotateX(${(-py * 6).toFixed(2)}deg)`);
  };

  const onLeave = () => setTilt("perspective(1400px) rotateY(0deg) rotateX(0deg)");

  const caret = (
    <span style={{ display: "inline-block", width: 2, height: 13, background: "#fcd846", verticalAlign: "-2px", animation: "vxBlink2 1s steps(1) infinite", marginLeft: 1 }} />
  );

  return (
    <div ref={wrapRef} onMouseMove={onMove} onMouseLeave={onLeave} style={{ position: "relative", width: "100%", maxWidth: 880, margin: "0 auto", perspective: 1400 }}>
      {/* glow under */}
      <div aria-hidden style={{ position: "absolute", left: "50%", top: "62%", transform: "translateX(-50%)", width: "92%", height: 240, background: "radial-gradient(ellipse, rgba(252,216,70,0.18), rgba(124,92,255,0.16) 45%, transparent 70%)", filter: "blur(60px)", zIndex: 0, pointerEvents: "none" }} />

      {/* window */}
      <div
        ref={tiltRef}
        style={{
          position: "relative",
          zIndex: 2,
          transform: tilt,
          transition: "transform 0.12s ease-out",
          transformStyle: "preserve-3d",
          borderRadius: 16,
          background: "linear-gradient(180deg, #0d0d11, #08080b)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 40px 120px rgba(0,0,0,0.6), 0 0 60px rgba(124,92,255,0.12), inset 0 1px 0 rgba(255,255,255,0.12)",
          overflow: "hidden",
          fontFamily: MONO,
        }}
      >
        {/* top bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
          <span style={{ display: "flex", gap: 6 }}>
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#ff5f57" }} />
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#febc2e" }} />
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#28c840" }} />
          </span>
          <span style={{ flex: 1, textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 500, fontFamily: INTER, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#fcd846", boxShadow: "0 0 8px rgba(252,216,70,0.7)", animation: "vxBlink2 2s ease-in-out infinite" }} />
            Vexa — combat_system.lua
          </span>
          <span style={{ fontSize: 11, color: "#fcd846", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 100, background: "rgba(252,216,70,0.1)", border: "1px solid rgba(252,216,70,0.25)" }}>
            Inserted into Studio ✓
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", minHeight: 340 }}>
          {/* explorer */}
          <div className="vx-ide-explorer" style={{ borderRight: "1px solid rgba(255,255,255,0.06)", padding: "14px 10px", background: "rgba(255,255,255,0.012)" }}>
            <div style={{ fontSize: 10, letterSpacing: "1.2px", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", fontWeight: 700, marginBottom: 12, fontFamily: INTER }}>Explorer</div>
            {TREE.map((n, i) => (
              <div key={i} style={{ padding: "4px 6px 4px " + (8 + n.depth * 14) + "px", fontSize: 11.5, color: n.active ? "#fcd846" : "rgba(255,255,255,0.55)", background: n.active ? "rgba(252,216,70,0.08)" : "transparent", borderRadius: 6, marginBottom: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {n.open ? "▾ " : "▸ "}
                {n.label}
              </div>
            ))}
          </div>

          {/* code */}
          <div style={{ padding: "14px 16px 10px", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: INTER }}>combat_system.lua</span>
              <span style={{ fontSize: 10, color: "rgba(252,216,70,0.6)", border: "1px solid rgba(252,216,70,0.2)", borderRadius: 6, padding: "1px 7px", fontFamily: INTER }}>Luau · Strict</span>
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.75, whiteSpace: "pre" }}>
              {CODE.slice(0, count).map((line, i) => (
                <div key={i} style={{ display: "flex" }}>
                  <span style={{ width: 30, flexShrink: 0, textAlign: "right", paddingRight: 14, color: "rgba(255,255,255,0.18)", userSelect: "none", fontSize: 11.5 }}>{i + 1}</span>
                  <span style={{ flex: 1, color: C.plain }}>
                    {line.map(([t, c], j) => (
                      <span key={j} style={{ color: c }}>{t}</span>
                    ))}
                    {i === count - 1 && !done && caret}
                  </span>
                </div>
              ))}
              {done && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, color: "#fcd846" }}>
                  <span>✓ Generated 3 files — DamageHandler, Health, Hitboxes</span>
                  <span style={{ color: "rgba(252,216,70,0.5)", fontSize: 11, fontFamily: INTER }}>inserted into Workspace</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* status bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "7px 14px", borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)", fontSize: 11, color: "rgba(255,255,255,0.45)", fontFamily: INTER, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#fcd846", fontWeight: 600 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            Ready — all systems generated
          </span>
          <span style={{ display: "inline-flex", gap: 14 }}>
            <span>Luau · Strict</span>
            <span>LSP ✓</span>
            <span style={{ color: "#a78bfa" }}>v0.9.0</span>
          </span>
        </div>
      </div>

      {/* reflection */}
      <div aria-hidden style={{ position: "relative", zIndex: 1, height: 70, marginTop: -16, width: "92%", marginLeft: "auto", marginRight: "auto", background: "linear-gradient(180deg, rgba(252,216,70,0.06), transparent 90%)", transform: "scaleY(-1)", WebkitMaskImage: "linear-gradient(#000, transparent 85%)", maskImage: "linear-gradient(#000, transparent 85%)", opacity: 0.5, pointerEvents: "none" }} />

      {/* floating chips */}
      {[
        { text: "100% Free", x: -6, y: -8, d: "0s" },
        { text: "Typed Luau", x: -12, y: 72, d: "0.6s" },
        { text: "Moon Animator", x: -4, y: 150, d: "1.1s" },
        { text: "Studio Plugin", x: -9, y: 8, d: "1.6s" },
      ].map((ch, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: ch.x,
            top: ch.y,
            zIndex: 3,
            padding: "7px 14px",
            borderRadius: 100,
            fontSize: 12,
            fontWeight: 700,
            fontFamily: INTER,
            background: "rgba(13,13,17,0.85)",
            border: "1px solid rgba(252,216,70,0.3)",
            color: "#e5e7eb",
            boxShadow: "0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
            animation: `vxFloatChip 4.5s ease-in-out ${ch.d} infinite`,
            backdropFilter: "blur(10px)",
          }}
        >
          <span style={{ color: "#fcd846" }}>◆ </span>
          {ch.text}
        </span>
      ))}
    </div>
  );
}
