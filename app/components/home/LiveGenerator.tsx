"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

const INTER = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const MONO = "'JetBrains Mono', monospace";

type Tok = { c: string; s: string };

interface Sample {
  id: string;
  label: string;
  prompt: string;
  accent: string;
  file: string;
  type: string;
  steps: string[];
  code: Tok[][];
  summary: string;
}

const SAMPLES: Sample[] = [
  {
    id: "combat",
    label: "Combat system",
    prompt: "a dash combat system with combo attacks and a fire trail",
    accent: "#a78bfa",
    file: "CombatService.lua",
    type: "Scripting",
    steps: ["Analyzing request", "Designing service architecture", "Writing CombatService.lua", "Wiring remotes & placing instances"],
    code: [
      [{ c: "#5c6f7f", s: "-- Vexa · CombatService" }],
      [{ c: "#c792ea", s: "local" }, { c: "#e8e9ec", s: " Combat " }, { c: "#c792ea", s: "= {}" }],
      [{ c: "#c792ea", s: "local" }, { c: "#e8e9ec", s: " REMOTE " }, { c: "#c792ea", s: "= ReplicatedStorage:WaitForChild" }, { c: "#89ddff", s: "('CombatRemote')" }],
      [{ c: "#c792ea", s: "local" }, { c: "#e8e9ec", s: " TRAIL " }, { c: "#c792ea", s: "= VFX.new" }, { c: "#89ddff", s: "('FireTrail')" }],
      [{ c: "#c792ea", s: "function" }, { c: "#e8e9ec", s: " Combat.attack" }, { c: "#89ddff", s: "(player)" }],
      [{ c: "#c792ea", s: "  local" }, { c: "#e8e9ec", s: " anim " }, { c: "#c792ea", s: "= Animations.Play" }, { c: "#89ddff", s: "('DashCombo')" }],
      [{ c: "#c792ea", s: "  TRAIL:Enable" }, { c: "#89ddff", s: "(player)" }],
      [{ c: "#c792ea", s: "  task.delay" }, { c: "#89ddff", s: "(0.4, function()" }, { c: "#c792ea", s: " TRAIL:Disable" }, { c: "#89ddff", s: "() end)" }],
      [{ c: "#c792ea", s: "end" }],
    ],
    summary: "4 instances · 3 scripts · remotes wired · combo-ready",
  },
  {
    id: "vfx",
    label: "Fire aura VFX",
    prompt: "a raging fire aura around the player with embers",
    accent: "#f472b6",
    file: "FireAura.particle",
    type: "VFX",
    steps: ["Analyzing request", "Tuning emitter physics", "Building FireAura.particle", "Attaching to character"],
    code: [
      [{ c: "#5c6f7f", s: "-- Vexa · FireAura" }],
      [{ c: "#c792ea", s: "local" }, { c: "#e8e9ec", s: " emitter " }, { c: "#c792ea", s: "= Instance.new" }, { c: "#89ddff", s: "('ParticleEmitter')" }],
      [{ c: "#e8e9ec", s: "emitter.Rate" }, { c: "#c792ea", s: "=" }, { c: "#f78c6c", s: " 180" }],
      [{ c: "#e8e9ec", s: "emitter.Lifetime" }, { c: "#c792ea", s: "=" }, { c: "#f78c6c", s: " 1.2" }],
      [{ c: "#e8e9ec", s: "emitter.SpreadAngle" }, { c: "#c792ea", s: "=" }, { c: "#f78c6c", s: " 360" }],
      [{ c: "#e8e9ec", s: "emitter.Speed" }, { c: "#c792ea", s: "=" }, { c: "#f78c6c", s: " 6" }],
      [{ c: "#e8e9ec", s: "emitter.NumberSequence" }, { c: "#c792ea", s: " = NumberSequence.new" }, { c: "#89ddff", s: "(" }, { c: "#f78c6c", s: "0" }, { c: "#89ddff", s: "," }, { c: "#f78c6c", s: "1" }, { c: "#89ddff", s: ")" }],
      [{ c: "#c792ea", s: "emitter.Parent" }, { c: "#c792ea", s: "=" }, { c: "#e8e9ec", s: "humanoidRootPart" }],
    ],
    summary: "ParticleEmitter tuned · 180 rate · 360° spread · attached",
  },
  {
    id: "sword",
    label: "3D sword model",
    prompt: "an enchanted crystal sword with a glowing core",
    accent: "#3ecf8e",
    file: "EnchantedSword.rbxm",
    type: "3D Model",
    steps: ["Analyzing request", "Modeling parts & materials", "Welding EnchantedSword.rbxm", "Adding glow core"],
    code: [
      [{ c: "#5c6f7f", s: "-- Vexa · EnchantedSword" }],
      [{ c: "#c792ea", s: "local" }, { c: "#e8e9ec", s: " sword " }, { c: "#c792ea", s: "= Model.new" }, { c: "#89ddff", s: "('EnchantedSword')" }],
      [{ c: "#c792ea", s: "local" }, { c: "#e8e9ec", s: " blade " }, { c: "#c792ea", s: "= Part.new" }, { c: "#89ddff", s: "('Blade')" }],
      [{ c: "#e8e9ec", s: "blade.Material" }, { c: "#c792ea", s: "=" }, { c: "#c3e88d", s: "Enum.Material.Neon" }],
      [{ c: "#e8e9ec", s: "blade.Color" }, { c: "#c792ea", s: "=" }, { c: "#c3e88d", s: "Color3.fromRGB" }, { c: "#89ddff", s: "(56, 189, 248)" }],
      [{ c: "#c792ea", s: "local" }, { c: "#e8e9ec", s: " weld " }, { c: "#c792ea", s: "= Weld.new" }, { c: "#89ddff", s: "('Weld')" }],
      [{ c: "#e8e9ec", s: "weld.Part0, weld.Part1 " }, { c: "#c792ea", s: "=" }, { c: "#e8e9ec", s: " handle, blade" }],
      [{ c: "#e8e9ec", s: "sword.Parent" }, { c: "#c792ea", s: "=" }, { c: "#e8e9ec", s: " workspace" }],
    ],
    summary: "4 parts · welded · real materials · neon core",
  },
  {
    id: "anim",
    label: "Idle animation",
    prompt: "a relaxed idle animation for a character",
    accent: "#38bdf8",
    file: "RelaxedIdle.anim",
    type: "Animation",
    steps: ["Analyzing request", "Designing pose timeline", "Creating keyframes in Moon Animator", "Setting loop & easing"],
    code: [
      [{ c: "#5c6f7f", s: "-- Vexa · RelaxedIdle (Moon Animator)" }],
      [{ c: "#c792ea", s: "local" }, { c: "#e8e9ec", s: " moon " }, { c: "#c792ea", s: "= _G.MoonGlobal" }],
      [{ c: "#c792ea", s: "local" }, { c: "#e8e9ec", s: " anim " }, { c: "#c792ea", s: "= moon.createAnimation" }, { c: "#89ddff", s: "()" }],
      [{ c: "#c792ea", s: "for" }, { c: "#c792ea", s: " frame" }, { c: "#c792ea", s: "=" }, { c: "#f78c6c", s: "0" }, { c: "#c792ea", s: "," }, { c: "#f78c6c", s: "72" }, { c: "#c792ea", s: "," }, { c: "#f78c6c", s: "24" }, { c: "#c792ea", s: " do" }],
      [{ c: "#c792ea", s: "  moon.addKeyframe" }, { c: "#89ddff", s: "(anim, frame)" }],
      [{ c: "#c792ea", s: "  moon.setAngleByBone" }, { c: "#89ddff", s: "(cf, anim, frame, 'Head', " }, { c: "#f78c6c", s: "true" }, { c: "#89ddff", s: ")" }],
      [{ c: "#c792ea", s: "end" }],
      [{ c: "#c792ea", s: "moon.setAnimation" }, { c: "#89ddff", s: "(anim)" }],
    ],
    summary: "Keyframes in Moon Animator · looped · eased · ready to play",
  },
];

