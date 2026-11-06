"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { CSSProperties } from "react";

type Status = "idle" | "loading" | "done" | "error" | "no_account";

interface User {
  username: string;
  userId: string;
  avatarUrl?: string | null;
  robloxUserId?: number | null;
}

function RobloxAvatar({ userId, size = 36 }: { userId: number; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const initial = String(userId).charAt(0).toUpperCase();

  useEffect(() => {
    fetch(`/api/roblox-avatar?userId=${userId}`)
      .then((r) => r.json())
      .then((d) => { if (d.url) setUrl(d.url); })
      .catch(() => {});
  }, [userId]);

  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "1.5px solid rgba(255,255,255,0.11)" }}>
      {url ? (
        <img src={url} width={size} height={size} alt="" style={{ objectFit: "cover", width: "100%", height: "100%", display: "block" }} />
      ) : (
        <div style={{ width: "100%", height: "100%", background: "rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.4), fontWeight: 700, color: "#e0e0e0", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.5px" }}>
          {initial}
        </div>
      )}
    </div>
  );
}

function AccountAvatar({ user, size = 36 }: { user: User; size?: number }) {
  if (user.robloxUserId) return <RobloxAvatar userId={user.robloxUserId} size={size} />;
  if (user.avatarUrl) return <img src={user.avatarUrl} width={size} height={size} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1.5px solid rgba(255,255,255,0.11)", display: "block" }} />;
  return <div style={S.accountAvatar}>{user.username.slice(0, 2).toUpperCase()}</div>;
}

