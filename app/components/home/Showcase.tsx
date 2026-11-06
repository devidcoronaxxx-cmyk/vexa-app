"use client";

import { useEffect, useRef, useState } from "react";

const INTER = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/* ------------------------------------------------------------------ */
/* Scripting demo — typing code window                                 */
/* ------------------------------------------------------------------ */

const SCRIPT_LINES: { c: string; s: string }[][] = [
  [{ c: "#8b949e", s: "-- Vexa · DamageService" }],
  [{ c: "#ff7b72", s: "local" }, { c: "#c9d1d9", s: " Damage " }, { c: "#ff7b72", s: "= {" }],
  [{ c: "#ff7b72", s: "    Modifier" }, { c: "#79c0ff", s: " =" }, { c: "#ffa657", s: " 1.0" }, { c: "#79c0ff", s: "," }],
  [{ c: "#ff7b72", s: "}" }],
  [{ c: "#c9d1d9", s: "" }],
  [{ c: "#ff7b72", s: "function" }, { c: "#79c0ff", s: " Damage.apply" }, { c: "#ff7b72", s: "(" }, { c: "#c9d1d9", s: "target, amount" }, { c: "#ff7b72", s: ")" }],
  [{ c: "#ff7b72", s: "    local" }, { c: "#c9d1d9", s: " humanoid " }, { c: "#ff7b72", s: "= target:FindFirstChildOfClass" }, { c: "#79c0ff", s: "(" }, { c: "#a5d6ff", s: "'Humanoid'" }, { c: "#79c0ff", s: ")" }],
  [{ c: "#ff7b72", s: "    if" }, { c: "#c9d1d9", s: " humanoid " }, { c: "#ff7b72", s: "then" }],
  [{ c: "#ff7b72", s: "        humanoid:TakeDamage" }, { c: "#79c0ff", s: "(amount * " }, { c: "#c9d1d9", s: "Damage.Modifier" }, { c: "#79c0ff", s: ")" }],
  [{ c: "#ff7b72", s: "    end" }],
  [{ c: "#ff7b72", s: "end" }],
  [{ c: "#c9d1d9", s: "" }],
  [{ c: "#ff7b72", s: "return" }, { c: "#c9d1d9", s: " Damage" }],
];

