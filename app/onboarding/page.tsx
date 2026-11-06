"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import type { CSSProperties } from "react";

export default function OnboardingPage() {
  const [step, setStep] = useState<"profile" | "discord">("profile");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  // ── Grab user ID from session ─────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.id) {
        setUserId(user.id);
      } else {
        setError("No session found. Please sign in first.");
      }
    });
  }, []);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();



    setError(null);


    setTimeout(async () => {
      const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
      if (clean.length < 3) {
        setError("Username must be at least 3 characters.");
        return;
      }
      if (!displayName.trim()) {
        setError("Display name is required.");
        return;
      }

      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        setError("No session found.");
        setLoading(false);
        return;
      }


      const { error: err } = await supabase.from("profiles").upsert({
        id: user.id,
        username: clean,
        display_name: displayName.trim(),
      });

      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }

      setLoading(false);
      setTransitioning(true);

      setTimeout(() => {
        setStep("discord");
        setTransitioning(false);
      }, 380);
    }, 10);
  };

  const handleDiscord = () => {
    const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
    if (!userId)   { alert("Profile ID not found. Please refresh and try again."); return; }
    if (!clientId) { alert("Server configuration error: Missing Client ID");       return; }

    const url = new URL("https://discord.com/oauth2/authorize");
    url.searchParams.set("client_id",     clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri",  "https://www.vexaaai.vercel.app/api/auth/discord/callback");
    url.searchParams.set("scope",         "identify guilds.join");
    url.searchParams.set("state",         userId);


    window.open(url.toString(), "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <style>{css}</style>

      <div className="vx-sky" style={{ position: "fixed", inset: 0, zIndex: 0 }} />

      <div style={S.screen}>
        <header style={S.topbar}>
          <a href="https://vexaaai.vercel.app" style={S.brand}>
            <Image
              src="/icons/vexa-mark-cream.png"
              alt="Vexa"
              width={22}
              height={22}
              style={{ objectFit: "contain" }}
            />
            <span style={S.brandName}>Vexa</span>
          </a>
        </header>

        <div
          style={{
            ...S.card,
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0) scale(1)" : "translateY(20px) scale(0.98)",
            transition: "opacity 0.55s cubic-bezier(.22,1,.36,1), transform 0.55s cubic-bezier(.22,1,.36,1)",
          }}
        >
          <video autoPlay loop muted playsInline style={S.cardVideo}>
            <source src="/assets/background.mp4" type="video/mp4" />
          </video>

          <div
            style={{
              ...S.cardContent,
              opacity: transitioning ? 0 : 1,
              transform: transitioning ? "translateY(6px)" : "translateY(0)",
              transition: "opacity 0.3s ease, transform 0.3s ease",
            }}
          >
            <Image
              src="/icons/vexa-mark-cream.png"
              alt="Vexa"
              width={44}
              height={44}
              style={{ objectFit: "contain", marginBottom: 20 }}
            />

            {step === "profile" && (
              <>
                <h1 style={S.title}>Set up your profile</h1>
                <p style={S.sub}>One-time setup for your Vexa account</p>

                {error && (
                  <div className="error-shake" style={S.errBox}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {error}
                  </div>
                )}

                <form onSubmit={handleProfileSubmit} style={S.form}>
                  <div style={S.field}>
                    <label style={S.label}>Username</label>
                    <div style={{
                      ...S.inputWrap,
                      borderColor: focusedField === "username" ? "rgba(252,216,70,0.55)" : "var(--border-default)",
                    }}>
                      <span style={S.prefix}>@</span>
                      <input
                        value={username}
                        onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                        onFocus={() => setFocusedField("username")}
                        onBlur={() => setFocusedField(null)}
                        placeholder="your_handle"
                        style={S.inputInner}
                      />
                    </div>
                  </div>

                  <div style={S.field}>
                    <label style={S.label}>Display name</label>
                    <input
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      onFocus={() => setFocusedField("display")}
                      onBlur={() => setFocusedField(null)}
                      placeholder="Your Name"
                      style={{
                        ...S.input,
                        borderColor: focusedField === "display" ? "rgba(252,216,70,0.55)" : "var(--border-default)",
                      }}
                    />
                  </div>

                  <button type="submit" disabled={loading} style={S.submitBtn} className="btn-hover">
                    {loading ? "Saving..." : "Continue"}
                  </button>
                </form>
              </>
            )}

            {step === "discord" && (
              <>
                <h1 style={S.title}>Almost there</h1>
                <p style={S.sub}>Connect your Discord account to finish setup</p>

                <button onClick={handleDiscord} style={S.discordBtn} className="btn-hover">
                  <DiscordIcon />
                  Continue with Discord
                </button>

                <a
                  href="/dashboard"
                  style={{
                    marginTop: 14,
                    fontSize: 13,
                    color: "var(--text-tertiary)",
                    textDecoration: "none",
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = "var(--text-secondary)" }}
                  onMouseLeave={e => { e.currentTarget.style.color = "var(--text-tertiary)" }}
                >
                  Skip for now →
                </a>
              </>
            )}

            <div style={S.dots}>
              <div style={{ ...S.dot, background: "var(--text-primary)", transform: "scale(1.15)" }} />
              <div style={{
                ...S.dot,
                background: step === "discord" ? "var(--text-primary)" : "rgba(255,255,255,0.2)",
                transform: step === "discord" ? "scale(1.15)" : "scale(1)",
              }} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function DiscordIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 8, flexShrink: 0 }}>
      <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026c.462-.62.874-1.275 1.226-1.963a.075.075 0 0 0-.041-.104 13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z"/>
    </svg>
  );
}