export function VerifyDiscordClient({
  code,
  discordId,
  user,
}: {
  code: string | null;
  discordId: string | null;
  user: User | null;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errMsg, setErrMsg] = useState("");
  const startedRef = useRef(false);

  const verify = async () => {
    if (!code || !discordId || !user || status === "loading") return;
    setStatus("loading");
    setErrMsg("");
    try {
      const res = await fetch("/api/verify-discord", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, discordId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        if (data.error === "no_account") { setStatus("no_account"); return; }
        setErrMsg(data.error === "expired" ? "This code has expired. Go back to Discord and click Verify again." : data.details || "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      setStatus("done");
    } catch {
      setErrMsg("Network error. Please try again.");
      setStatus("error");
    }
  };

  const verifyRef = useRef(verify)
  useEffect(() => { verifyRef.current = verify })

  useEffect(() => {
    if (!code || !discordId || !user) return;
    if (startedRef.current) return;
    startedRef.current = true;
    verifyRef.current();
  }, [code, discordId, user]);

  if (!code || !discordId) {
    return (
      <Shell badge="Discord Verify">
        <Card>
          <StatusPill color="#f87171" label="Invalid link" />
          <h1 style={S.title}>Something&apos;s wrong</h1>
          <p style={S.sub}>This link is missing required information. Head back to Discord and click Verify again.</p>
          <a href="https://dash.vexaaai.vercel.app" style={S.btnGhost}>Go to dashboard</a>
        </Card>
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell badge="Discord Verify">
        <Card>
          <StatusPill color="rgba(255,255,255,0.4)" label="Sign in required" />
          <h1 style={S.title}>Sign in first</h1>
          <p style={S.sub}>You need a Vexa account to verify your Discord. Sign in and this page will continue automatically.</p>
          <a href={`https://dash.vexaaai.vercel.app/login?redirect=${encodeURIComponent(`/verify-discord?code=${code}&discordId=${discordId}`)}`} style={S.btnPrimary}>Sign in to continue</a>
        </Card>
      </Shell>
    );
  }

  if (status === "no_account") {
    return (
      <Shell badge="Discord Verify">
        <Card>
          <StatusPill color="#f87171" label="No account found" />
          <h1 style={S.title}>No account found</h1>
          <p style={S.sub}>We couldn&apos;t find a Vexa account. Create a free account to get access.</p>
          <a href="https://dash.vexaaai.vercel.app/register" style={S.btnPrimary}>Create an account</a>
          <a href={`https://dash.vexaaai.vercel.app/login?redirect=${encodeURIComponent(`/verify-discord?code=${code}&discordId=${discordId}`)}`} style={{ ...S.btnGhost, marginTop: 10 }}>Sign in with a different account</a>
        </Card>
      </Shell>
    );
  }

  if (status === "done") {
    return (
      <Shell badge="Discord Verify">
        <Card video="/assets/background.mp4">
          <StatusPill color="#fcd846" label="Verified" glow />
          <h1 style={S.title}>You&apos;re linked.</h1>
          <p style={S.sub}>
            Discord is verified for <strong style={{ color: "#f0f0f0", fontWeight: 600 }}>{user.username}</strong>. Head back to the server — your role has been assigned.
          </p>
          <div style={S.infoCard}>
            <div style={S.infoRow}><span style={S.infoKey}>Account</span><span style={S.infoVal}>{user.username}</span></div>
            <div style={S.infoDivider} />
            <div style={S.infoRow}><span style={S.infoKey}>Discord</span><span style={S.infoVal}>#{discordId}</span></div>
            <div style={S.infoDivider} />
            <div style={S.infoRow}><span style={S.infoKey}>Status</span><span style={{ ...S.infoVal, color: "#fcd846" }}>Verified</span></div>
          </div>
          <a href="https://dash.vexaaai.vercel.app" style={S.btnGhost}>Open dashboard</a>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell badge="Discord Verify">
      <Card>
        {status === "loading" ? (
          <StatusPill color="#facc15" label="Verifying" pulse />
        ) : status === "error" ? (
          <StatusPill color="#f87171" label="Failed" />
        ) : (
          <StatusPill color="rgba(255,255,255,0.3)" label="Awaiting verification" />
        )}
        <h1 style={S.title}>
          {status === "loading" ? "Verifying..." : status === "error" ? "Verification failed" : "Verify Discord"}
        </h1>
        <p style={S.sub}>
          {status === "loading"
            ? "Linking your Discord account to Vexa."
            : status === "error"
            ? errMsg
            : "Connect your Discord account to your Vexa account to get server access."}
        </p>
        <div style={S.accountChip}>
          <AccountAvatar user={user} size={36} />
          <div>
            <div style={S.accountName}>{user.username}</div>
            <div style={S.accountSub}>Vexa account</div>
          </div>
          <div style={S.accountCheckmark}><i className="bi bi-check" style={{ fontSize: 11 }} /></div>
        </div>
        {status === "error" && (
          <div style={S.errBox}>
            <i className="bi bi-exclamation-circle" style={{ fontSize: 13, flexShrink: 0 }} />
            <span>{errMsg}</span>
          </div>
        )}
        {status === "loading" ? (
          <div style={S.loaderTrack}><div style={S.loaderFill} /></div>
        ) : (
          <button onClick={verify} style={{ ...S.btnPrimary, border: "none", width: "100%", cursor: "pointer" }}>
            {status === "error" ? "Try again" : "Verify Discord"}
          </button>
        )}
        <p style={S.footnote}>Head back to Discord once verified.</p>
      </Card>
    </Shell>
  );
}

function StatusPill({ color, label, glow = false, pulse = false }: { color: string; label: string; glow?: boolean; pulse?: boolean }) {
  return (
    <div style={S.pill}>
      <span style={{ ...S.pillDot, background: color, ...(glow ? { boxShadow: `0 0 8px ${color}` } : {}), ...(pulse ? { animation: "glcPulse 1.4s ease infinite" } : {}) }} />
      <span style={S.pillLabel}>{label}</span>
    </div>
  );
}

function Shell({ children, badge }: { children: React.ReactNode; badge: string }) {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        @import url('https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css');
        @keyframes glcFadeUp { from { opacity: 0; transform: translateY(14px) scale(0.99); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes glcPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.65); } }
        @keyframes glcMarch { from { transform: translateX(-100%); } to { transform: translateX(350%); } }
        @keyframes glcSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes glcDrift { 0% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(4%,-6%,0) scale(1.12); } 100% { transform: translate3d(0,0,0) scale(1); } }
        @keyframes glcDrift2 { 0% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(-5%,5%,0) scale(1.15); } 100% { transform: translate3d(0,0,0) scale(1); } }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: transparent; }
        .glc-shell { min-height: 100vh; background: transparent; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px 48px; font-family: 'Space Grotesk', sans-serif; -webkit-font-smoothing: antialiased; position: relative; overflow: hidden; }
        .glc-aur { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
        .glc-aur::after { content: ''; position: absolute; inset: 0; background-image: radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px); background-size: 26px 26px; opacity: 0.35; mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%); -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%); }
        .glc-blob { position: absolute; border-radius: 50%; filter: blur(120px); will-change: transform; }
        .glc-blob-a { width: 55vw; height: 55vw; left: -18vw; top: -16vw; background: rgba(252,216,70,0.18); animation: glcDrift 22s ease-in-out infinite; }
        .glc-blob-b { width: 50vw; height: 50vw; right: -16vw; top: -8vw; background: rgba(167,139,250,0.20); animation: glcDrift2 26s ease-in-out infinite; }
        .glc-blob-c { width: 46vw; height: 46vw; left: 28vw; bottom: -22vw; background: rgba(196,181,253,0.14); animation: glcDrift 30s ease-in-out infinite reverse; }
        .glc-blob-d { width: 30vw; height: 30vw; right: 12vw; bottom: -10vw; background: rgba(252,216,70,0.10); animation: glcDrift2 24s ease-in-out infinite; }
        .glc-grain { position: fixed; inset: 0; z-index: 1; opacity: 0.55; pointer-events: none; mix-blend-mode: overlay; background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%25" height="100%25" filter="url(%23n)" opacity="0.5"/></svg>'); }
        .glc-shell > * { position: relative; z-index: 2; }
        .glc-topbar { position: fixed; top: 0; left: 0; right: 0; height: 54px; display: flex; align-items: center; justify-content: space-between; padding: 0 28px; border-bottom: 1px solid rgba(252,216,70,0.10); background: rgba(5,5,7,0.72); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); z-index: 100; }
        .glc-brand { display: flex; align-items: center; gap: 10px; text-decoration: none; }
        .glc-brand-name { font-size: 14px; font-weight: 700; color: #e8f5c8; letter-spacing: -0.3px; }
        .glc-topbar-badge { font-size: 11px; font-weight: 500; color: rgba(217,249,157,0.85); background: rgba(252,216,70,0.08); border: 1px solid rgba(252,216,70,0.16); padding: 3px 10px; border-radius: 100px; letter-spacing: 0.3px; }
        .glc-card { width: 100%; max-width: 420px; background: rgba(20,20,26,0.72); border: 1px solid rgba(252,216,70,0.14); border-radius: 20px; padding: 36px 32px 32px; position: relative; overflow: hidden; animation: glcFadeUp 0.45s cubic-bezier(0.16,1,0.3,1) both; backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px); box-shadow: 0 0 0 1px rgba(252,216,70,0.03) inset, 0 32px 80px rgba(0,0,0,0.55), 0 0 48px rgba(167,139,250,0.10); }
        .glc-card::before { content: ''; position: absolute; top: -55%; left: -55%; width: 210%; height: 210%; background: conic-gradient(from 0deg, rgba(167,139,250,0.12), rgba(252,216,70,0.12), rgba(196,181,253,0.09), rgba(167,139,250,0.12)); filter: blur(70px); animation: glcSpin 14s linear infinite; pointer-events: none; }
        .glc-card-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.14; z-index: 0; pointer-events: none; }
        .glc-card-content { position: relative; z-index: 1; }
        @media (max-width: 480px) { .glc-card { padding: 28px 24px 28px; border-radius: 16px; } .glc-topbar { padding: 0 20px; } }
      `}</style>
      <div className="glc-shell">
        <div className="glc-aur" aria-hidden>
          <div className="glc-blob glc-blob-a" />
          <div className="glc-blob glc-blob-b" />
          <div className="glc-blob glc-blob-c" />
          <div className="glc-blob glc-blob-d" />
          <div className="glc-grain" />
        </div>
        <header className="glc-topbar">
          <a href="https://vexaaai.vercel.app" className="glc-brand">
            <Image src="/icons/vexa-mark-cream.png" alt="Vexa" width={22} height={22} style={{ objectFit: "contain" }} />
            <span className="glc-brand-name">Vexa</span>
          </a>
          <span className="glc-topbar-badge">{badge}</span>
        </header>
        {children}
      </div>
    </>
  );
}

function Card({ children, video }: { children: React.ReactNode; video?: string }) {
  return (
    <div className="glc-card">
      {video && <video className="glc-card-video" src={video} autoPlay loop muted playsInline />}
      <div className={video ? "glc-card-content" : undefined}>{children}</div>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  pill: { display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 20 },
  pillDot: { width: 7, height: 7, borderRadius: "50%", flexShrink: 0 },
  pillLabel: { fontSize: 12, fontWeight: 600, color: "rgba(217,249,157,0.75)", letterSpacing: "0.1px" },
  title: { fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px", color: "#f4f7e8", lineHeight: 1.15, marginBottom: 10, fontFamily: "'Space Grotesk', sans-serif" },
  sub: { fontSize: 14, color: "rgba(240,240,240,0.5)", lineHeight: 1.65, marginBottom: 28 },
  accountChip: { display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "rgba(252,216,70,0.05)", border: "1px solid rgba(252,216,70,0.12)", borderRadius: 12, marginBottom: 20 },
  accountAvatar: { width: 36, height: 36, borderRadius: "50%", background: "rgba(252,216,70,0.08)", border: "1px solid rgba(252,216,70,0.16)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#ffe98a", flexShrink: 0, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.5px" },
  accountName: { fontSize: 14, fontWeight: 600, color: "#f0f0f0", lineHeight: 1.2 },
  accountSub: { fontSize: 11.5, color: "rgba(240,240,240,0.35)", marginTop: 2 },
  accountCheckmark: { marginLeft: "auto", width: 22, height: 22, borderRadius: "50%", background: "rgba(252,216,70,0.10)", border: "1px solid rgba(252,216,70,0.20)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fcd846", flexShrink: 0 },
  infoCard: { background: "rgba(252,216,70,0.05)", border: "1px solid rgba(252,216,70,0.12)", borderRadius: 12, padding: "4px 0", marginBottom: 20 },
  infoRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", gap: 12 },
  infoDivider: { height: 1, background: "rgba(252,216,70,0.08)", margin: "0 16px" },
  infoKey: { fontSize: 13, color: "rgba(240,240,240,0.35)", fontWeight: 400 },
  infoVal: { fontSize: 13, fontWeight: 600, color: "rgba(240,240,240,0.8)" },
  errBox: { display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.16)", borderRadius: 10, color: "#f87171", fontSize: 13, marginBottom: 16, lineHeight: 1.5 },
  loaderTrack: { width: "100%", height: 2, background: "rgba(252,216,70,0.08)", borderRadius: 999, overflow: "hidden", marginBottom: 20 },
  loaderFill: { height: "100%", width: "30%", background: "linear-gradient(90deg, rgba(252,216,70,0.4), #fcd846)", borderRadius: 999, animation: "glcMarch 1.6s ease-in-out infinite" },
  btnPrimary: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: "100%", padding: "13px 20px", background: "linear-gradient(135deg, #fcd846 0%, #fcd846 55%, #ffe98a 100%)", backgroundSize: "160% 160%", color: "#060810", borderRadius: 10, fontSize: 14, fontWeight: 700, letterSpacing: "-0.2px", textDecoration: "none", cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", boxShadow: "0 4px 20px rgba(252,216,70,0.35), inset 0 1px 0 rgba(255,255,255,0.25)", transition: "transform 0.2s, box-shadow 0.2s, background-position 0.4s, opacity 0.15s" },
  btnGhost: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: "100%", padding: "12px 20px", background: "rgba(252,216,70,0.04)", color: "rgba(217,249,157,0.75)", border: "1px solid rgba(252,216,70,0.14)", borderRadius: 10, fontSize: 14, fontWeight: 500, textDecoration: "none", cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", transition: "border-color 0.15s, color 0.15s" },
  footnote: { fontSize: 12, color: "rgba(240,240,240,0.25)", marginTop: 18, lineHeight: 1.55, textAlign: "center" as const },
};