function ScriptingDemo() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setCount((c) => (c + 1) % (SCRIPT_LINES.length + 4)), 240);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ textAlign: "left", fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, lineHeight: 1.9 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "11px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.25)" }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#ff5f57" }} />
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#febc2e" }} />
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#28c840" }} />
        <span style={{ marginLeft: 8, fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.3px" }}>DamageService.lua</span>
        <span style={{ marginLeft: "auto", fontSize: 9.5, fontWeight: 700, letterSpacing: "1px", padding: "2px 8px", borderRadius: 100, background: "rgba(62,207,142,0.14)", color: "#3ecf8e", border: "1px solid rgba(62,207,142,0.25)" }}>SAVED</span>
      </div>
      <div style={{ padding: "14px 16px", minHeight: 210, color: "#c9d1d9" }}>
        {SCRIPT_LINES.slice(0, count).map((tokens, i) => (
          <div key={i} style={{ whiteSpace: "pre-wrap" }}>
            {tokens.map((t, j) => (
              <span key={j} style={{ color: t.c }}>{t.s}</span>
            ))}
            {i === count - 1 && <span style={{ display: "inline-block", width: 7, height: 13, background: "#a78bfa", verticalAlign: "text-bottom", marginLeft: 1, animation: "vxBlink 0.85s step-end infinite" }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Animation demo — select real keyframe animations Vexa can generate  */
/* ------------------------------------------------------------------ */

type AnimDef = {
  id: string;
  name: string;
  file: string;
  poses: string[];
  accent: string;
};

const ANIMS: AnimDef[] = [
  { id: "walk", name: "Walk cycle", file: "WalkCycle.rbxm", poses: ["Contact", "Passing", "Contact", "Passing"], accent: "#a78bfa" },
  { id: "wave", name: "Wave hello", file: "WaveHello.rbxm", poses: ["Raise", "Wave", "Wave", "Lower"], accent: "#38bdf8" },
  { id: "punch", name: "Punch combo", file: "PunchCombo.rbxm", poses: ["Chamber", "Strike", "Recover"], accent: "#f472b6" },
  { id: "dance", name: "Dance groove", file: "DanceGroove.rbxm", poses: ["Groove A", "Groove B"], accent: "#fcd846" },
];

function AnimationDemo() {
  const [sel, setSel] = useState(0);
  const [pose, setPose] = useState(0);
  const anim = ANIMS[sel];

  useEffect(() => {
    const reset = requestAnimationFrame(() => setPose(0));
    const id = setInterval(() => setPose((p) => (p + 1) % anim.poses.length), 850);
    return () => {
      cancelAnimationFrame(reset);
      clearInterval(id);
    };
  }, [sel, anim.poses.length]);

  return (
    <div style={{ textAlign: "left", fontFamily: INTER }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center", padding: "10px 14px", flexWrap: "wrap" }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "linear-gradient(135deg,#a78bfa,#38bdf8)", display: "inline-block" }} />
          {anim.file}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {ANIMS.map((a, i) => (
            <button key={a.id} type="button" onClick={() => setSel(i)} style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 100, cursor: "pointer", fontFamily: INTER, background: i === sel ? `${a.accent}1c` : "rgba(255,255,255,0.04)", color: i === sel ? a.accent : "rgba(255,255,255,0.35)", border: "1px solid " + (i === sel ? `${a.accent}44` : "rgba(255,255,255,0.07)"), transition: "all 0.18s" }}>
              {a.name}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, letterSpacing: "1px", padding: "3px 9px", borderRadius: 100, background: "rgba(167,139,250,0.14)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)" }}>
          MOON ANIMATOR
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, padding: "0 14px 10px", flexWrap: "wrap" }}>
        {/* figure */}
        <div style={{ position: "relative", width: 150, height: 170, borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", background: "radial-gradient(circle at 50% 30%, rgba(124,92,255,0.08), rgba(0,0,0,0.3))", overflow: "hidden" }}>
          <style>{`
            @keyframes vxBlink { 50% { opacity: 0 } }
            @keyframes vxTrailA { 0%,100% { opacity: 0; transform: scaleX(0.6) } 40%,70% { opacity: 0.9; transform: scaleX(1) } }

            /* walk cycle */
            @keyframes wLegL { 0%,100% { transform: rotate(-26deg) } 50% { transform: rotate(26deg) } }
            @keyframes wLegR { 0%,100% { transform: rotate(26deg) } 50% { transform: rotate(-26deg) } }
            @keyframes wArmL { 0%,100% { transform: rotate(24deg) } 50% { transform: rotate(-24deg) } }
            @keyframes wArmR { 0%,100% { transform: rotate(-24deg) } 50% { transform: rotate(24deg) } }
            @keyframes wBody { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
            .a-walk .g-leg-l { transform-origin: 50% 0%; animation: wLegL 1.1s ease-in-out infinite; }
            .a-walk .g-leg-r { transform-origin: 50% 0%; animation: wLegR 1.1s ease-in-out infinite; }
            .a-walk .g-arm-l { transform-origin: 50% 0%; animation: wArmL 1.1s ease-in-out infinite; }
            .a-walk .g-arm-r { transform-origin: 50% 0%; animation: wArmR 1.1s ease-in-out infinite; }
            .a-walk .g-body { animation: wBody 1.1s ease-in-out infinite; }

            /* wave hello */
            @keyframes wvArm { 0%,100% { transform: rotate(78deg) } 50% { transform: rotate(120deg) } }
            @keyframes wvHead { 0%,100% { transform: rotate(6deg) } 50% { transform: rotate(-6deg) } }
            .a-wave .g-arm-r { transform-origin: 0% 0%; animation: wvArm 0.9s ease-in-out infinite; }
            .a-wave .g-head { transform-origin: 50% 100%; animation: wvHead 0.9s ease-in-out infinite; }

            /* punch combo */
            @keyframes pnArm { 0%,100% { transform: rotate(0deg) translate(0,0) } 38% { transform: rotate(-32deg) translate(26px,-10px) } 52% { transform: rotate(-30deg) translate(30px,-8px) } 75% { transform: rotate(-8deg) translate(6px,-4px) } }
            @keyframes pnBody { 0%,100% { transform: translateX(0) } 45% { transform: translateX(9px) } }
            .a-punch .g-arm-r { transform-origin: 0% 0%; animation: pnArm 1s cubic-bezier(.4,0,.2,1) infinite; }
            .a-punch .g-body { animation: pnBody 1s cubic-bezier(.4,0,.2,1) infinite; }

            /* dance groove */
            @keyframes dBody { 0%,100% { transform: rotate(-8deg) } 50% { transform: rotate(8deg) } }
            @keyframes dArmL { 0%,100% { transform: rotate(-60deg) } 50% { transform: rotate(60deg) } }
            @keyframes dArmR { 0%,100% { transform: rotate(60deg) } 50% { transform: rotate(-60deg) } }
            .a-dance .g-body { transform-origin: 50% 100%; animation: dBody 0.8s ease-in-out infinite; }
            .a-dance .g-arm-l { transform-origin: 0% 0%; animation: dArmL 0.8s ease-in-out infinite; }
            .a-dance .g-arm-r { transform-origin: 0% 0%; animation: dArmR 0.8s ease-in-out infinite; }
          `}</style>

          <svg className={"vx-figure a-" + anim.id} width="150" height="150" viewBox="0 0 150 150" style={{ position: "absolute", left: "50%", bottom: 18, marginLeft: -75, transformOrigin: "50% 100%" }}>
            {/* legs */}
            <g className="g-leg-l">
              <line x1="75" y1="104" x2="64" y2="138" stroke="#cfd3ff" strokeWidth="5" strokeLinecap="round" />
            </g>
            <g className="g-leg-r">
              <line x1="75" y1="104" x2="88" y2="138" stroke="#cfd3ff" strokeWidth="5" strokeLinecap="round" />
            </g>
            {/* torso */}
            <g className="g-body">
              <line x1="75" y1="66" x2="75" y2="104" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" />
              {/* head */}
              <g className="g-head">
                <circle cx="75" cy="50" r="12" fill="none" stroke="#ffffff" strokeWidth="5" />
              </g>
            </g>
            {/* back arm (hanging) */}
            <g className="g-arm-l">
              <line x1="75" y1="72" x2="60" y2="94" stroke="#b6b9e0" strokeWidth="5" strokeLinecap="round" />
            </g>
            {/* front arm (animated) */}
            <g className="g-arm-r">
              <line x1="75" y1="72" x2="92" y2="46" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
            </g>
          </svg>

          {/* slash trail for punch / swing anims */}
          {(anim.id === "punch" || anim.id === "walk") && (
            <svg className="vx-slash" width="70" height="50" viewBox="0 0 70 50" style={{ position: "absolute", right: 8, top: 26, transformOrigin: "100% 50%", animation: "vxTrailA 1.1s ease-in-out infinite", pointerEvents: "none" }}>
              <path d="M70 2 C 42 18, 24 34, 6 48" fill="none" stroke="url(#vxGrad)" strokeWidth="3.5" strokeLinecap="round" />
              <defs>
                <linearGradient id="vxGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity="1" />
                </linearGradient>
              </defs>
            </svg>
          )}
        </div>

        {/* keyframe timeline */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          {anim.poses.map((p, i) => (
            <div key={p} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setPose(i)}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: i === pose ? `linear-gradient(135deg,${anim.accent},#38bdf8)` : "rgba(255,255,255,0.14)", transition: "background 0.2s" }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: i === pose ? "#fff" : "rgba(255,255,255,0.35)", transition: "color 0.2s", minWidth: 70 }}>{p}</span>
              <span style={{ height: 2, flex: 1, borderRadius: 2, background: i === pose ? `linear-gradient(90deg,${anim.accent},#38bdf8)` : "rgba(255,255,255,0.08)", transition: "background 0.3s" }} />
              <span style={{ fontSize: 10, color: i === pose ? anim.accent : "rgba(255,255,255,0.2)", fontFamily: "'JetBrains Mono', monospace" }}>{0.3 * i}s</span>
            </div>
          ))}
          <div style={{ marginTop: "auto", display: "flex", gap: 8 }}>
            {["Linear", "EaseOut", "Bounce", "Smooth"].map((e, i) => (
              <span key={e} style={{ fontSize: 9.5, fontWeight: 600, padding: "2px 8px", borderRadius: 100, background: i === 1 ? "rgba(167,139,250,0.16)" : "rgba(255,255,255,0.04)", color: i === 1 ? "#c4b5fd" : "rgba(255,255,255,0.3)", border: "1px solid " + (i === 1 ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.06)") }}>
                {e}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* VFX demo — select real effects Vexa can generate (canvas)           */
/* ------------------------------------------------------------------ */

type VfxDef = {
  id: string;
  name: string;
  file: string;
  kind: "fire" | "bolt" | "burst" | "heal";
  accent: string;
  colors: string[];
  props: { label: string; val: string; w: number }[];
};

const VFXS: VfxDef[] = [
  { id: "fire", name: "Fire aura", file: "FireAura.particle", kind: "fire", accent: "#f97316", colors: ["#f97316", "#ef4444", "#fde047", "#fb923c"], props: [{ label: "Rate", val: "42/s", w: 55 }, { label: "Speed", val: "6.0", w: 40 }, { label: "Spread", val: "360°", w: 80 }, { label: "Lifetime", val: "0.8s", w: 25 }, { label: "Drag", val: "0.35", w: 20 }] },
  { id: "bolt", name: "Lightning strike", file: "LightningStrike.particle", kind: "bolt", accent: "#7dd3fc", colors: ["#e0f2fe", "#a5f3fc", "#7dd3fc", "#ffffff"], props: [{ label: "Rate", val: "1/s", w: 15 }, { label: "Jitter", val: "0.8", w: 60 }, { label: "Branches", val: "3", w: 40 }, { label: "Glow", val: "0.9", w: 75 }, { label: "Fade", val: "0.3s", w: 22 }] },
  { id: "burst", name: "Explosion", file: "Explosion.particle", kind: "burst", accent: "#fb923c", colors: ["#f97316", "#fbbf24", "#ef4444", "#fde68a"], props: [{ label: "Burst", val: "60", w: 80 }, { label: "Speed", val: "18", w: 70 }, { label: "Spread", val: "360°", w: 80 }, { label: "Lifetime", val: "1.2s", w: 40 }, { label: "Drag", val: "2.2", w: 35 }] },
  { id: "heal", name: "Heal orb", file: "HealOrb.particle", kind: "heal", accent: "#4ade80", colors: ["#4ade80", "#ffe98a", "#fde68a", "#bbf7d0"], props: [{ label: "Rate", val: "30/s", w: 45 }, { label: "Speed", val: "2.4", w: 30 }, { label: "Rise", val: "1.8", w: 50 }, { label: "Lifetime", val: "1.4s", w: 45 }, { label: "Pulse", val: "0.6", w: 30 }] },
];

function VfxDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sel, setSel] = useState(0);
  const vfx = VFXS[sel];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const colors = vfx.colors;
    const kind = vfx.kind;

    interface P { x: number; y: number; vx: number; vy: number; a: number; sp: number; size: number; life: number; maxLife: number; color: string; }
    const parts: P[] = [];

    function pick() { return colors[(Math.random() * colors.length) | 0]; }
    function rand(min: number, max: number) { return min + Math.random() * (max - min); }

    if (kind === "fire") {
      for (let i = 0; i < 90; i++) {
        parts.push({ x: 0, y: 0, vx: 0, vy: 0, a: Math.random() * Math.PI * 2, sp: Math.random() * 0.012 + 0.003, size: Math.random() * 3.2 + 0.8, life: 1, maxLife: 1, color: pick() });
      }
    } else if (kind === "burst") {
      for (let i = 0; i < 60; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = Math.random() * 5 + 2;
        parts.push({ x: cx, y: cy, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 1.2, a: 0, sp: 0, size: Math.random() * 3 + 1.2, life: Math.random() * 0.5 + 0.3, maxLife: 1, color: pick() });
      }
    } else if (kind === "heal") {
      for (let i = 0; i < 70; i++) {
        parts.push({ x: cx + rand(-70, 70), y: H + rand(0, 30), vx: 0, vy: 0, a: 0, sp: 0, size: Math.random() * 2.6 + 1, life: Math.random() * 0.5 + 0.3, maxLife: 1, color: pick() });
      }
    } else {
      for (let i = 0; i < 26; i++) {
        parts.push({ x: cx + rand(-40, 40), y: rand(10, H - 10), vx: 0, vy: rand(0.5, 1.6), a: 0, sp: 0, size: Math.random() * 2 + 0.8, life: 1, maxLife: 1, color: pick() });
      }
    }

    let t = 0;
    let boltX = cx;
    let boltAge = 0;

    function drawBolt(x1: number, y1: number, x2: number, y2: number, jag: number, width: number, color: string) {
      ctx!.beginPath();
      ctx!.moveTo(x1, y1);
      const segs = 7;
      for (let i = 1; i < segs; i++) {
        const nx = x1 + ((x2 - x1) * i) / segs + rand(-jag, jag);
        const ny = y1 + ((y2 - y1) * i) / segs;
        ctx!.lineTo(nx, ny);
      }
      ctx!.lineTo(x2, y2);
      ctx!.strokeStyle = color;
      ctx!.lineWidth = width;
      ctx!.stroke();
    }

    function tick() {
      t += 0.016;
      ctx!.clearRect(0, 0, W, H);

      if (kind === "fire") {
        // embers rising from the bottom
        ctx!.beginPath();
        ctx!.arc(cx, cy + 14, 46 + 4 * Math.sin(t * 2), 0, Math.PI * 2);
        ctx!.fillStyle = "rgba(249,115,22,0.16)";
        ctx!.fill();
        ctx!.beginPath();
        ctx!.arc(cx, cy + 14, 26 + 3 * Math.sin(t * 3 + 1), 0, Math.PI * 2);
        ctx!.fillStyle = "rgba(254,240,138,0.22)";
        ctx!.fill();

        for (const p of parts) {
          p.a += p.sp * (1 + 0.3 * Math.sin(t * 2));
          const r = 30 + 24 * Math.sin(p.a * 3 + t * 1.5) * 0.5 + 26 * Math.cos(p.a * 2 + t);
          const x = cx + Math.cos(p.a) * r;
          const y = cy + 14 + Math.sin(p.a) * r * 0.72 - 10 * Math.sin(t * 3 + p.a);
          const tw = 0.5 + 0.5 * Math.sin(p.a * 8 - t * 4);
          ctx!.beginPath();
          ctx!.arc(x, y, p.size * (0.5 + tw * 0.8), 0, Math.PI * 2);
          ctx!.fillStyle = p.color;
          ctx!.globalAlpha = 0.25 + tw * 0.55;
          ctx!.fill();
        }
      } else if (kind === "bolt") {
        boltAge += 0.016;
        if (boltAge > 0.22) {
          boltAge = 0;
          boltX = cx + rand(-26, 26);
        }
        const bright = Math.max(0.3, 1 - boltAge / 0.22);
        // ambient charge glow
        ctx!.beginPath();
        ctx!.arc(boltX, 10, 60, 0, Math.PI * 2);
        const g = ctx!.createRadialGradient(boltX, 10, 0, boltX, 10, 60);
        g.addColorStop(0, `rgba(125,211,252,${0.28 * bright})`);
        g.addColorStop(1, "rgba(125,211,252,0)");
        ctx!.fillStyle = g;
        ctx!.fill();
        // main bolt
        ctx!.lineCap = "round";
        ctx!.shadowColor = "#7dd3fc";
        ctx!.shadowBlur = 14;
        drawBolt(boltX, 4, cx + rand(-14, 14), cy + 26, 16, 3.5, `rgba(224,242,254,${bright})`);
        drawBolt(boltX, 8, cx - 40 + rand(-6, 6), H - 14, 12, 1.6, `rgba(165,243,252,${0.8 * bright})`);
        drawBolt(boltX, 8, cx + 44 + rand(-6, 6), H - 6, 12, 1.4, `rgba(165,243,252,${0.7 * bright})`);
        ctx!.shadowBlur = 0;
        // sparks
        for (const p of parts) {
          p.y += p.vy;
          p.x += Math.sin(t * 6 + p.y) * 0.5;
          if (p.y > H) { p.y = 6; p.x = boltX + rand(-20, 20); }
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx!.fillStyle = p.color;
          ctx!.globalAlpha = 0.7 * bright;
          ctx!.fill();
        }
      } else if (kind === "burst") {
        // expanding shockwave rings
        for (let r = 0; r < 2; r++) {
          const ringR = (t * 90 + r * 30) % 80;
          ctx!.beginPath();
          ctx!.arc(cx, cy, ringR, 0, Math.PI * 2);
          ctx!.strokeStyle = `rgba(251,146,60,${Math.max(0, 1 - ringR / 80) * 0.7})`;
          ctx!.lineWidth = 3;
          ctx!.stroke();
        }
        for (const p of parts) {
          p.life -= 0.016;
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.18; // gravity
          p.vx *= 0.98;
          p.vy *= 0.98;
          if (p.life <= 0) {
            const ang = Math.random() * Math.PI * 2;
            const spd = Math.random() * 5 + 2;
            p.x = cx; p.y = cy; p.vx = Math.cos(ang) * spd; p.vy = Math.sin(ang) * spd - 1.2; p.life = Math.random() * 0.5 + 0.3;
          }
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, p.size * Math.min(1, p.life * 3), 0, Math.PI * 2);
          ctx!.fillStyle = p.color;
          ctx!.globalAlpha = Math.max(0, p.life);
          ctx!.fill();
        }
        // core flash
        const flash = Math.max(0, Math.sin(t * 6));
        ctx!.beginPath();
        ctx!.arc(cx, cy, 30 + flash * 12, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(255,237,213,${0.5 * flash})`;
        ctx!.fill();
      } else if (kind === "heal") {
        // pulsing orb
        const pulse = 0.5 + 0.5 * Math.sin(t * 3);
        const orbR = 26 + pulse * 7;
        const og = ctx!.createRadialGradient(cx, cy, 0, cx, cy, orbR + 30);
        og.addColorStop(0, `rgba(74,222,128,${0.55 - 0.2 * pulse})`);
        og.addColorStop(0.5, `rgba(167,243,208,${0.25 * (1 - pulse) + 0.1})`);
        og.addColorStop(1, "rgba(74,222,128,0)");
        ctx!.fillStyle = og;
        ctx!.beginPath();
        ctx!.arc(cx, cy, orbR + 30, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.beginPath();
        ctx!.arc(cx, cy, orbR, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(187,247,208,${0.5 + 0.3 * pulse})`;
        ctx!.fill();
        // rising motes
        for (const p of parts) {
          p.life -= 0.016;
          p.y -= 0.6;
          p.x += Math.sin(t * 2 + p.y * 0.05) * 0.4;
          if (p.life <= 0 || p.y < -10) {
            p.x = cx + rand(-62, 62); p.y = H + rand(0, 20); p.life = Math.random() * 0.4 + 0.3;
          }
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx!.fillStyle = p.color;
          ctx!.globalAlpha = Math.max(0, Math.min(1, p.life * 2.2));
          ctx!.fill();
        }
      }
      ctx!.globalAlpha = 1;
      if (!reduceMotion) requestAnimationFrame(tick);
    }
    tick();

    return () => { ctx?.clearRect(0, 0, W, H); };
  }, [sel, vfx.colors, vfx.kind]);

  return (
    <div style={{ textAlign: "left", fontFamily: INTER }}>
      <div style={{ display: "flex", gap: 16, padding: "10px 14px", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "linear-gradient(135deg,#f472b6,#38bdf8)", display: "inline-block" }} />
          {vfx.file}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {VFXS.map((v, i) => (
            <button key={v.id} type="button" onClick={() => setSel(i)} style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 100, cursor: "pointer", fontFamily: INTER, background: i === sel ? `${v.accent}1c` : "rgba(255,255,255,0.04)", color: i === sel ? v.accent : "rgba(255,255,255,0.35)", border: "1px solid " + (i === sel ? `${v.accent}44` : "rgba(255,255,255,0.07)"), transition: "all 0.18s" }}>
              {v.name}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, letterSpacing: "1px", padding: "3px 9px", borderRadius: 100, background: "rgba(244,114,182,0.14)", color: "#f472b6", border: "1px solid rgba(244,114,182,0.25)" }}>
          PARTICLE EMITTER
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, padding: "0 14px 12px", flexWrap: "wrap" }}>
        <div style={{ position: "relative", width: 210, height: 170, borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", background: "radial-gradient(circle at 50% 50%, rgba(124,92,255,0.06), rgba(0,0,0,0.3))", overflow: "hidden" }}>
          <canvas key={sel} ref={canvasRef} width={210} height={170} style={{ width: 210, height: 170 }} />
          <span style={{ position: "absolute", left: 10, top: 8, fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono', monospace" }}>{vfx.name}</span>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, justifyContent: "center" }}>
          {vfx.props.map((r) => (
            <div key={r.label}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>
                <span>{r.label}</span>
                <span style={{ color: vfx.accent, fontFamily: "'JetBrains Mono', monospace" }}>{r.val}</span>
              </div>
              <div style={{ height: 3, borderRadius: 3, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                <div style={{ width: r.w + "%", height: "100%", borderRadius: 3, background: `linear-gradient(90deg,${vfx.accent},#38bdf8)`, animation: "vxBarPulse 2.4s ease-in-out infinite" }} />
              </div>
            </div>
          ))}
          <style>{`@keyframes vxBarPulse { 0%,100% { opacity: 0.5 } 50% { opacity: 1 } }`}</style>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3D demo — select real multi-part models Vexa can generate           */
/* ------------------------------------------------------------------ */

type ModelDef = {
  id: string;
  name: string;
  file: string;
  accent: string;
  parts: { name: string; mat: string; color: string; w: number }[];
  badge: string;
};

const MODELS: ModelDef[] = [
  {
    id: "katana", name: "Enchanted katana", file: "EnchantedKatana.rbxm", accent: "#38bdf8",
    parts: [
      { name: "Blade", mat: "Neon · #38bdf8", color: "#38bdf8", w: 92 },
      { name: "Edge", mat: "Steel · #5c6570", color: "#9aa5b1", w: 84 },
      { name: "Guard", mat: "Brass · #c9a44c", color: "#c9a44c", w: 66 },
      { name: "Grip", mat: "Wrapped · #23282f", color: "#8a93a0", w: 58 },
      { name: "PommelGem", mat: "Crystal · #a78bfa", color: "#a78bfa", w: 46 },
    ],
    badge: "WELDED · 5 PARTS",
  },
  {
    id: "chest", name: "Treasure chest", file: "TreasureChest.rbxm", accent: "#f5a623",
    parts: [
      { name: "Lid", mat: "SmoothWood · #6b4423", color: "#8b5a2b", w: 78 },
      { name: "Body", mat: "SmoothWood · #7a4f26", color: "#a06a35", w: 72 },
      { name: "Bands", mat: "Metal · #f5c542", color: "#f5c542", w: 60 },
      { name: "Lock", mat: "Brass · #d4a017", color: "#d4a017", w: 42 },
      { name: "RopeHinge", mat: "Cloth · #4a3a2a", color: "#6d5a3e", w: 38 },
    ],
    badge: "WELDED · 7 PARTS",
  },
  {
    id: "turret", name: "Auto turret", file: "AutoTurret.rbxm", accent: "#3ecf8e",
    parts: [
      { name: "Base", mat: "Metal · #2f353d", color: "#4b5563", w: 70 },
      { name: "Dome", mat: "Metal · #3a4149", color: "#64748b", w: 76 },
      { name: "Barrel", mat: "Steel · #22262c", color: "#9ca3af", w: 88 },
      { name: "Eye", mat: "Neon · #3ef28e", color: "#3ef28e", w: 55 },
      { name: "Vents", mat: "Dark · #17191d", color: "#34383e", w: 44 },
    ],
    badge: "WELDED · 8 PARTS",
  },
  {
    id: "staff", name: "Crystal staff", file: "CrystalStaff.rbxm", accent: "#7c5cff",
    parts: [
      { name: "Shaft", mat: "Wood · #6b4a2b", color: "#8b5a2b", w: 80 },
      { name: "Wrap", mat: "Leather · #4a3320", color: "#6b4a2b", w: 52 },
      { name: "Crystal", mat: "Crystal · #7c5cff", color: "#7c5cff", w: 90 },
      { name: "Core", mat: "Neon · #a78bfa", color: "#a78bfa", w: 48 },
      { name: "Orb", mat: "Glass · #c4b5fd", color: "#c4b5fd", w: 38 },
    ],
    badge: "WELDED · 5 PARTS",
  },
];

function ModelRender({ model }: { model: ModelDef }) {
  const id = model.id;
  const styles: Record<string, string> = {};

  if (id === "katana") {
    styles.frame = `
      .m3d-katana { animation: vxRock 5s ease-in-out infinite; transform-style: preserve-3d; }
      @keyframes vxRock { 0%,100% { transform: rotate(-24deg) rotateY(10deg) } 50% { transform: rotate(-24deg) rotateY(-14deg) } }
      .m3d-katana .blade { position:absolute; left:50%; top:-4px; width:10px; height:120px; margin-left:-5px; border-radius:2px; background:linear-gradient(180deg,#bae6fd,#38bdf8 40%,#0284c7 100%); box-shadow:0 0 18px rgba(56,189,248,0.55), inset 0 1px 0 rgba(255,255,255,0.5); }
      .m3d-katana .edge { position:absolute; left:50%; top:6px; width:4px; height:104px; margin-left:-2px; background:linear-gradient(180deg,#e2e8f0,#64748b); opacity:0.85; }
      .m3d-katana .guard { position:absolute; left:50%; top:118px; width:34px; height:6px; margin-left:-17px; border-radius:3px; background:linear-gradient(180deg,#e8c877,#c9a44c 55%,#8a6a20); box-shadow:0 0 10px rgba(201,164,76,0.4); }
      .m3d-katana .grip { position:absolute; left:50%; top:124px; width:9px; height:34px; margin-left:-4.5px; border-radius:3px; background:linear-gradient(90deg,#1f242b,#3a4149 30%,#14171b 55%,#2c333b); }
      .m3d-katana .gem { position:absolute; left:50%; top:160px; width:12px; height:12px; margin-left:-6px; border-radius:50%; background:radial-gradient(circle at 35% 30%,#fff,#a78bfa 60%); box-shadow:0 0 14px rgba(167,139,250,0.8); }
    `;
  } else if (id === "chest") {
    styles.frame = `
      .m3d-chest { animation: vxChest 4.5s ease-in-out infinite; transform-style: preserve-3d; }
      @keyframes vxChest { 0%,100% { transform: rotateY(-18deg) rotateX(6deg) } 50% { transform: rotateY(18deg) rotateX(4deg) } }
      .m3d-chest { width:120px; height:64px; }
      .m3d-chest .body { position:absolute; inset:14px 0 0 0; border-radius:6px; background:linear-gradient(180deg,#8a5a2c,#6b4423 60%,#5a3a1e); box-shadow:inset 0 1px 0 rgba(255,255,255,0.15), 0 14px 30px rgba(0,0,0,0.5); }
      .m3d-chest .lid { position:absolute; left:0; right:0; top:-2px; height:34px; border-radius:8px 8px 6px 6px; background:linear-gradient(180deg,#9c6b38,#7a4f26); box-shadow:inset 0 1px 0 rgba(255,255,255,0.18); transform-origin:50% 100%; animation:vxLid 4.5s ease-in-out infinite; }
      @keyframes vxLid { 0%,100% { transform:rotate(0deg) } 45% { transform:rotate(-9deg) } 55% { transform:rotate(-9deg) } }
      .m3d-chest .band { position:absolute; top:-2px; bottom:0; width:8px; border-radius:2px; background:linear-gradient(90deg,#e8c15a,#f5c542 40%,#a8842c); box-shadow:0 0 8px rgba(245,197,66,0.4); }
      .m3d-chest .band-l { left:18px; }
      .m3d-chest .band-r { right:18px; }
      .m3d-chest .band-m { left:50%; margin-left:-4px; height:46px; top:10px; }
      .m3d-chest .lock { position:absolute; left:50%; top:34px; width:16px; height:20px; margin-left:-8px; border-radius:4px; background:linear-gradient(180deg,#e8c877,#c9a44c); box-shadow:0 0 12px rgba(201,164,76,0.5); }
      .m3d-chest .lock::after { content:""; position:absolute; left:50%; top:-9px; width:10px; height:12px; margin-left:-5px; border:2px solid #d4a017; border-bottom:none; border-radius:6px 6px 0 0; }
    `;
  } else if (id === "turret") {
    styles.frame = `
      .m3d-turret { animation: vxSpinY 9s linear infinite; transform-style: preserve-3d; }
      @keyframes vxSpinY { from { transform: rotateY(0deg) } to { transform: rotateY(360deg) } }
      .m3d-turret .base { position:absolute; left:50%; bottom:0; width:74px; height:22px; margin-left:-37px; border-radius:8px; background:linear-gradient(180deg,#4b5563,#2f353d); box-shadow:inset 0 1px 0 rgba(255,255,255,0.12), 0 10px 26px rgba(0,0,0,0.5); }
      .m3d-turret .dome { position:absolute; left:50%; bottom:20px; width:52px; height:44px; margin-left:-26px; border-radius:26px 26px 10px 10px; background:radial-gradient(ellipse at 50% 25%, #7b8aa0, #3a4149 70%); box-shadow:inset 0 1px 0 rgba(255,255,255,0.18); }
      .m3d-turret .barrel { position:absolute; left:50%; bottom:30px; width:10px; height:52px; margin-left:-5px; border-radius:4px; background:linear-gradient(180deg,#9ca3af,#22262c); transform:translateX(24px) rotate(12deg); box-shadow:0 0 10px rgba(0,0,0,0.4); }
      .m3d-turret .muzzle { position:absolute; left:50%; bottom:76px; width:16px; height:6px; margin-left:-8px; border-radius:3px; background:#0f1216; transform:translateX(24px) rotate(12deg); }
      .m3d-turret .eye { position:absolute; left:50%; top:16px; width:14px; height:10px; margin-left:-7px; border-radius:8px; background:#3ef28e; box-shadow:0 0 16px 4px rgba(62,242,142,0.6); animation:vxScan 2.6s ease-in-out infinite; }
      @keyframes vxScan { 0%,100% { transform:translateX(-10px) } 50% { transform:translateX(10px) } }
      .m3d-turret .vent { position:absolute; left:50%; bottom:6px; width:26px; height:4px; margin-left:-13px; border-radius:2px; background:#17191d; }
    `;
  } else if (id === "staff") {
    styles.frame = `
      .m3d-staff { animation: vxStaff 6s ease-in-out infinite; transform-style: preserve-3d; }
      @keyframes vxStaff { 0%,100% { transform: rotate(-8deg) rotateY(14deg) } 50% { transform: rotate(-8deg) rotateY(-14deg) } }
      .m3d-staff .shaft { position:absolute; left:50%; top:34px; width:9px; height:120px; margin-left:-4.5px; border-radius:4px; background:linear-gradient(90deg,#5d4022,#8b5a2b 30%,#4a3320 60%,#7a4f26); }
      .m3d-staff .wrap { position:absolute; left:50%; top:70px; width:12px; height:26px; margin-left:-6px; border-radius:4px; background:linear-gradient(90deg,#5a3a1e,#3f2a14 55%,#6b4a2b); box-shadow:inset 0 1px 0 rgba(255,255,255,0.12); }
      .m3d-staff .crystal { position:absolute; left:50%; top:-6px; width:0; height:0; margin-left:-19px; border-left:19px solid transparent; border-right:19px solid transparent; border-bottom:46px solid rgba(124,92,255,0.92); filter:drop-shadow(0 0 16px rgba(124,92,255,0.7)); }
      .m3d-staff .crystal::after { content:""; position:absolute; top:6px; left:-13px; width:26px; height:34px; background:linear-gradient(180deg,rgba(255,255,255,0.55),rgba(124,92,255,0.05)); clip-path:polygon(50% 0%,0% 100%,100% 100%); }
      .m3d-staff .core { position:absolute; left:50%; top:2px; width:10px; height:10px; margin-left:-5px; border-radius:50%; background:radial-gradient(circle,#fff,#a78bfa 55%); box-shadow:0 0 18px 6px rgba(167,139,250,0.65); animation:vxPulse 2s ease-in-out infinite; }
      @keyframes vxPulse { 0%,100% { opacity:0.75; transform:scale(1) } 50% { opacity:1; transform:scale(1.25) } }
      .m3d-staff .orb { position:absolute; left:50%; top:156px; width:10px; height:10px; margin-left:-5px; border-radius:50%; background:radial-gradient(circle,#fff,#c4b5fd 60%); box-shadow:0 0 12px rgba(196,181,253,0.6); }
    `;
  }

  return (
    <div style={{ width: 210, height: 170, borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", background: "radial-gradient(circle at 50% 40%, rgba(56,189,248,0.07), rgba(0,0,0,0.3))", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", perspective: "600px", position: "relative" }}>
      <style>{styles.frame}</style>
      <div className={"m3d-" + id} style={{ position: "relative", width: 130, height: 170, transformStyle: "preserve-3d" }}>
        {id === "katana" && (
          <div style={{ position: "absolute", inset: 0 }}>
            <div className="blade" /><div className="edge" /><div className="guard" /><div className="grip" /><div className="gem" />
          </div>
        )}
        {id === "chest" && (
          <div style={{ position: "absolute", inset: 0, left: 5, top: 30 }}>
            <div className="body" /><div className="lid" />
            <div className="band band-l" /><div className="band band-r" /><div className="band band-m" />
            <div className="lock" />
          </div>
        )}
        {id === "turret" && (
          <div style={{ position: "absolute", inset: 0 }}>
            <div className="base" /><div className="dome" /><div className="barrel" /><div className="muzzle" /><div className="eye" /><div className="vent" />
          </div>
        )}
        {id === "staff" && (
          <div style={{ position: "absolute", inset: 0 }}>
            <div className="shaft" /><div className="wrap" /><div className="crystal" /><div className="core" /><div className="orb" />
          </div>
        )}
      </div>
      <span style={{ position: "absolute", left: 10, top: 8, fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono', monospace" }}>{model.name}</span>
    </div>
  );
}

function Model3DDemo() {
  const [sel, setSel] = useState(0);
  const model = MODELS[sel];

  return (
    <div style={{ textAlign: "left", fontFamily: INTER }}>
      <div style={{ display: "flex", gap: 16, padding: "10px 14px", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "linear-gradient(135deg,#3ecf8e,#38bdf8)", display: "inline-block" }} />
          {model.file}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {MODELS.map((m, i) => (
            <button key={m.id} type="button" onClick={() => setSel(i)} style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 100, cursor: "pointer", fontFamily: INTER, background: i === sel ? `${m.accent}1c` : "rgba(255,255,255,0.04)", color: i === sel ? m.accent : "rgba(255,255,255,0.35)", border: "1px solid " + (i === sel ? `${m.accent}44` : "rgba(255,255,255,0.07)"), transition: "all 0.18s" }}>
              {m.name}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, letterSpacing: "1px", padding: "3px 9px", borderRadius: 100, background: "rgba(62,207,142,0.14)", color: "#3ecf8e", border: "1px solid rgba(62,207,142,0.25)" }}>
          {model.badge}
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, padding: "0 14px 12px", alignItems: "center", flexWrap: "wrap" }}>
        <ModelRender key={model.id} model={model} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          {model.parts.map((p) => (
            <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 6, height: 6, borderRadius: 2, background: p.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "#fff", fontWeight: 500, minWidth: 82 }}>{p.name}</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", flex: 1 }}>{p.mat}</span>
              <div style={{ width: 60, height: 4, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{ width: p.w + "%", height: "100%", borderRadius: 4, background: `linear-gradient(90deg,${model.accent},#3ecf8e)` }} />
              </div>
            </div>
          ))}
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            {["WeldScript", "PrimaryPart", "Real materials"].map((m, i) => (
              <span key={m} style={{ fontSize: 9.5, fontWeight: 600, padding: "2px 8px", borderRadius: 100, background: i === 0 ? "rgba(62,207,142,0.16)" : "rgba(255,255,255,0.04)", color: i === 0 ? "#6ee7b7" : "rgba(255,255,255,0.3)", border: "1px solid " + (i === 0 ? "rgba(62,207,142,0.3)" : "rgba(255,255,255,0.06)") }}>
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cinematic demo — scripted camera timeline (push-in → whip → orbit)  */
/* ------------------------------------------------------------------ */

type CinShot = {
  id: string;
  name: string;
  label: string;
  time: string;
  fov: string;
  mode: string;
  color: string;
};

const SHOTS: CinShot[] = [
  { id: "push",  name: "Shot 01", label: "Dolly push-in",  time: "0.0s–2.4s", fov: "45° → 32°", mode: "follow", color: "#a78bfa" },
  { id: "whip",  name: "Shot 02", label: "Whip + hitstop", time: "2.4s–3.1s", fov: "32°",       mode: "cut",    color: "#f472b6" },
  { id: "orbit", name: "Shot 03", label: "Low-angle orbit", time: "3.1s–6.0s", fov: "40°",      mode: "orbit",  color: "#38bdf8" },
];

function CinematicDemo() {
  const [sel, setSel] = useState(0);
  const shot = SHOTS[sel];

  return (
    <div style={{ textAlign: "left", fontFamily: INTER }}>
      <style>{`
        @keyframes vxCamPush {
          0%   { transform: scale(1.35) translateX(14px); }
          100% { transform: scale(1) translateX(0); }
        }
        @keyframes vxCamWhip {
          0%   { transform: translateX(60px) scale(1.1) rotate(4deg); }
          55%  { transform: translateX(-8px) scale(0.96); }
          100% { transform: translateX(0) scale(1); }
        }
        @keyframes vxCamOrbit {
          0%   { transform: translateX(0) scale(1); }
          100% { transform: translateX(34px) scale(1.18); }
        }
        @keyframes vxHitFreeze {
          0%, 100% { opacity: 0; }
          45%, 65% { opacity: 0.9; }
        }
        @keyframes vxPlayhead {
          0%   { left: 0%; }
          100% { left: calc(100% - 5px); }
        }
        .cin-push  .cin-scene { animation: vxCamPush  2.4s cubic-bezier(.16,1,.3,1) infinite; }
        .cin-whip  .cin-scene { animation: vxCamWhip  0.7s cubic-bezier(.4,0,.2,1) infinite; }
        .cin-orbit .cin-scene { animation: vxCamOrbit 2.9s cubic-bezier(.45,0,.25,1) infinite alternate; }
        .cin-whip  .cin-flash { animation: vxHitFreeze 0.7s steps(1,end) infinite; }
      `}</style>

      <div style={{ display: "flex", gap: 16, alignItems: "center", padding: "10px 14px", flexWrap: "wrap" }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "linear-gradient(135deg,#a78bfa,#38bdf8)", display: "inline-block" }} />
          {shot.name} · {shot.label}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {SHOTS.map((s, i) => (
            <button key={s.id} type="button" onClick={() => setSel(i)} style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 100, cursor: "pointer", fontFamily: INTER, background: i === sel ? `${s.color}1c` : "rgba(255,255,255,0.04)", color: i === sel ? s.color : "rgba(255,255,255,0.35)", border: "1px solid " + (i === sel ? `${s.color}44` : "rgba(255,255,255,0.07)"), transition: "all 0.18s" }}>
              {s.name}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, letterSpacing: "1px", padding: "3px 9px", borderRadius: 100, background: "rgba(196,181,253,0.14)", color: "#c4b5fd", border: "1px solid rgba(196,181,253,0.25)" }}>
          CINEMATIC PLAYER
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, padding: "0 14px 10px", flexWrap: "wrap" }}>
        {/* viewfinder */}
        <div className={"cin-" + shot.id} style={{ position: "relative", width: 200, height: 120, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden", background: "radial-gradient(circle at 50% 40%, rgba(124,92,255,0.10), rgba(0,0,0,0.4))", flexShrink: 0 }}>
          <div className="cin-scene" style={{ position: "absolute", inset: 0 }}>
            <svg width="200" height="120" viewBox="0 0 200 120">
              <line x1="0" y1="70" x2="200" y2="70" stroke="rgba(255,255,255,0.14)" />
              {[40, 70, 100, 130, 160].map(x => <line key={x} x1={x} y1="70" x2={x - 40} y2="120" stroke="rgba(255,255,255,0.08)" />)}
              <g transform="translate(110,66)">
                <circle cx="0" cy="-16" r="7" fill="none" stroke="#fff" strokeWidth="2.5" />
                <line x1="0" y1="-9" x2="0" y2="12" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                <line x1="0" y1="0" x2="-8" y2="-4" stroke="#cfd3ff" strokeWidth="3" strokeLinecap="round" />
                <line x1="0" y1="0" x2="9" y2="-2" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                <line x1="0" y1="12" x2="-5" y2="26" stroke="#cfd3ff" strokeWidth="3" strokeLinecap="round" />
                <line x1="0" y1="12" x2="5" y2="26" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
              </g>
            </svg>
          </div>
          <div className="cin-flash" style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 50%, rgba(252,216,70,0.15), rgba(255,255,255,0.5) 55%, transparent 75%)", opacity: 0, pointerEvents: "none" }} />
          <div style={{ position: "absolute", left: 8, top: 8, width: 14, height: 14, border: "1.5px solid rgba(252,216,70,0.9)", borderRadius: "50%" }}>
            <div style={{ position: "absolute", left: "50%", top: "50%", width: 5, height: 1.5, background: "#fcd846", transform: "translate(-50%,-50%)" }} />
            <div style={{ position: "absolute", left: "50%", top: "50%", width: 1.5, height: 5, background: "#fcd846", transform: "translate(-50%,-50%)" }} />
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 18, background: "rgba(0,0,0,0.45)" }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 18, background: "rgba(0,0,0,0.45)" }} />
          <span style={{ position: "absolute", left: 10, bottom: 4, fontSize: 9, color: "rgba(255,255,255,0.6)", fontFamily: "'JetBrains Mono', monospace" }}>
            {shot.mode.toUpperCase()} · FOV {shot.fov}
          </span>
        </div>

        {/* timeline */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 220 }}>
          <div style={{ position: "relative", height: 26, borderRadius: 6, overflow: "hidden", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ position: "absolute", top: 0, bottom: 0, left: "0%", width: "40%", background: "rgba(167,139,250,0.28)", borderRight: "1px solid rgba(167,139,250,0.5)" }} />
            <div style={{ position: "absolute", top: 0, bottom: 0, left: "40%", width: "12%", background: "rgba(244,114,182,0.28)", borderRight: "1px solid rgba(244,114,182,0.5)" }} />
            <div style={{ position: "absolute", top: 0, bottom: 0, left: "52%", width: "48%", background: "rgba(56,189,248,0.28)" }} />
            <div style={{ position: "absolute", top: 0, bottom: 0, width: 5, background: "#fcd846", boxShadow: "0 0 8px rgba(252,216,70,0.8)", animation: "vxPlayhead 6s linear infinite", borderRadius: 2 }} />
          </div>
          {SHOTS.map((s, i) => (
            <div key={s.id} onClick={() => setSel(i)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: i === sel ? s.color : "rgba(255,255,255,0.14)", transition: "background 0.2s" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: i === sel ? "#fff" : "rgba(255,255,255,0.35)", minWidth: 64, transition: "color 0.2s" }}>{s.name}</span>
              <span style={{ fontSize: 11, color: i === sel ? s.color : "rgba(255,255,255,0.25)", minWidth: 118 }}>{s.label}</span>
              <span style={{ height: 2, flex: 1, borderRadius: 2, background: i === sel ? `linear-gradient(90deg,${s.color},#38bdf8)` : "rgba(255,255,255,0.08)", transition: "background 0.3s" }} />
              <span style={{ fontSize: 10, color: i === sel ? s.color : "rgba(255,255,255,0.2)", fontFamily: "'JetBrains Mono', monospace" }}>{s.time}</span>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            {["Slow-mo 0.35×", "Stinger SFX", "Vignette pulse"].map((t, i) => (
              <span key={t} style={{ fontSize: 9.5, fontWeight: 600, padding: "2px 8px", borderRadius: 100, background: i === 1 ? "rgba(244,114,182,0.16)" : "rgba(255,255,255,0.04)", color: i === 1 ? "#f9a8d4" : "rgba(255,255,255,0.3)", border: "1px solid " + (i === 1 ? "rgba(244,114,182,0.3)" : "rgba(255,255,255,0.06)") }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Showcase wrapper with tabs                                          */
/* ------------------------------------------------------------------ */

const TABS = [
  { id: "script", label: "Scripting", icon: "</>", demo: <ScriptingDemo />, accent: "#a78bfa", tag: "Complete multi-script systems · typed Luau" },
  { id: "anim", label: "Animation", icon: "◐", demo: <AnimationDemo />, accent: "#f472b6", tag: "Keyframe animations · created inside Moon Animator" },
  { id: "vfx", label: "VFX", icon: "✦", demo: <VfxDemo />, accent: "#f472b6", tag: "ParticleEmitter / Beam effects · tuned in Studio" },
  { id: "cin", label: "Cinematic", icon: "▸", demo: <CinematicDemo />, accent: "#c4b5fd", tag: "Scripted camera · slow-mo, hitstop, orbit & cuts" },
  { id: "3d", label: "3D Model", icon: "◆", demo: <Model3DDemo />, accent: "#3ecf8e", tag: "Multi-part welded models · real materials" },
];

export function Showcase() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => setActive((a) => (a + 1) % TABS.length), 6000);
    return () => clearInterval(id);
  }, [auto]);

  const tab = TABS[active];

  return (
    <div style={{ position: "relative" }}>
      {/* ambient glows */}
      <div aria-hidden style={{ position: "absolute", inset: -28, background: "radial-gradient(ellipse at 30% 10%, rgba(252,216,70,0.10), transparent 55%), radial-gradient(ellipse at 80% 90%, rgba(124,92,255,0.14), transparent 55%)", filter: "blur(40px)", pointerEvents: "none", zIndex: 0 }} />
      <div aria-hidden style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "80%", height: 1, background: "linear-gradient(90deg, transparent, rgba(252,216,70,0.5), transparent)", zIndex: 3, pointerEvents: "none" }} />
      <div
        style={{
          position: "relative",
          width: "100%",
          borderRadius: 22,
          background: "rgba(14,14,18,0.8)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 30px 80px rgba(0,0,0,0.5), 0 0 60px rgba(124,92,255,0.10)",
          backdropFilter: "blur(24px)",
          overflow: "hidden",
          fontFamily: INTER,
          zIndex: 1,
        }}
        onMouseEnter={() => setAuto(false)}
        onMouseLeave={() => setAuto(true)}
      >
        <div aria-hidden className="vx-conic-border" style={{ opacity: 0.7 }} />
        {/* tab bar */}
        <div style={{ display: "flex", gap: 4, padding: "10px 10px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap", position: "relative", zIndex: 2 }}>
          {TABS.map((t, i) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setActive(i); setAuto(false); }}
              onMouseEnter={() => { setActive(i); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 15px",
                borderRadius: 11,
                border: "none",
                background: i === active ? "rgba(252,216,70,0.12)" : "transparent",
                borderBottom: i === active ? "2px solid #fcd846" : "2px solid transparent",
                cursor: "pointer",
                fontFamily: INTER,
                transition: "background 0.18s",
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: i === active ? "#fcd846" : "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono', monospace" }}>{t.icon}</span>
              <span style={{ fontSize: 13, fontWeight: i === active ? 700 : 500, color: i === active ? "#fff" : "rgba(255,255,255,0.45)", transition: "color 0.18s" }}>{t.label}</span>
            </button>
          ))}
          <span style={{ marginLeft: "auto", alignSelf: "center", fontSize: 10, color: "rgba(255,255,255,0.22)", fontWeight: 600, letterSpacing: "0.6px", paddingRight: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fcd846", animation: "livePulse 2.2s ease infinite", display: "inline-block", boxShadow: "0 0 8px rgba(252,216,70,0.6)" }} />
            LIVE
          </span>
        </div>

        {/* tag line */}
        <div style={{ padding: "12px 18px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.18)", position: "relative", zIndex: 2 }}>
          <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>
            Generate <span style={{ color: tab.accent, fontWeight: 700 }}>{tab.label}</span>
          </span>
          <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.35)" }}>· {tab.tag}</span>
        </div>

        {/* panel */}
        <div style={{ minHeight: 250, display: "flex", alignItems: "center", position: "relative", zIndex: 2 }}>
          <div key={active} style={{ width: "100%", animation: "fadeIn 0.35s ease both" }}>{tab.demo}</div>
        </div>

        {/* progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 5, padding: "10px 0 12px", position: "relative", zIndex: 2 }}>
          {TABS.map((_, i) => (
            <span key={i} style={{ width: i === active ? 22 : 6, height: 6, borderRadius: 100, background: i === active ? "linear-gradient(90deg,#fcd846,#a78bfa)" : "rgba(255,255,255,0.12)", transition: "all 0.3s", cursor: "pointer" }} onClick={() => setActive(i)} />
          ))}
        </div>
      </div>
    </div>
  );
}