const TYPE_STYLES: Record<string, { chip: string; icon: string }> = {
  Scripting: { chip: "</>", icon: "bi-code-slash" },
  VFX: { chip: "✦", icon: "bi-stars" },
  "3D Model": { chip: "◆", icon: "bi-box" },
  Animation: { chip: "◐", icon: "bi-person-arms-up" },
};

function StepList({ steps, done }: { steps: string[]; done: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontFamily: INTER }}>
      {steps.map((s, i) => {
        const state = i < done ? "done" : i === done ? "active" : "pending";
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, background: state === "done" ? "rgba(62,207,142,0.15)" : state === "active" ? "rgba(124,92,255,0.16)" : "rgba(255,255,255,0.03)", border: state === "done" ? "1px solid rgba(62,207,142,0.4)" : state === "active" ? "1px solid rgba(167,139,250,0.45)" : "1px solid rgba(255,255,255,0.08)" }}>
              {state === "done" ? (
                <span style={{ color: "#3ecf8e", fontSize: 10 }}>✓</span>
              ) : state === "active" ? (
                <span style={{ width: 8, height: 8, borderRadius: "50%", border: "2px solid rgba(167,139,250,0.6)", borderTopColor: "transparent", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
              ) : (
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.25)" }} />
              )}
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: state === "pending" ? "rgba(255,255,255,0.28)" : state === "active" ? "#fff" : "rgba(255,255,255,0.72)", transition: "color 0.2s" }}>{s}</span>
          </div>
        );
      })}
    </div>
  );
}

