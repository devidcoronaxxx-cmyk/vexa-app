import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Access Revoked",
  robots: { index: false, follow: false },
};

export default async function BannedPage({
  searchParams,
}: {
  searchParams?: Promise<{ reason?: string }>;
}) {
  const params = await searchParams;
  const rawReason = params?.reason;

  const cleanedReason = rawReason
    ? decodeURIComponent(rawReason)
        .replace(/[-_]/g, " ")
        .trim()
    : null;

  const formattedReason = cleanedReason
    ? cleanedReason
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    : null;

  return (
    <div style={S.screen}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700;800&display=swap');
        @keyframes banFadeUp { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes banSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes banDrift { 0% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(4%,-6%,0) scale(1.12); } 100% { transform: translate3d(0,0,0) scale(1); } }
        @keyframes banDrift2 { 0% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(-5%,5%,0) scale(1.15); } 100% { transform: translate3d(0,0,0) scale(1); } }
        .ban-aur { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
        .ban-aur::after { content: ''; position: absolute; inset: 0; background-image: radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px); background-size: 26px 26px; opacity: 0.35; mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%); -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%); }
        .ban-blob { position: absolute; border-radius: 50%; filter: blur(120px); will-change: transform; }
        .ban-blob-a { width: 55vw; height: 55vw; left: -18vw; top: -16vw; background: rgba(252,216,70,0.18); animation: banDrift 22s ease-in-out infinite; }
        .ban-blob-b { width: 50vw; height: 50vw; right: -16vw; top: -8vw; background: rgba(167,139,250,0.20); animation: banDrift2 26s ease-in-out infinite; }
        .ban-blob-c { width: 46vw; height: 46vw; left: 28vw; bottom: -22vw; background: rgba(196,181,253,0.14); animation: banDrift 30s ease-in-out infinite reverse; }
        .ban-grain { position: fixed; inset: 0; z-index: 1; opacity: 0.55; pointer-events: none; mix-blend-mode: overlay; background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%25" height="100%25" filter="url(%23n)" opacity="0.5"/></svg>'); }
      `}</style>

      <div className="ban-aur" aria-hidden>
        <div className="ban-blob ban-blob-a" />
        <div className="ban-blob ban-blob-b" />
        <div className="ban-blob ban-blob-c" />
        <div className="ban-grain" />
      </div>

      <div style={S.card}>
        <div style={S.cardAura} aria-hidden />
        <div style={S.topGlow} aria-hidden />

        <div style={S.iconWrap}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fc8181" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <h1 style={S.title}>Access Revoked</h1>

        <p style={S.sub}>
          Sorry, but you&apos;re banned from Vexa services.
        </p>

        {formattedReason && (
          <p style={S.reason}>
            Reason: <span style={{ color: "#f5f5f5", fontWeight: 700 }}>{formattedReason}</span>
          </p>
        )}

        <a href="https://vexaaai.vercel.app" style={S.btn}>
          Go home
        </a>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  screen: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 24,
    textAlign: "center",
    background: "transparent",
    position: "fixed",
    inset: 0,
    fontFamily: "'Space Grotesk', 'Inter', sans-serif",
    zIndex: 2,
  },
  card: {
    position: "relative",
    overflow: "hidden",
    width: "100%",
    maxWidth: 440,
    background: "rgba(20,20,26,0.72)",
    border: "1px solid rgba(252,216,70,0.14)",
    borderRadius: 20,
    backdropFilter: "blur(28px)",
    WebkitBackdropFilter: "blur(28px)",
    boxShadow: "0 32px 80px rgba(0,0,0,0.65), 0 0 48px rgba(167,139,250,0.10)",
    padding: "44px 36px 40px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    animation: "banFadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both",
  },
  cardAura: {
    position: "absolute",
    top: "-55%", left: "-55%", width: "210%", height: "210%",
    background: "conic-gradient(from 0deg, rgba(167,139,250,0.12), rgba(252,216,70,0.12), rgba(196,181,253,0.09), rgba(167,139,250,0.12))",
    filter: "blur(70px)",
    animation: "banSpin 14s linear infinite",
    pointerEvents: "none",
  },
  topGlow: {
    position: "absolute",
    top: 0, left: "50%", transform: "translateX(-50%)",
    width: "100%", height: 160,
    background: "radial-gradient(ellipse at 50% -10%, rgba(245,101,101,0.14), transparent 70%)",
    pointerEvents: "none",
  },
  iconWrap: {
    width: 60, height: 60,
    background: "rgba(245,101,101,0.08)",
    border: "1px solid rgba(245,101,101,0.20)",
    borderRadius: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    position: "relative",
    boxShadow: "0 0 0 8px rgba(245,101,101,0.04)",
    zIndex: 1,
  },
  title: {
    fontSize: "clamp(24px, 5vw, 32px)",
    fontWeight: 800,
    color: "#f5f5f5",
    letterSpacing: "-1px",
    margin: 0,
    marginBottom: 10,
    position: "relative",
    zIndex: 1,
  },
  sub: {
    fontSize: "clamp(14px, 3vw, 15px)",
    fontWeight: 500,
    color: "rgba(245,245,245,0.5)",
    margin: 0,
    lineHeight: 1.6,
    maxWidth: 420,
    position: "relative",
    zIndex: 1,
  },
  reason: {
    fontSize: "clamp(14px, 3vw, 15px)",
    fontWeight: 600,
    color: "rgba(245,245,245,0.45)",
    marginTop: 6,
    position: "relative",
    zIndex: 1,
  },
  btn: {
    marginTop: 26,
    padding: "12px 26px",
    background: "linear-gradient(135deg, #fcd846 0%, #fcd846 50%, #ffe98a 100%)",
    border: "none",
    borderRadius: 10,
    color: "#060810",
    fontSize: 13,
    fontWeight: 700,
    textDecoration: "none",
    fontFamily: "'Space Grotesk', sans-serif",
    boxShadow: "0 4px 20px rgba(252,216,70,0.35)",
    transition: "transform .2s, filter .2s",
    position: "relative",
    zIndex: 1,
  },
};
