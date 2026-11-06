"use client";

import { useEffect, useState } from "react";
import { motion, useScroll, useSpring, useTransform } from "motion/react";
import { Aurora } from "./Aurora";
import { Starfield } from "./Starfield";
import { IdeMock } from "./IdeMock";

const INTER = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const DISPLAY = "'Space Grotesk', 'Inter', sans-serif";

const ROTATING = ["combat systems", "fire auras", "3D swords", "boss fights", "inventory systems", "racing tycoons"];

function RotatingWord() {
  const [i, setI] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setI((v) => (v + 1) % ROTATING.length);
        setVisible(true);
      }, 280);
    }, 2300);
    return () => clearInterval(id);
  }, []);

  return (
    <span
      className="vx-grad-x"
      style={{
        display: "inline-block",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(14px)",
        transition: "opacity 0.28s ease, transform 0.28s ease",
      }}
    >
      {ROTATING[i]}
    </span>
  );
}

const MARQUEE = ["Combat Systems", "Inventory & Data Stores", "Obbies & Puzzles", "Tycoons", "Admin Panels", "Animations & VFX", "Shop & Trading", "Racing Games", "NPCs & AI", "Sound Design"];

const fadeUp = {
  hidden: { opacity: 0, y: 28, filter: "blur(6px)" },
  show: (d: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.7, delay: d, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

export function Hero({ stats }: { stats: { value: string; label: string }[] }) {
  const { scrollYProgress } = useScroll();
  const y = useSpring(useTransform(scrollYProgress, [0, 0.35], [0, -110]), { stiffness: 90, damping: 24 });
  const glare = useTransform(scrollYProgress, [0, 0.35], [0, 0.35]);

  return (
    <section style={{ position: "relative", padding: "clamp(56px,7vw,84px) 0 0", overflow: "hidden", fontFamily: INTER, zIndex: 1 }}>
      <Aurora />
      <Starfield />
      <div aria-hidden className="vx-grid-bg" />
      <div aria-hidden className="vx-spot-hero" />

      {/* floating orbs */}
      <div aria-hidden className="vx-orb" style={{ top: "12%", left: "6%", width: 260, height: 260, background: "radial-gradient(circle, rgba(252,216,70,0.35), transparent 70%)" }} />
      <div aria-hidden className="vx-orb" style={{ top: "30%", right: "4%", width: 320, height: 320, background: "radial-gradient(circle, rgba(124,92,255,0.38), transparent 70%)", animationDelay: "-3s" }} />
      <div aria-hidden className="vx-orb" style={{ bottom: "6%", left: "34%", width: 200, height: 200, background: "radial-gradient(circle, rgba(125,211,252,0.30), transparent 70%)", animationDelay: "-6s" }} />

      <motion.div style={{ position: "relative", zIndex: 2, maxWidth: 1120, margin: "0 auto", padding: "0 clamp(18px,5vw,28px)", textAlign: "center", y, opacity: 1 }}>
        {/* badge */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0.05} style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "8px 16px", borderRadius: 100, background: "linear-gradient(180deg, rgba(252,216,70,0.09), rgba(252,216,70,0.02))", border: "1px solid rgba(252,216,70,0.28)", backdropFilter: "blur(12px)", fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,0.85)", marginBottom: 26, boxShadow: "0 6px 24px rgba(124,92,255,0.14), inset 0 1px 0 rgba(255,255,255,0.12)" }}>
          <span style={{ position: "relative", display: "inline-flex" }}>
            <span className="live-dot" style={{ background: "var(--lime)", boxShadow: "0 0 8px rgba(252,216,70,0.6)" }} />
            <span style={{ position: "absolute", inset: -4, borderRadius: "50%", border: "1px solid rgba(252,216,70,0.5)", animation: "vxRingPing 1.8s cubic-bezier(0,0,0.2,1) infinite" }} />
          </span>
          AI in Roblox Studio — Scripts · Animations · VFX · 3D · Sound
        </motion.div>

        {/* giant headline */}
        <motion.h1
          className="vx-display-x"
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={0.15}
          style={{ fontSize: "clamp(46px,8.5vw,110px)", marginBottom: 24, color: "#fff", textShadow: "0 20px 80px rgba(0,0,0,0.5)" }}
        >
          <span className="vx-metal-text">Describe it.</span>
          <br />
          <span style={{ color: "#fff" }}>Vexa builds </span>
          <RotatingWord />.
        </motion.h1>

        <motion.p variants={fadeUp} initial="hidden" animate="show" custom={0.3} style={{ fontSize: "clamp(15px,2.2vw,18px)", color: "#fff", lineHeight: 1.65, marginBottom: 34, maxWidth: 660, marginLeft: "auto", marginRight: "auto", opacity: 0.72, fontFamily: INTER }}>
          Type what you need in plain English. Vexa generates complete systems — typed Luau scripts, animations, VFX and 3D models — ready to drop into Roblox Studio.
        </motion.p>

        {/* CTAs */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0.45} style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginBottom: 34 }}>
          <a href="/download" className="vx-neon-btn" style={{ padding: "17px 34px", fontSize: 16, borderRadius: 16, fontFamily: DISPLAY }}>
            Download for Windows
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </a>
          <a href="#showcase" className="vx-neon-btn-ghost" style={{ padding: "17px 30px", fontSize: 16, borderRadius: 16, fontFamily: INTER }}>
            See it in action
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </a>
        </motion.div>

        {/* stats pills */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0.6} style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          {stats.map((s: { value: string; label: string }, i: number) => (
            <div key={i} style={{ display: "inline-flex", alignItems: "baseline", gap: 7, padding: "9px 16px", borderRadius: 100, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07)" }}>
              <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.5px", lineHeight: 1, background: "var(--grad-lime-violet)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", fontFamily: DISPLAY }}>{s.value}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>{s.label}</span>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* showstopper: IDE window */}
      <motion.div
        initial={{ opacity: 0, y: 60, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.75, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: "relative", zIndex: 2, marginTop: "clamp(48px,6vw,72px)", padding: "0 clamp(12px,3vw,28px)" }}
      >
        <div style={{ position: "absolute", left: "50%", top: "30%", transform: "translateX(-50%)", width: "80%", height: 300, background: "radial-gradient(ellipse, rgba(252,216,70,0.10), transparent 65%)", filter: "blur(60px)", zIndex: 0, pointerEvents: "none" }} />
        <motion.div style={{ opacity: glare, position: "relative", zIndex: 1 }}>
          <IdeMock />
        </motion.div>
      </motion.div>

      {/* scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 0.8 }}
        style={{ display: "flex", justifyContent: "center", margin: "clamp(28px,4vw,44px) 0 6px" }}
      >
        <span className="vx-scroll-hint">
          Scroll
          <span className="wheel" />
        </span>
      </motion.div>

      {/* marquee band (full bleed) */}
      <div style={{ position: "relative", zIndex: 2, marginTop: "clamp(40px,6vw,64px)", overflow: "hidden", background: "var(--grad-lime)", padding: "16px 0", transform: "rotate(-1.5deg)", width: "104%", marginLeft: "-2%" }}>
        <style>{`@keyframes vxMarqueeBand { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
        <div style={{ display: "flex", gap: 40, width: "max-content", animation: "vxMarqueeBand 26s linear infinite", alignItems: "center" }}>
          {[...MARQUEE, ...MARQUEE, ...MARQUEE].map((label, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 40, fontSize: 22, fontWeight: 700, color: "#060810", fontFamily: DISPLAY, letterSpacing: "-1px", whiteSpace: "nowrap" }}>
              {label}
              <span style={{ fontSize: 12, opacity: 0.5 }}>◆</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
