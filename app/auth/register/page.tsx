"use client";

import { useState } from "react";
import { supabase, supabaseEmail, AUTH_CALLBACK_URL } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";
import AuthVisual from "@/app/auth/AuthVisual";
import type { CSSProperties } from "react";

function makeToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

const BENEFITS = [
  "Script Luau validati automaticamente",
  "Animazioni reali in Moon Animator",
  "Modelli, VFX e sound AAA",
  "Contesto reale del tuo gioco",
]

export default function SignupPage() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [sent,     setSent]     = useState(false);
  const [sentEmail,setSentEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const handleResend = async () => {
    if (resending || resendCooldown > 0) return
    setResending(true)
    setResendMsg(null)
    const { error: err } = await supabaseEmail.auth.resend({ type: "signup", email: sentEmail })
    setResending(false)
    if (err) { setResendMsg(err.message); return }
    setResendMsg("Verification email sent. Check your inbox (and spam).")
    setResendCooldown(60)
    const t = setInterval(() => {
      setResendCooldown(c => {
        if (c <= 1) { clearInterval(t); return 0 }
        return c - 1
      })
    }, 1000)
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm)    { setError("Passwords don't match."); return; }
    if (password.length < 8)     { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    const { data, error: err } = await supabaseEmail.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: AUTH_CALLBACK_URL },
    });
    if (err) { setError(err.message); setLoading(false); return; }

    if (!data.session) {
      setSent(true);
      setSentEmail(email);
      setLoading(false);
      return;
    }

    const token = makeToken();
    window.location.href = `${window.location.origin}/onboarding?${token}`;
  };

  const fields = [
    { label: "Email",            type: "email" as const,    icon: "bi-envelope",    val: email,    set: setEmail,    ph: "you@example.com" },
    { label: "Password",         type: "password" as const, icon: "bi-lock",        val: password, set: setPassword, ph: "Min. 8 characters" },
    { label: "Confirm password", type: "password" as const, icon: "bi-shield-lock", val: confirm,  set: setConfirm,  ph: "Re-enter password" },
  ];

  return (
    <div style={S.screen}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.96) translateY(12px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes vxPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.35 } }
        @keyframes vxCaret { 0%,100% { opacity: 1 } 50% { opacity: 0 } }
        @keyframes ringSpin { to { transform: rotate(360deg) } }

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
        .vx-top-cta:hover { background: rgba(255,255,255,0.08) !important; color: #fff !important; }
        .vx-pw:hover { color: rgba(255,255,255,0.6) !important; }
        .vx-pw:active { background: rgba(255,255,255,0.08) !important; }
        .vx-benefit { display: flex; align-items: center; gap: 10px; font-size: 13px; color: rgba(255,255,255,0.55); }
        .vx-benefit i { color: #fcd846; font-size: 12px; }

        .vx-divider { display: flex; align-items: center; gap: 12px; margin: 20px 0; color: rgba(255,255,255,0.28); font-size: 12px; position: relative; }
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
        <Link href="/auth/login" className="vx-top-cta" style={S.topCta}>Sign in</Link>
      </header>

      <div style={S.wrap}>
        <aside className="vx-brand-panel" style={S.brandPanel}>
          <div style={S.brandGlow} />
          <div style={S.brandInner}>
            <div style={S.badge}><i className="bi bi-rocket-takeoff-fill" /> Free to start · No credit card</div>
            <h1 style={S.brandTitle}>Create your<br /><span className="grad-text" style={S.brandTitleAccent}>studio account</span>.</h1>
            <p style={S.brandSub}>Join builders who ship Roblox games faster with Vexa — the AI that writes into your Studio, not just chat text.</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 380 }}>
              {BENEFITS.map((b, i) => (
                <div key={b} className="vx-benefit" style={{ animation: `fadeUp .5s cubic-bezier(.16,1,.3,1) ${0.3 + i * 0.08}s both` }}>
                  <i className="bi bi-check-circle-fill" />
                  {b}
                </div>
              ))}
            </div>

            <div className="vx-visual">
              <AuthVisual />
            </div>

            <div style={S.quoteBox}>
              <i className="bi bi-chat-quote" style={{ color: "rgba(255,255,255,0.25)", fontSize: 18 }} />
              <span>&ldquo;Your idea. Vexa builds it. You make it yours.&rdquo;</span>
            </div>
          </div>
        </aside>

        <main style={S.formPanel}>
          <div style={S.card}>
            <div style={S.cardAura} />
            <div style={S.cardGlowA} />
            <div style={S.cardGlowB} />

            <div style={S.cardHeader}>
              <div className="vx-mobile-logo" style={S.mobileLogo}><Image src="/icons/vexa-logo.svg" alt="Vexa" width={40} height={40} style={{ objectFit: "contain" }} /></div>
              {!sent ? (
                <>
                  <h2 style={S.title}>Create your account</h2>
                  <p style={S.sub}>Start generating Roblox scripts with AI</p>
                </>
              ) : (
                <>
                  <h2 style={S.title}>Check your email</h2>
                  <p style={S.sub}>We sent a confirmation link to {sentEmail}</p>
                </>
              )}
            </div>

            {sent ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={S.sentBox}>
                  <div style={S.sentIcon}><i className="bi bi-envelope-check-fill" style={{ fontSize: 26, color: "#fcd846" }} /></div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.7, color: "rgba(255,255,255,0.6)", textAlign: "center" }}>
                    Open the email we sent to <strong style={{ color: "#fff" }}>{sentEmail}</strong> and press <strong style={{ color: "#fcd846" }}>Verify email</strong> to activate your account.
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.6, color: "rgba(255,255,255,0.32)", textAlign: "center" }}>
                    Didn&apos;t get it? Check your spam folder.
                  </div>
                  {resendMsg && (
                    <div style={{ fontSize: 12, color: resendMsg.startsWith("Verification") ? "#fcd846" : "#fc8181", textAlign: "center" }}>{resendMsg}</div>
                  )}
                  <button type="button" onClick={handleResend} disabled={resending || resendCooldown > 0} className="vx-neon-btn-ghost" style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                    padding: "10px 18px", borderRadius: 10,
                    color: "#c4b5fd", fontWeight: 700, fontSize: 13,
                    border: "1px solid rgba(167,139,250,0.30)",
                    background: "rgba(167,139,250,0.06)",
                    cursor: resending || resendCooldown > 0 ? "default" : "pointer",
                    opacity: resending || resendCooldown > 0 ? 0.6 : 1,
                  }}>
                    {resending ? (
                      <>
                        <div style={{ width: 13, height: 13, borderRadius: "50%", border: "2px solid rgba(167,139,250,0.3)", borderTopColor: "#c4b5fd", animation: "spin 0.7s linear infinite" }} />
                        Sending...
                      </>
                    ) : resendCooldown > 0 ? (
                      <>Resend in {resendCooldown}s</>
                    ) : (
                      <><i className="bi bi-arrow-clockwise" /> Resend email</>
                    )}
                  </button>
                </div>
                <Link href="/auth/login" className="vx-submit vx-neon-btn" style={{ marginTop: 6, height: 46, width: "100%", fontSize: 14, fontFamily: "inherit", textDecoration: "none" }}>
                  Go to sign in <i className="bi bi-arrow-right" style={{ fontSize: 14 }} />
                </Link>
              </div>
            ) : (
            <>
            {error && (
              <div style={S.errBox}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSignup} style={S.form}>
              {fields.map(f => (
                <div key={f.label} className="vx-field" style={S.field}>
                  <label style={S.label}>{f.label}</label>
                  <div style={S.inputWrap}>
                    <i className={"bi " + f.icon} style={S.inputIcon} />
                    <input
                      type={f.type === "password" && showPw ? "text" : f.type}
                      value={f.val}
                      onChange={e => f.set(e.target.value)}
                      placeholder={f.ph}
                      required
                      style={S.input}
                    />
                    {f.type === "password" && (
                      <button type="button" className="vx-pw" onClick={() => setShowPw(v => !v)} style={S.pwToggle} tabIndex={-1}>
                        <i className={"bi " + (showPw ? "bi-eye-slash" : "bi-eye")} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button type="submit" className="vx-submit vx-neon-btn" disabled={loading} style={{ marginTop: 6, height: 46, width: "100%", fontSize: 14, fontFamily: "inherit" }}>
                {loading ? (
                  <>
                    <span className="spinner" style={{ width: 15, height: 15, borderWidth: 2, borderColor: "rgba(6,8,16,0.3)", borderTopColor: "#060810" }} />
                    Creating account...
                  </>
                ) : (
                  <>
                    Create account <i className="bi bi-arrow-right" style={{ fontSize: 14 }} />
                  </>
                )}
              </button>
            </form>

            <p style={S.footer}>
              Already have an account?{" "}
              <Link href="/auth/login" style={S.link}>Sign in</Link>
            </p>
            <p style={S.tos}>By signing up you agree to the <span style={{ color: "rgba(255,255,255,0.55)", cursor: "pointer" }}>Terms</span> and <span style={{ color: "rgba(255,255,255,0.55)", cursor: "pointer" }}>Privacy Policy</span>.</p>
            </>
            )}
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
    position: "sticky", top: 0, zIndex: 20,
    height: 60,
    display: "flex", alignItems: "center", justifyContent: "space-between",
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
  brandPanel: { position: "relative", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 8px" },
  brandGlow: {
    position: "absolute", inset: -80,
    background: "radial-gradient(ellipse 60% 50% at 20% 30%, rgba(167,139,250,0.10) 0%, transparent 65%), radial-gradient(ellipse 50% 40% at 80% 70%, rgba(252,216,70,0.08) 0%, transparent 65%)",
    filter: "blur(40px)", pointerEvents: "none",
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
    fontSize: "clamp(34px,4.5vw,52px)", fontWeight: 800,
    letterSpacing: "-0.04em", lineHeight: 1.08, color: "#fff",
    marginBottom: 18,
    fontFamily: "'Space Grotesk', 'Inter', sans-serif",
    animation: "fadeUp .5s cubic-bezier(.16,1,.3,1) .08s both",
  },
  brandTitleAccent: {
    background: "linear-gradient(135deg, #ffe98a 0%, #fcd846 45%, #a78bfa 100%)",
    WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
  },
  brandSub: {
    fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.65,
    maxWidth: 460, marginBottom: 32,
    animation: "fadeUp .5s cubic-bezier(.16,1,.3,1) .16s both",
  },
  quoteBox: {
    display: "flex", alignItems: "center", gap: 10,
    marginTop: 34, fontSize: 12.5, color: "rgba(255,255,255,0.35)",
    fontStyle: "italic",
  },
  formPanel: { display: "flex", alignItems: "center", justifyContent: "center" },
  card: {
    position: "relative", overflow: "hidden", width: "100%",
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
  cardHeader: { position: "relative", marginBottom: 24 },
  mobileLogo: { display: "none", marginBottom: 18 },
  title: { fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", color: "#fff", marginBottom: 6, fontFamily: "'Space Grotesk', 'Inter', sans-serif" },
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
  sentBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 14,
    padding: "26px 18px",
    background: "rgba(252,216,70,0.05)",
    border: "1px solid rgba(252,216,70,0.16)",
    borderRadius: 14,
    animation: "fadeUp .3s ease both",
  },
  sentIcon: {
    width: 52,
    height: 52,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(252,216,70,0.10)",
    border: "1px solid rgba(252,216,70,0.24)",
  },
  form: { position: "relative", display: "flex", flexDirection: "column", gap: 15 },
  field: { display: "flex", flexDirection: "column", gap: 7 },
  label: {
    fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.45)",
    letterSpacing: "0.6px", textTransform: "uppercase",
  },
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
    marginTop: 6, height: 46,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    background: "linear-gradient(135deg, #fcd846 0%, #fcd846 50%, #ffe98a 100%)",
    border: "none", borderRadius: 12, color: "#060810",
    fontFamily: "inherit", fontSize: 14, fontWeight: 700,
    cursor: "pointer", width: "100%",
    boxShadow: "0 8px 28px rgba(252,216,70,0.35)",
    transition: "transform .2s cubic-bezier(.34,1.56,.64,1), box-shadow .2s, filter .2s",
  },
  footer: { position: "relative", marginTop: 20, fontSize: 13, color: "rgba(255,255,255,0.4)", textAlign: "center" },
  tos: { position: "relative", marginTop: 14, fontSize: 11, color: "rgba(255,255,255,0.25)", textAlign: "center", lineHeight: 1.6 },
  link: { color: "#a78bfa", textDecoration: "none", fontWeight: 700 },
};
