"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, supabaseEmail, AUTH_CALLBACK_URL } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";
import AuthVisual from "@/app/auth/AuthVisual";
import type { CSSProperties } from "react";

const FEATURES = [
  { icon: "bi-cpu", title: "Scripts professionali", desc: "Luau di qualità AAA, validato e corretto" },
  { icon: "bi-person-raised-hand", title: "Animazioni Moon Animator", desc: "Motion capture-level direttamente in Studio" },
  { icon: "bi-box", title: "Modelli 3D", desc: "Asset compositi con materiali realistici" },
  { icon: "bi-stars", title: "VFX & Sound", desc: "Effetti professionali pronti all'uso" },
]

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOAuth = async (provider: "discord" | "google") => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + "/auth/callback?next=/local" },
    });
    if (error) setError(error.message);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) { setError(err.message); setLoading(false); return; }

    router.push("/local");
  };

  return (
    <div style={S.screen}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.96) translateY(12px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes vxPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.35 } }
        @keyframes vxCaret { 0%,100% { opacity: 1 } 50% { opacity: 0 } }
        @keyframes ringSpin { to { transform: rotate(360deg) } }
        @keyframes vxSpin { to { transform: rotate(360deg) } }
        @keyframes vxLogoFloat { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }

        .vx-field input:focus {
          border-color: rgba(252,216,70,0.55) !important;
          box-shadow: 0 0 0 3px rgba(252,216,70,0.14), 0 0 24px rgba(252,216,70,0.10) !important;
          background: rgba(28,28,36,0.7) !important;
        }
        .vx-field input:hover:not(:focus) { border-color: rgba(255,255,255,0.18) !important; background: rgba(255,255,255,0.06) !important; }
        .vx-submit:hover:not(:disabled) {
          transform: translateY(-2px) scale(1.01);
          box-shadow: 0 12px 40px rgba(252,216,70,0.5);
          filter: brightness(1.08);
        }
        .vx-submit:active:not(:disabled) { transform: translateY(0) scale(0.98); }
        .vx-social:hover { background: rgba(255,255,255,0.07) !important; border-color: rgba(255,255,255,0.2) !important; transform: translateY(-1px); }
        .vx-top-cta:hover { background: rgba(255,255,255,0.08) !important; color: #fff !important; }
        .vx-feat:hover { background: rgba(255,255,255,0.05) !important; border-color: rgba(255,255,255,0.12) !important; transform: translateY(-2px); }
        .vx-pw:hover { color: rgba(255,255,255,0.6) !important; }
        .vx-pw:active { background: rgba(255,255,255,0.08) !important; }

        .vx-divider { display: flex; align-items: center; gap: 12px; margin: 22px 0; color: rgba(255,255,255,0.28); font-size: 12px; position: relative; }
        .vx-divider::before, .vx-divider::after { content: ""; flex: 1; height: 1px; background: rgba(255,255,255,0.08); }

        @media (max-width: 900px) {
          .vx-brand-panel { display: none !important; }
        }
        @media (max-width: 520px) {
          .vx-mobile-logo { display: flex !important; }
        }
        @media (max-height: 860px) {
          .vx-visual { display: none !important; }
        }
      `}</style>
      <div className="amb" style={{ zIndex: 0 }}>
        <div className="amb-blob blob-a" style={{ background: "radial-gradient(circle, rgba(167,139,250,0.14) 0%, transparent 65%)" }} />
        <div className="amb-blob blob-b" style={{ background: "radial-gradient(circle, rgba(252,216,70,0.12) 0%, transparent 65%)" }} />
        <div className="amb-blob blob-c" style={{ background: "radial-gradient(circle, rgba(157,139,255,0.10) 0%, transparent 65%)" }} />
        <div className="stars" />
      </div>

      <header style={S.topbar}>
        <a href="https://vexaaai.vercel.app" style={S.brand}>
          <div style={S.logoBox}><Image src="/icons/vexa-logo.svg" alt="Vexa" width={20} height={20} style={{ objectFit: "contain" }} /></div>
          <span style={S.brandName}>Vexa</span>
        </a>
        <Link href="/auth/register" className="vx-top-cta" style={S.topCta}>Create account</Link>
      </header>

      <div style={S.wrap}>
        {/* Brand panel */}
        <aside className="vx-brand-panel" style={S.brandPanel}>
          <div style={S.brandGlow} />
          <div style={S.brandInner}>
            <div style={S.badge}><i className="bi bi-lightning-charge-fill" /> The AI Studio for Roblox</div>            <h1 style={S.brandTitle}>Build the<br /><span className="grad-text" style={S.brandTitleAccent}>impossible</span>.</h1>
            <p style={S.brandSub}>Vexa genera script, animazioni, modelli, VFX e sound direttamente dentro Roblox Studio. Tu descrivi — lei costruisce.</p>

            <div style={S.featureGrid}>
              {FEATURES.map((f, i) => (
                <div key={f.title} className="vx-feat" style={{ ...S.featureItem, animation: `fadeUp .5s cubic-bezier(.16,1,.3,1) ${0.3 + i * 0.08}s both` }}>
                  <div style={S.featureIcon}><i className={"bi " + f.icon} /></div>
                  <div>
                    <div style={S.featureTitle}>{f.title}</div>
                    <div style={S.featureDesc}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="vx-visual">
              <AuthVisual />
            </div>

            <div style={S.quoteBox}>
              <i className="bi bi-chat-quote" style={{ color: "rgba(255,255,255,0.25)", fontSize: 18 }} />
              <span>&ldquo;The fastest way from idea to working Roblox game.&rdquo;</span>
            </div>
          </div>
        </aside>

        {/* Form panel */}
        <main style={S.formPanel}>
          <div style={S.card}>
            <div style={S.cardAura} />
            <div style={S.cardGlowA} />
            <div style={S.cardGlowB} />

            <div style={S.cardHeader}>
              <div className="vx-mobile-logo" style={S.mobileLogo}><Image src="/icons/vexa-logo.svg" alt="Vexa" width={40} height={40} style={{ objectFit: "contain" }} /></div>
              <h2 style={S.title}>Welcome back</h2>
              <p style={S.sub}>Sign in to your Vexa account</p>
            </div>

            {error && (
              <div style={S.errBox}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} style={S.form}>
              <div className="vx-field" style={S.field}>
                <label style={S.label}>Email</label>
                <div style={S.inputWrap}>
                  <i className="bi bi-envelope" style={S.inputIcon} />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    style={S.input}
                  />
                </div>
              </div>
              <div className="vx-field" style={S.field}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={S.label}>Password</label>
                  <span style={S.forgot} onClick={() => { if (!email) { setError("Enter your email first."); return; } supabaseEmail.auth.resetPasswordForEmail(email, { redirectTo: `${AUTH_CALLBACK_URL}?next=/auth/login` }).then(({ error }) => { if (error) setError(error.message); else setError(null); alert("Password reset link sent to your email."); }); }}>Forgot?</span>
                </div>
                <div style={S.inputWrap}>
                  <i className="bi bi-lock" style={S.inputIcon} />
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    style={S.input}
                  />
                  <button type="button" className="vx-pw" onClick={() => setShowPw(v => !v)} style={S.pwToggle} tabIndex={-1}>
                    <i className={"bi " + (showPw ? "bi-eye-slash" : "bi-eye")} />
                  </button>
                </div>
              </div>
              <button type="submit" className="vx-submit vx-neon-btn" disabled={loading} style={{ marginTop: 6, height: 46, width: "100%", fontSize: 14, fontFamily: "inherit" }}>
                {loading ? (
                  <>
                    <span className="spinner" style={{ width: 15, height: 15, borderWidth: 2, borderColor: "rgba(6,8,16,0.3)", borderTopColor: "#060810" }} />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in <i className="bi bi-arrow-right" style={{ fontSize: 14 }} />
                  </>
                )}
              </button>
            </form>

            <div className="vx-divider">
              <span>or continue with</span>
            </div>

            <div style={S.socialRow}>
              <button type="button" className="vx-social" style={S.socialBtn} onClick={() => handleOAuth("discord")}>
                <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#fff" d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.25-.37.57-.5.87a15.9 15.9 0 0 0-4.86 0 11.8 11.8 0 0 0-.51-.87.09.09 0 0 0-.08-.03 15.35 15.35 0 0 0-2.26 1.33.09.09 0 0 0-.04.04C4.07 8.6 3.46 11.76 3.75 14.9a.11.11 0 0 0 .04.07 15.4 15.4 0 0 0 4.7 2.38.1.1 0 0 0 .11-.04c.36-.5.69-1.02.96-1.58a.1.1 0 0 0-.06-.14 10 10 0 0 1-.54-.26.1.1 0 0 1-.01-.17 7 7 0 0 0 .23-.19.1.1 0 0 1 .1-.01 10.5 10.5 0 0 0 8.79 0 .1.1 0 0 1 .1.01l.23.19a.1.1 0 0 1 0 .17 6.5 6.5 0 0 1-.55.26.1.1 0 0 0-.05.14c.27.56.6 1.08.97 1.58a.1.1 0 0 0 .11.04 15.4 15.4 0 0 0 4.7-2.38.1.1 0 0 0 .04-.07c.34-3.56-.57-6.7-2.38-9.52a.08.08 0 0 0-.04-.04ZM9.4 12.78c-.96 0-1.74-.88-1.74-1.96s.77-1.96 1.74-1.96 1.75.88 1.74 1.96c0 1.08-.77 1.96-1.74 1.96Zm5.2 0c-.96 0-1.74-.88-1.74-1.96s.77-1.96 1.74-1.96 1.75.88 1.74 1.96c0 1.08-.77 1.96-1.74 1.96Z"/></svg>
                Discord
              </button>
              <button type="button" className="vx-social" style={S.socialBtn} onClick={() => handleOAuth("google")}>
                <i className="bi bi-google" style={{ fontSize: 15 }} />
                Google
              </button>
            </div>

            <p style={S.footer}>
              Don&apos;t have an account?{" "}
              <Link href="/auth/register" style={S.link}>Sign up free</Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  screen: {
    minHeight: "100vh",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    background: "transparent",
  },
  topbar: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    height: 60,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 clamp(16px,5vw,36px)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(7,7,10,0.7)",
    backdropFilter: "blur(20px)",
  },
  brand: { display: "flex", alignItems: "center", gap: 10, textDecoration: "none" },
  logoBox: {
    width: 32, height: 32, borderRadius: 9,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "linear-gradient(135deg, rgba(252,216,70,0.22), rgba(167,139,250,0.18))",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  brandName: { fontSize: 15, fontWeight: 800, color: "#fff", letterSpacing: "-0.3px" },
  topCta: {
    fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.6)",
    textDecoration: "none", padding: "7px 14px", borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    transition: "all .18s",
  },
  wrap: {
    flex: 1,
    display: "grid",
    gridTemplateColumns: "minmax(0,1fr) minmax(420px, 460px)",
    maxWidth: 1200,
    width: "100%",
    margin: "0 auto",
    padding: "clamp(32px,6vh,64px) clamp(16px,5vw,40px) clamp(24px,5vh,48px)",
    gap: "clamp(32px,6vw,72px)",
    alignItems: "center",
  },
  brandPanel: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    padding: "0 8px",
  },
  brandGlow: {
    position: "absolute",
    inset: -80,
    background: "radial-gradient(ellipse 60% 50% at 20% 30%, rgba(167,139,250,0.10) 0%, transparent 65%), radial-gradient(ellipse 50% 40% at 80% 70%, rgba(252,216,70,0.08) 0%, transparent 65%)",
    filter: "blur(40px)",
    pointerEvents: "none",
  },
  brandInner: { position: "relative" },
  badge: {
    display: "inline-flex", alignItems: "center", gap: 7,
    fontSize: 12, fontWeight: 700, color: "var(--lime-bright, #ffe98a)",
    padding: "7px 14px", borderRadius: 100,
    border: "1px solid rgba(252,216,70,0.30)",
    background: "linear-gradient(180deg, rgba(252,216,70,0.10), rgba(252,216,70,0.03))",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 6px 24px rgba(252,216,70,0.10)",
    marginBottom: 20,
    animation: "fadeUp .5s cubic-bezier(.16,1,.3,1) both",
  },
  brandTitle: {
    fontSize: "clamp(34px,4.5vw,52px)",
    fontWeight: 800,
    letterSpacing: "-0.04em",
    lineHeight: 1.08,
    color: "#fff",
    marginBottom: 18,
    fontFamily: "'Space Grotesk', 'Inter', sans-serif",
    animation: "fadeUp .5s cubic-bezier(.16,1,.3,1) .08s both",
  },
  brandTitleAccent: {
    background: "linear-gradient(135deg, #ffe98a 0%, #fcd846 45%, #a78bfa 100%)",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  brandSub: {
    fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.65,
    maxWidth: 460, marginBottom: 34,
    animation: "fadeUp .5s cubic-bezier(.16,1,.3,1) .16s both",
  },
  featureGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, maxWidth: 520 },
  featureItem: {
    display: "flex", alignItems: "flex-start", gap: 12,
    padding: 14, borderRadius: 14,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    transition: "background .2s, border-color .2s, transform .2s",
  },
  featureIcon: {
    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "linear-gradient(135deg, rgba(252,216,70,0.20), rgba(167,139,250,0.18))",
    border: "1px solid rgba(255,255,255,0.10)",
    color: "#fff", fontSize: 15,
  },
  featureTitle: { fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 },
  featureDesc: { fontSize: 11.5, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 },
  quoteBox: {
    display: "flex", alignItems: "center", gap: 10,
    marginTop: 30, fontSize: 12.5, color: "rgba(255,255,255,0.35)",
    fontStyle: "italic",
  },
  formPanel: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    position: "relative",
    overflow: "hidden",
    width: "100%",
    background: "rgba(12,13,19,0.72)",
    border: "1px solid rgba(252,216,70,0.10)",
    borderRadius: 24,
    backdropFilter: "blur(32px) saturate(1.5)",
    WebkitBackdropFilter: "blur(32px) saturate(1.5)",
    boxShadow: "0 30px 90px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 70px rgba(252,216,70,0.05)",
    padding: "clamp(28px,5vw,44px) clamp(24px,5vw,40px)",
    animation: "scaleIn .55s cubic-bezier(.16,1,.3,1) both",
  },
  cardAura: {
    position: "absolute",
    top: "-45%", left: "-45%", width: "190%", height: "190%",
    background: "conic-gradient(from 0deg, rgba(167,139,250,0.10), rgba(252,216,70,0.10), rgba(196,181,253,0.08), rgba(167,139,250,0.10))",
    filter: "blur(70px)",
    pointerEvents: "none",
    animation: "ringSpin 14s linear infinite",
  },
  cardGlowA: {
    position: "absolute", top: -120, right: -120, width: 280, height: 280,
    background: "radial-gradient(circle, rgba(167,139,250,0.16) 0%, transparent 65%)",
    pointerEvents: "none",
  },
  cardGlowB: {
    position: "absolute", bottom: -140, left: -100, width: 260, height: 260,
    background: "radial-gradient(circle, rgba(252,216,70,0.12) 0%, transparent 65%)",
    pointerEvents: "none",
  },
  cardHeader: { position: "relative", marginBottom: 26 },
  mobileLogo: { display: "none", marginBottom: 18 },
  title: {
    fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em",
    color: "#fff", marginBottom: 6,
    fontFamily: "'Space Grotesk', 'Inter', sans-serif",
  },
  sub: { fontSize: 14, color: "rgba(255,255,255,0.45)" },
  errBox: {
    position: "relative",
    display: "flex", alignItems: "center", gap: 9,
    padding: "11px 14px",
    background: "rgba(245,101,101,0.07)",
    border: "1px solid rgba(245,101,101,0.20)",
    borderRadius: 10,
    color: "#fc8181", fontSize: 13,
    marginBottom: 18, width: "100%",
    animation: "fadeUp .3s ease both",
  },
  form: { position: "relative", display: "flex", flexDirection: "column", gap: 16 },
  field: { display: "flex", flexDirection: "column", gap: 7 },
  label: {
    fontSize: 11, fontWeight: 700,
    color: "rgba(255,255,255,0.45)",
    letterSpacing: "0.6px", textTransform: "uppercase",
  },
  forgot: { fontSize: 12, fontWeight: 600, color: "rgba(167,139,250,0.8)", cursor: "pointer", textTransform: "none", letterSpacing: 0 },
  inputWrap: { position: "relative" },
  inputIcon: {
    position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)",
    fontSize: 14, color: "rgba(255,255,255,0.3)", pointerEvents: "none",
  },
  input: {
    padding: "12px 40px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 12,
    color: "#fff",
    fontFamily: "inherit",
    fontSize: 14,
    outline: "none",
    width: "100%",
    transition: "border-color .2s, box-shadow .2s, background .2s",
  },
  pwToggle: {
    position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
    width: 30, height: 30, borderRadius: 8,
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "rgba(255,255,255,0.35)", fontSize: 14, cursor: "pointer",
    transition: "color .15s",
  },
  submitBtn: {
    marginTop: 6,
    height: 46,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    background: "linear-gradient(135deg, #fcd846 0%, #fcd846 50%, #ffe98a 100%)",
    border: "none",
    borderRadius: 12,
    color: "#060810",
    fontFamily: "inherit",
    fontSize: 14, fontWeight: 700,
    cursor: "pointer",
    width: "100%",
    boxShadow: "0 8px 28px rgba(252,216,70,0.35)",
    transition: "transform .2s cubic-bezier(.34,1.56,.64,1), box-shadow .2s, filter .2s",
  },
  divider: {
    position: "relative",
    display: "flex", alignItems: "center", gap: 12,
    margin: "22px 0",
    color: "rgba(255,255,255,0.28)", fontSize: 12,
  },
  socialRow: { position: "relative", display: "flex", gap: 10 },
  socialBtn: {
    flex: 1, height: 42,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 11,
    color: "rgba(255,255,255,0.75)",
    fontFamily: "inherit", fontSize: 13, fontWeight: 600,
    cursor: "pointer",
    transition: "background .18s, border-color .18s, transform .18s",
  },
  footer: {
    position: "relative",
    marginTop: 22,
    fontSize: 13,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
  },
  link: { color: "#a78bfa", textDecoration: "none", fontWeight: 700 },
};
