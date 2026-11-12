"use client";

import { useEffect, useRef, useState } from "react";

const INTER = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const TESTIMONIALS = [
  {
    quote: "I described a full trading system in one paragraph. Vexa wrote the entire module architecture, remotes, and validation — I barely edited anything.",
    name: "Kieran",
    role: "Solo developer · 2.1M visits",
    initials: "K",
    hue: "#a78bfa",
  },
  {
    quote: "The animation mode is unreal. It built a sword combo right inside Moon Animator — keyframes, easing, the lot. This saved me days.",
    name: "Mara",
    role: "Animator · working on a fighting game",
    initials: "M",
    hue: "#f472b6",
  },
  {
    quote: "As someone who can't script, Vexa is the difference between an idea and a shipped game. The VFX and 3D modes blew my mind.",
    name: "Dario",
    role: "Hobbyist builder",
    initials: "D",
    hue: "#38bdf8",
  },
  {
    quote: "It knows Luau better than any general AI I've tried. Typed parameters, proper service patterns, sane error handling. It just gets Roblox.",
    name: "Sofia",
    role: "Freelance scripter",
    initials: "S",
    hue: "#3ecf8e",
  },
];

function Testimonials() {
  return (
    <section style={{ padding: "clamp(64px,8vw,96px) clamp(18px,5vw,24px)", fontFamily: INTER, position: "relative" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <span className="vx-eyebrow-x">Loved by developers</span>
          <h2 className="vx-sec-title" style={{ marginTop: 14 }}>Ship faster, <span className="grad-text-anim">stress less.</span></h2>
          <p className="vx-sec-sub" style={{ maxWidth: 520 }}>Developers use Vexa to go from idea to working game without weeks of scripting.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          {TESTIMONIALS.map((t, i) => (
            <div
              key={i}
              className="vx-glow-card"
              style={{
                padding: "22px 22px",
                position: "relative",
                cursor: "default",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.borderColor = "rgba(252,216,70,0.35)";
                el.style.boxShadow = `0 24px 60px rgba(0,0,0,0.5), 0 0 44px ${t.hue}1c`;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.borderColor = "";
                el.style.boxShadow = "";
              }}
            >
              <div aria-hidden style={{ position: "absolute", top: -30, right: -20, fontSize: 90, fontWeight: 900, lineHeight: 1, color: t.hue, opacity: 0.08, fontFamily: "'Space Grotesk', Georgia, serif", userSelect: "none" }}>”</div>
              <p style={{ fontSize: 13.5, lineHeight: 1.75, color: "rgba(255,255,255,0.82)", margin: "0 0 18px", position: "relative" }}>{t.quote}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg, ${t.hue}, #1a1a22)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff", border: `1px solid ${t.hue}55` }}>{t.initials}</div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#fff" }}>{t.name}</div>
                  <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)" }}>{t.role}</div>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
                  {Array.from({ length: 5 }).map((_, s) => (
                    <span key={s} style={{ color: "#fbbf24", fontSize: 11 }}>★</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function useCountUp(target: number, duration = 1400) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !started.current) {
            started.current = true;
            const t0 = performance.now();
            const step = (now: number) => {
              const p = Math.min(1, (now - t0) / duration);
              const eased = 1 - Math.pow(1 - p, 3);
              setVal(Math.round(target * eased));
              if (p < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
            io.disconnect();
          }
        });
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [target, duration]);

  return { ref, val };
}

const STATS = [
  { value: 3, suffix: "s", label: "average time from prompt to working system" },
  { value: 100, suffix: "%", label: "free — no paywalls, no credit card, ever" },
  { value: 10, suffix: "+", label: "AI models to pick from for any task" },
  { value: 4, suffix: "", label: "output modes: Scripting · Animation · VFX · 3D" },
];

const LIVE_FEED = [
  { who: "Xylo", what: "Obbie checkpoints", type: "Scripting", when: "just now", hue: "#a78bfa" },
  { who: "Mari_98", what: "Volcano eruption VFX", type: "VFX", when: "14s ago", hue: "#f472b6" },
  { who: "NoobSlayer", what: "Dragon-bone greatsword", type: "3D Model", when: "31s ago", hue: "#3ecf8e" },
  { who: "R3x", what: "Ragdoll hit reactions", type: "Animation", when: "49s ago", hue: "#38bdf8" },
  { who: "Astrolyn", what: "Pet gacha system", type: "Scripting", when: "1m ago", hue: "#fbbf24" },
  { who: "Cr1t", what: "Thunderstorm skybox", type: "VFX", when: "2m ago", hue: "#f472b6" },
];

const FEED_TYPES: Record<string, string> = {
  Scripting: "</>",
  VFX: "✦",
  "3D Model": "◆",
  Animation: "◐",
};

function LiveFeed() {
  const [tick, setTick] = useState(0);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 8000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setOffset((o) => (o + 1) % LIVE_FEED.length), 5000);
    return () => clearInterval(id);
  }, []);

  const shown = Array.from({ length: Math.min(4, LIVE_FEED.length) }, (_, i) => LIVE_FEED[(offset + i) % LIVE_FEED.length]);

  return (
    <section style={{ padding: "clamp(40px,6vw,64px) clamp(18px,5vw,24px)", fontFamily: INTER, position: "relative" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, alignItems: "center" }}>
          <div className="vx-glow-card" style={{ padding: "24px 26px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span className="live-dot" style={{ background: "var(--lime)", boxShadow: "0 0 8px rgba(252,216,70,0.6)" }} />
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "1.4px", textTransform: "uppercase", color: "rgba(252,216,70,0.8)" }}>Live from the community</span>
            </div>
            <div style={{ fontSize: "clamp(34px,6vw,52px)", fontWeight: 700, letterSpacing: "-2px", lineHeight: 1, background: "var(--grad-lime-violet)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", fontVariantNumeric: "tabular-nums", fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>
              {328_412 + tick * 3}
            </div>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)", lineHeight: 1.55 }}>things built with Vexa this week.<br />Yours could be next.</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {shown.map((item, i) => (
              <div
                key={`${item.who}-${i}`}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 15px",
                  borderRadius: 13, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
                  animation: i === 0 ? "vxFeedIn 0.45s cubic-bezier(0.16,1,0.3,1)" : "none",
                  transform: i === 0 ? "translateX(-4px)" : "none",
                  opacity: 1 - i * 0.14,
                }}
              >
                <span style={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0, background: item.hue, boxShadow: `0 0 10px ${item.hue}` }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <span style={{ color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>{item.who} built </span>{item.what}
                  </div>
                  <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{item.when}</div>
                </div>
                <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.7px", padding: "3px 9px", borderRadius: 100, background: `${item.hue}1f`, color: item.hue, border: `1px solid ${item.hue}44` }}>
                  {FEED_TYPES[item.type]} {item.type.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`@keyframes vxFeedIn { from { opacity: 0; transform: translateX(-14px); } to { opacity: 1; transform: translateX(-4px); } }`}</style>
    </section>
  );
}

function StatCard({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const { ref, val } = useCountUp(value);
  return (
    <div
      ref={ref}
      className="vx-glow-card"
      style={{
        padding: "26px 20px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "clamp(30px,5vw,42px)", fontWeight: 700, letterSpacing: "-1.5px", lineHeight: 1, background: "var(--grad-lime-violet)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>
        {val}{suffix}
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 10, lineHeight: 1.5 }}>{label}</div>
    </div>
  );
}

function CountStats() {
  return (
    <section style={{ padding: "clamp(40px,6vw,64px) clamp(18px,5vw,24px)", fontFamily: INTER, position: "relative" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          {STATS.map((s) => (
            <StatCard key={s.label} value={s.value} suffix={s.suffix} label={s.label} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function Social({ showStats = true }: { showStats?: boolean }) {
  return (
    <>
      <LiveFeed />
      <Testimonials />
      {showStats && <CountStats />}
    </>
  );
}
