"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";

const ERRORS: Record<string, { title: string; desc: string }> = {
  access_denied:   { title: "Access Denied",         desc: "You cancelled the Roblox login. You can try again whenever you're ready." },
  missing_params:  { title: "Invalid Request",       desc: "Something went wrong with the OAuth redirect. Please try connecting again." },
  invalid_state:   { title: "Security Check Failed", desc: "The CSRF state token didn't match. This can happen if you have multiple tabs open. Please try again." },
  token_exchange:  { title: "Authentication Failed", desc: "We couldn't exchange the authorization code with Roblox. Please try again." },
  userinfo_failed: { title: "Profile Fetch Failed",  desc: "You authenticated successfully but we couldn't fetch your Roblox profile. Please try again." },
  server_error:    { title: "Server Error",          desc: "An unexpected error occurred on our end. Please try again in a moment." },
};

const FALLBACK = {
  title: "Something Went Wrong",
  desc:  "An unknown error occurred during authentication. Please try again.",
};

function OAuthErrorContent() {
  const params = useSearchParams();
  const code   = params.get("error") ?? "";
  const info   = ERRORS[code] ?? FALLBACK;

  return (
    <div style={S.screen}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        @keyframes scaleIn { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes oaeSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes oaeDrift { 0% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(4%,-6%,0) scale(1.12); } 100% { transform: translate3d(0,0,0) scale(1); } }
        @keyframes oaeDrift2 { 0% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(-5%,5%,0) scale(1.15); } 100% { transform: translate3d(0,0,0) scale(1); } }
        .oae-aur { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
        .oae-aur::after { content: ''; position: absolute; inset: 0; background-image: radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px); background-size: 26px 26px; opacity: 0.35; mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%); -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%); }
        .oae-blob { position: absolute; border-radius: 50%; filter: blur(120px); will-change: transform; }
        .oae-blob-a { width: 55vw; height: 55vw; left: -18vw; top: -16vw; background: rgba(252,216,70,0.18); animation: oaeDrift 22s ease-in-out infinite; }
        .oae-blob-b { width: 50vw; height: 50vw; right: -16vw; top: -8vw; background: rgba(167,139,250,0.20); animation: oaeDrift2 26s ease-in-out infinite; }
        .oae-blob-c { width: 46vw; height: 46vw; left: 28vw; bottom: -22vw; background: rgba(196,181,253,0.14); animation: oaeDrift 30s ease-in-out infinite reverse; }
        .oae-grain { position: fixed; inset: 0; z-index: 1; opacity: 0.55; pointer-events: none; mix-blend-mode: overlay; background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%25" height="100%25" filter="url(%23n)" opacity="0.5"/></svg>'); }
      `}</style>

      <div className="oae-aur" aria-hidden>
        <div className="oae-blob oae-blob-a" />
        <div className="oae-blob oae-blob-b" />
        <div className="oae-blob oae-blob-c" />
        <div className="oae-grain" />
      </div>

      <header style={S.topbar}>
        <a href="https://vexaaai.vercel.app" style={S.brand}>
          <Image src="/icons/vexa-mark-cream.png" alt="Vexa" width={26} height={26} style={{ objectFit: "contain" }} />
          <span style={S.brandName}>Vexa</span>
        </a>
      </header>


      <div style={S.card}>
        <div style={S.cardAura} aria-hidden />
        <div style={S.topGlow} aria-hidden />

        <div style={S.iconWrap}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f56565" strokeWidth="1.8">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8"   x2="12"    y2="12"/>
            <line x1="12" y1="16"  x2="12.01" y2="16"/>
          </svg>
        </div>

        {code && (
          <div style={S.codeBadge}>
            <span style={S.codeText}>error: {code}</span>
          </div>
        )}

        <h1 style={S.title}>{info.title}</h1>
        <p  style={S.desc}>{info.desc}</p>

        <div style={S.actions}>
          <a href="https://dash.vexaaai.vercel.app" style={S.btnPrimary}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Try Again
          </a>
          <a href="https://vexaaai.vercel.app" style={S.btnGhost}>
            Go Home
          </a>
        </div>

        <p style={S.helpText}>
          Still having issues? Contact us through our Roblox group or Discord.
        </p>
      </div>
    </div>
  );
}

export default function OAuthErrorPage() {
  return (
    <Suspense>
      <OAuthErrorContent />
    </Suspense>
  );
}

const S: Record<string, React.CSSProperties> = {
  screen:    { position: "relative", zIndex: 2, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 20px 40px" },
  topbar:    { position: "fixed", top: 0, left: 0, right: 0, height: 58, display: "flex", alignItems: "center", padding: "0 32px", borderBottom: "1px solid rgba(252,216,70,0.10)", background: "rgba(5,5,7,0.72)", backdropFilter: "blur(20px)", zIndex: 100 },
  brand:     { display: "flex", alignItems: "center", gap: 10, textDecoration: "none" },
  brandName: { fontSize: 14.5, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.3px", fontFamily: "'Space Grotesk', sans-serif" },
  card:      { width: "100%", maxWidth: 420, background: "rgba(20,20,26,0.72)", border: "1px solid rgba(252,216,70,0.14)", borderRadius: 20, backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)", boxShadow: "0 32px 80px rgba(0,0,0,0.65), 0 0 48px rgba(167,139,250,0.10)", padding: "40px 36px 36px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", position: "relative", overflow: "hidden", animation: "scaleIn 0.5s cubic-bezier(0.16,1,0.3,1) both" },
  cardAura:  { position: "absolute", top: "-55%", left: "-55%", width: "210%", height: "210%", background: "conic-gradient(from 0deg, rgba(167,139,250,0.12), rgba(252,216,70,0.12), rgba(196,181,253,0.09), rgba(167,139,250,0.12))", filter: "blur(70px)", animation: "oaeSpin 14s linear infinite", pointerEvents: "none" },
  topGlow:   { position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "100%", height: 160, background: "radial-gradient(ellipse at 50% -10%, rgba(245,101,101,0.14), transparent 70%)", pointerEvents: "none" },
  iconWrap:  { width: 60, height: 60, background: "rgba(245,101,101,0.08)", border: "1px solid rgba(245,101,101,0.20)", borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, position: "relative", boxShadow: "0 0 0 8px rgba(245,101,101,0.04)", zIndex: 1 },
  codeBadge: { padding: "3px 10px", background: "rgba(245,101,101,0.08)", border: "1px solid rgba(245,101,101,0.15)", borderRadius: 100, marginBottom: 14, position: "relative", zIndex: 1 },
  codeText:  { fontFamily: "var(--mono)", fontSize: 11, color: "#fc8181", letterSpacing: "0.3px" },
  title:     { fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px", color: "var(--text-primary)", marginBottom: 10, fontFamily: "'Space Grotesk', 'Inter', sans-serif", position: "relative", zIndex: 1 },
  desc:      { fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.65, marginBottom: 28, maxWidth: 320, position: "relative", zIndex: 1 },
  actions:   { display: "flex", flexDirection: "column", gap: 10, width: "100%", marginBottom: 20, position: "relative", zIndex: 1 },
  btnPrimary:{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px 20px", background: "linear-gradient(135deg, #fcd846 0%, #fcd846 55%, #ffe98a 100%)", border: "none", borderRadius: 10, color: "#060810", fontSize: 14, fontWeight: 700, textDecoration: "none", fontFamily: "'Space Grotesk', sans-serif", boxShadow: "0 4px 18px rgba(252,216,70,0.35)", transition: "all 0.2s" },
  btnGhost:  { display: "flex", alignItems: "center", justifyContent: "center", padding: "11px 20px", background: "rgba(252,216,70,0.04)", border: "1px solid rgba(252,216,70,0.14)", borderRadius: 10, color: "var(--text-secondary)", fontSize: 14, fontWeight: 500, textDecoration: "none", fontFamily: "'Space Grotesk', sans-serif", transition: "all 0.2s" },
  helpText:  { fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.6, position: "relative", zIndex: 1 },
};