const S: Record<string, CSSProperties> = {
  screen: {
    position: "relative",
    zIndex: 1,
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "clamp(72px,10vw,80px) clamp(16px,5vw,20px) clamp(32px,6vw,40px)",
    background: "transparent",
  },
  topbar: {
    position: "fixed",
    top: 0, left: 0, right: 0,
    height: 60,
    display: "flex",
    alignItems: "center",
    padding: "0 clamp(16px,5vw,36px)",
    borderBottom: "1px solid var(--border-subtle)",
    background: "var(--topbar-bg)",
    backdropFilter: "blur(20px)",
    zIndex: 10,
  },
  brand: { display: "flex", alignItems: "center", gap: 10, textDecoration: "none" },
  brandName: { fontSize: 15, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.3px" },
  card: {
    position: "relative",
    overflow: "hidden",
    width: "100%",
    maxWidth: 400,
    background: "rgba(12,13,18,0.82)",
    border: "1px solid rgba(252,216,70,0.16)",
    borderRadius: 20,
    backdropFilter: "blur(24px)",
    boxShadow: "0 24px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 60px rgba(167,139,250,0.07)",
    padding: "clamp(28px,7vw,40px) clamp(22px,6vw,36px)",
  },
  cardVideo: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    opacity: 0.18,
    zIndex: 0,
    pointerEvents: "none",
  },
  cardContent: {
    position: "relative",
    zIndex: 1,
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  title: {
    fontSize: "clamp(20px,5vw,22px)",
    fontWeight: 800,
    letterSpacing: "-0.5px",
    color: "var(--text-primary)",
    marginBottom: 6,
    fontFamily: "'Space Grotesk', 'Inter', sans-serif",
  },
  sub: { fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 },
  errBox: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "11px 14px",
    background: "rgba(245,101,101,0.07)",
    border: "1px solid rgba(245,101,101,0.20)",
    borderRadius: 8,
    color: "#fc8181",
    fontSize: 13,
    marginBottom: 16,
    width: "100%",
  },
  form: { width: "100%", display: "flex", flexDirection: "column", gap: 14 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-tertiary)",
    letterSpacing: "0.6px",
    textTransform: "uppercase",
  },
  inputWrap: {
    display: "flex",
    alignItems: "center",
    padding: "0 14px",
    background: "var(--surface-2)",
    border: "1px solid",
    borderRadius: 10,
    transition: "border-color 0.15s",
  },
  prefix: {
    color: "var(--text-tertiary)",
    fontSize: 14,
    fontWeight: 600,
    userSelect: "none",
  },
  inputInner: {
    flex: 1,
    padding: "11px 8px",
    background: "transparent",
    border: "none",
    outline: "none",
    color: "var(--text-primary)",
    fontFamily: "var(--font)",
    fontSize: 14,
  },
  input: {
    padding: "11px 14px",
    background: "var(--surface-2)",
    border: "1px solid",
    borderRadius: 10,
    color: "var(--text-primary)",
    fontFamily: "var(--font)",
    fontSize: 14,
    outline: "none",
    width: "100%",
    transition: "border-color 0.15s",
  },
  submitBtn: {
    marginTop: 6,
    padding: "12px",
    background: "linear-gradient(135deg, #fcd846 0%, #fcd846 50%, #ffe98a 100%)",
    border: "none",
    borderRadius: 10,
    color: "#060810",
    fontFamily: "var(--font)",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    width: "100%",
    boxShadow: "0 8px 28px rgba(252,216,70,0.3)",
  },
  discordBtn: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 10,
    border: "none",
    background: "#5865F2",
    color: "white",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    boxShadow: "0 4px 20px rgba(88,101,242,0.3)",
  },
  dots: {
    display: "flex",
    gap: 6,
    justifyContent: "center",
    marginTop: 28,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    transition: "background 0.35s ease, transform 0.35s ease",
  },
};

const css = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-5px); }
    40% { transform: translateX(5px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
  }
  .error-shake { animation: shake 0.45s ease; }
  .btn-hover { transition: opacity 0.15s, transform 0.18s cubic-bezier(.22,1,.36,1) !important; }
  .btn-hover:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px) !important; }
  .btn-hover:active:not(:disabled) { transform: translateY(0) !important; }
  .btn-hover:disabled { opacity: 0.6; cursor: not-allowed; }
`;