export function LiveGenerator() {
  const [activeId, setActiveId] = useState("combat");
  const [input, setInput] = useState(SAMPLES[0].prompt);
  const [phase, setPhase] = useState<"idle" | "generating" | "typing" | "done">("idle");
  const [step, setStep] = useState(0);
  const [codeCount, setCodeCount] = useState(0);
  const [autoPlayed, setAutoPlayed] = useState(false);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const sample = SAMPLES.find((s) => s.id === activeId) ?? SAMPLES[0];

  const onPanelMove = (e: ReactMouseEvent) => {
    const r = panelRef.current?.getBoundingClientRect();
    if (!r) return;
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ rx: -py * 6, ry: px * 9 });
  };

  useEffect(() => {
    if (!autoPlayed) {
      const el = wrapRef.current;
      if (!el) return;
      const io = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          setAutoPlayed(true);
          run("combat");
          io.disconnect();
        }
      }, { threshold: 0.3 });
      io.observe(el);
      return () => io.disconnect();
    }
  }, [autoPlayed]);

  useEffect(() => {
    if (phase !== "generating") return;
    if (step >= sample.steps.length) {
      const t = setTimeout(() => { setPhase("typing"); setCodeCount(0); }, 350);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), 420);
    return () => clearTimeout(t);
  }, [phase, step, sample]);

  useEffect(() => {
    if (phase !== "typing") return;
    if (codeCount >= sample.code.length) {
      const t = setTimeout(() => setPhase("done"), 380);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCodeCount((c) => c + 1), 200);
    return () => clearTimeout(t);
  }, [phase, codeCount, sample]);

  function run(id: string) {
    const s = SAMPLES.find((x) => x.id === id) ?? SAMPLES[0];
    setActiveId(id);
    setInput(s.prompt);
    setPhase("generating");
    setStep(0);
    setCodeCount(0);
  }

  function pick(id: string) {
    setActiveId(id);
    setInput(SAMPLES.find((s) => s.id === id)?.prompt ?? "");
    setPhase("idle");
  }

  const typeMeta = TYPE_STYLES[sample.type] ?? TYPE_STYLES.Scripting;

  return (
    <div ref={wrapRef} style={{ width: "100%", maxWidth: 700, margin: "0 auto", fontFamily: INTER }}>      {/* prompt bar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "center", marginBottom: 14 }}>
        <div style={{ flex: "1 1 320px", display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(12px)", minWidth: 0 }}>
          <span style={{ color: "#a78bfa", fontSize: 14, flexShrink: 0 }}>✦</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe what you want to build…"
            onKeyDown={(e) => { if (e.key === "Enter") run(activeId); }}
            style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 13.5, fontFamily: INTER }}
          />
        </div>
        <button
          type="button"
          onClick={() => run(activeId)}
          disabled={phase === "generating" || phase === "typing"}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px", borderRadius: 12,
            background: "linear-gradient(135deg, #7c5cff 0%, #4f7cff 50%, #38bdf8 100%)",
            backgroundSize: "160% 160%", color: "#fff", fontWeight: 700, fontSize: 13.5, border: "none",
            cursor: "pointer", boxShadow: "0 8px 28px rgba(124,92,255,0.4)", transition: "transform 0.15s, box-shadow 0.15s, filter 0.15s",
            fontFamily: INTER, opacity: phase === "generating" || phase === "typing" ? 0.7 : 1,
          }}
          onMouseEnter={(e) => { const el = e.currentTarget as HTMLButtonElement; if (!el.disabled) { el.style.transform = "translateY(-1px)"; el.style.boxShadow = "0 12px 36px rgba(124,92,255,0.55)"; } }}
          onMouseLeave={(e) => { const el = e.currentTarget as HTMLButtonElement; el.style.transform = "translateY(0)"; el.style.boxShadow = "0 8px 28px rgba(124,92,255,0.4)"; }}
        >
          {phase === "generating" || phase === "typing" ? (
            <>
              <span style={{ width: 13, height: 13, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
              Generating…
            </>
          ) : (
            <>Generate
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            </>
          )}
        </button>
      </div>

      {/* sample chips */}
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", justifyContent: "center", marginBottom: 22 }}>
        {SAMPLES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => pick(s.id)}
            style={{
              padding: "6px 13px", borderRadius: 100, fontSize: 11.5, fontWeight: 600, cursor: "pointer",
              background: s.id === activeId ? "rgba(124,92,255,0.14)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${s.id === activeId ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.09)"}`,
              color: s.id === activeId ? "#fff" : "rgba(255,255,255,0.45)",
              transition: "background 0.15s, border-color 0.15s, color 0.15s", fontFamily: INTER,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* output panel with 3D tilt */}
      <div style={{ position: "relative", perspective: "1400px", transformStyle: "preserve-3d" }}
        onMouseMove={onPanelMove}
        onMouseLeave={() => setTilt({ rx: 0, ry: 0 })}
      >
        <div
          ref={panelRef}
          style={{
            borderRadius: 18,
            overflow: "hidden",
            background: "rgba(13,13,17,0.85)",
            border: `1px solid ${sample.accent}2e`,
            boxShadow: `0 30px 90px rgba(0,0,0,0.6), 0 0 90px ${sample.accent}12`,
            backdropFilter: "blur(20px)",
            textAlign: "left",
            transition: "border-color 0.4s, transform 0.18s ease-out, box-shadow 0.18s ease-out",
            transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
            transformStyle: "preserve-3d",
          }}
        >
          <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: 18, background: `radial-gradient(120% 120% at ${50 + tilt.ry * 3}% ${50 + tilt.rx * 3}%, ${sample.accent}14, transparent 55%)`, transition: "background 0.3s" }} />
          {/* header */}
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "11px 15px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", position: "relative" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57" }} />
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e" }} />
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840" }} />
            <span style={{ marginLeft: 10, fontSize: 11.5, color: "rgba(255,255,255,0.5)", fontFamily: MONO, letterSpacing: "0.3px" }}>{sample.file}</span>
            <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700, letterSpacing: "0.8px", padding: "3px 10px", borderRadius: 100, background: `${sample.accent}1f`, color: sample.accent, border: `1px solid ${sample.accent}44` }}>
              {typeMeta.chip} {sample.type.toUpperCase()}
            </span>
          </div>

        <div style={{ minHeight: 260, padding: "18px 20px", display: "flex", gap: 22 }}>
          {/* left: steps or code */}
          {phase === "idle" && (
            <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, padding: "30px 0" }}>
              <span style={{ fontSize: 30, color: "rgba(255,255,255,0.12)" }}>✦</span>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", fontFamily: INTER, textAlign: "center" }}>Describe what you want and press <b style={{ color: "#a78bfa" }}>Generate</b>.<br />Vexa writes it and drops it into Studio.</p>
            </div>
          )}

          {(phase === "generating") && (
            <div style={{ width: "100%", padding: "4px 0" }}>
              <StepList steps={sample.steps} done={step} />
            </div>
          )}

          {(phase === "typing" || phase === "done") && (
            <div style={{ width: "100%" }}>
              <div style={{ marginBottom: 12, fontSize: 11.5, color: "rgba(255,255,255,0.45)", display: "flex", alignItems: "center", gap: 8, fontFamily: INTER }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", border: `2px solid ${sample.accent}`, borderTopColor: "transparent", animation: "spin 1s linear infinite", display: "inline-block", flexShrink: 0 }} />
                Writing <span style={{ color: sample.accent, fontWeight: 600 }}>{sample.file}</span>…
              </div>
              <div style={{ fontFamily: MONO, fontSize: 12, lineHeight: 1.85, color: "#e8e9ec", minHeight: 150 }}>
                {sample.code.slice(0, codeCount).map((tokens, i) => (
                  <div key={i} style={{ whiteSpace: "pre-wrap" }}>
                    {tokens.map((t, j) => <span key={j} style={{ color: t.c }}>{t.s}</span>)}
                    {i === codeCount - 1 && phase === "typing" && (
                      <span style={{ display: "inline-block", width: 7, height: 13, background: sample.accent, verticalAlign: "text-bottom", marginLeft: 1, animation: "vxBlink2 0.85s step-end infinite" }} />
                    )}
                  </div>
                ))}
              </div>
              {phase === "done" && (
                <div style={{ marginTop: 14, padding: "11px 14px", borderRadius: 10, background: "rgba(62,207,142,0.07)", border: "1px solid rgba(62,207,142,0.22)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(62,207,142,0.16)", border: "1px solid rgba(62,207,142,0.4)", display: "flex", alignItems: "center", justifyContent: "center", color: "#3ecf8e", fontSize: 11 }}>✓</span>
                  <span style={{ fontSize: 12.5, color: "#3ecf8e", fontWeight: 600 }}>Inserted into Studio</span>
                  <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>{sample.summary}</span>
                  <button type="button" onClick={() => run(sample.id)} style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 600, color: sample.accent, background: `${sample.accent}1a`, border: `1px solid ${sample.accent}44`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: INTER }}>
                    ↻ Regenerate
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

        {/* floating depth chips */}
        <div className="vx-lg-chips" style={{ position: "absolute", top: -18, left: -26, zIndex: 4, transform: `translateZ(60px) translateY(${tilt.rx * 1.5}px)`, transition: "transform 0.2s ease-out", display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 13px", borderRadius: 100, background: "rgba(18,18,22,0.9)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 10px 34px rgba(0,0,0,0.5)", fontSize: 11.5, fontWeight: 600, color: "rgba(255,255,255,0.8)", animation: "vxFloatChip 5.5s ease-in-out infinite" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "linear-gradient(135deg,#a78bfa,#38bdf8)", boxShadow: "0 0 8px rgba(167,139,250,0.8)" }} /> Inserted into Studio
        </div>
        <div className="vx-lg-chips" style={{ position: "absolute", top: 34, right: -30, zIndex: 4, transform: `translateZ(70px) translateY(${tilt.rx * -1}px)`, transition: "transform 0.2s ease-out", display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 13px", borderRadius: 100, background: "rgba(18,18,22,0.9)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 10px 34px rgba(0,0,0,0.5)", fontSize: 11.5, fontWeight: 600, color: "rgba(255,255,255,0.8)", animation: "vxFloatChip 5.5s ease-in-out infinite 1.1s" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "linear-gradient(135deg,#38bdf8,#3ecf8e)", boxShadow: "0 0 8px rgba(56,189,248,0.8)" }} /> Wired remotes
        </div>
        <div className="vx-lg-chips" style={{ position: "absolute", bottom: -16, left: "12%", zIndex: 4, transform: `translateZ(50px) translateY(${tilt.rx * -2}px)`, transition: "transform 0.2s ease-out", display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 13px", borderRadius: 100, background: "rgba(18,18,22,0.9)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 10px 34px rgba(0,0,0,0.5)", fontSize: 11.5, fontWeight: 600, color: "rgba(255,255,255,0.8)", animation: "vxFloatChip 5.5s ease-in-out infinite 2s" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "linear-gradient(135deg,#f472b6,#a78bfa)", boxShadow: "0 0 8px rgba(244,114,182,0.8)" }} /> Production-ready
        </div>
        <style>{`
          @keyframes vxFloatChip { 0%,100% { translate: 0 0; } 50% { translate: 0 -8px; } }
          @media (max-width: 920px) {
            .vx-lg-chips { display: none !important; }
          }
        `}</style>
      </div>
    </div>
  );
}
