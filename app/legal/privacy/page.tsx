import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "../../components/navbar";
import { Footer } from "../../components/footer";

export const metadata: Metadata = {
  title: "Privacy Policy | Vexa",
  description:
    "How Vexa collects, uses, and protects your data when you use the free AI-powered Roblox script generator and plugin.",
  alternates: { canonical: "https://vexaaai.vercel.app/legal/privacy" },
};

const LAST_UPDATED = "August 8, 2026";

export default function PrivacyPage() {
  return (
    <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", background: "#d8d5c8" }}>
      <style>{`
        @keyframes prAurDrift { 0% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(4%,-6%,0) scale(1.12); } 100% { transform: translate3d(0,0,0) scale(1); } }
        @keyframes prAurDrift2 { 0% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(-5%,5%,0) scale(1.15); } 100% { transform: translate3d(0,0,0) scale(1); } }
        .pr-aur { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
        .pr-aur::after { content: ''; position: absolute; inset: 0; background-image: radial-gradient(rgba(28, 27, 26,0.14) 1px, transparent 1px); background-size: 26px 26px; opacity: 0.35; mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%); -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%); }
        .pr-blob { position: absolute; border-radius: 50%; filter: blur(120px); will-change: transform; }
        .pr-blob-a { width: 55vw; height: 55vw; left: -18vw; top: -16vw; background: rgba(252,216,70,0.16); animation: prAurDrift 22s ease-in-out infinite; }
        .pr-blob-b { width: 50vw; height: 50vw; right: -16vw; top: -8vw; background: rgba(167,139,250,0.18); animation: prAurDrift2 26s ease-in-out infinite; }
        .pr-blob-c { width: 46vw; height: 46vw; left: 28vw; bottom: -22vw; background: rgba(196,181,253,0.12); animation: prAurDrift 30s ease-in-out infinite reverse; }
        .pr-grain { position: fixed; inset: 0; z-index: 1; opacity: 0.55; pointer-events: none; mix-blend-mode: overlay; background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%25" height="100%25" filter="url(%23n)" opacity="0.5"/></svg>'); }
      `}</style>

      <div className="pr-aur" aria-hidden>
        <div className="pr-blob pr-blob-a" />
        <div className="pr-blob pr-blob-b" />
        <div className="pr-blob pr-blob-c" />
        <div className="pr-grain" />
      </div>

      <Navbar
        activePage="privacy"
        rightSlot={
          <div className="topbar-actions" style={{ display: "flex", gap: 8 }}>
            <Link href="/legal/terms" className="btn btn-ghost btn-sm">Terms of Service</Link>
            <a href="/download" className="btn btn-primary btn-sm">Download App</a>
          </div>
        }
      />

      <main style={S.main}>
        <div style={S.pageHeader}>
          <div style={S.badge}>Legal</div>
          <h1 style={S.h1}>Privacy Policy</h1>
          <p style={S.lastUpdated}>Last updated: {LAST_UPDATED}</p>
          <p style={S.intro}>This Privacy Policy explains how Vexa Studios collects, uses, and protects your information when you use Vexa. We are committed to protecting your privacy and being transparent about our data practices.</p>
        </div>

        <div style={S.content}>
          <Section title="1. Information We Collect">
            <P>When you use Vexa, we collect the following information:</P>
            <List items={[
              "Roblox username and display name (via OAuth2 authentication)",
              "Roblox user ID (to identify your session)",
              "Roblox avatar URL (to display your profile picture in the dashboard)",
              "Prompts you submit to the AI generator",
              "Basic usage data such as generation requests and timestamps",
            ]} />
            <P>We do NOT collect your Roblox password, Robux balance, inventory, private messages, or any sensitive account data.</P>
          </Section>
          <Section title="2. How We Use Your Information">
            <P>We use the information we collect to:</P>
            <List items={[
              "Authenticate your identity via Roblox OAuth2",
              "Display your username and avatar in the dashboard",
              "Process and respond to your AI generation requests",
              "Improve the quality and accuracy of our AI models",
              "Monitor for abuse and enforce our Terms of Service",
            ]} />
            <P>We do not sell, rent, or trade your personal information to third parties for their marketing purposes.</P>
          </Section>
          <Section title="3. Authentication & Sessions">
            <P>We use Roblox OAuth2 to authenticate users. When you sign in, Roblox provides us with an access token stored in a secure, httpOnly cookie on your browser. This cookie expires when your session ends or when the Roblox token expires.</P>
            <P>We do not store your Roblox access token on our servers beyond the duration of your session.</P>
          </Section>
          <Section title="4. Cookies">
            <P>We use the following cookies:</P>
            <List items={[
              "vexa_session — stores your encrypted session data, httpOnly, expires with your Roblox token",
              "roblox_oauth_state — a temporary CSRF protection token used during the OAuth flow, deleted after login",
            ]} />
            <P>We do not use advertising cookies, tracking pixels, or any third-party analytics cookies.</P>
          </Section>
          <Section title="5. Cloudflare">
            <P>We use Cloudflare for DDoS protection, performance optimization, and human verification (Turnstile). Cloudflare may collect certain technical data including IP addresses as part of its security services.</P>
            <P>Cloudflare Turnstile is used to verify that users are human before authenticating. The verification process is privacy-preserving and does not use tracking cookies.</P>
          </Section>
          <Section title="6. Data Storage & Security">
            <P>Session data is stored in encrypted cookies on your browser. We do not maintain a persistent database of user accounts or generated scripts. We implement HTTPS encryption, httpOnly cookies, and CSRF protection.</P>
          </Section>
          <Section title="7. Third-Party Services">
            <P>Vexa integrates with:</P>
            <List items={[
              "Roblox — for OAuth2 authentication (governed by Roblox's Privacy Policy)",
              "Cloudflare — for security and performance (governed by Cloudflare's Privacy Policy)",
              "Vercel — for hosting and deployment (governed by Vercel's Privacy Policy)",
            ]} />
          </Section>
          <Section title="8. Your Rights">
            <P>You have the right to access, delete, or opt out of data collection by discontinuing use of the Service. You can withdraw your Roblox OAuth authorization at any time via your Roblox account settings.</P>
          </Section>
          <Section title="9. Contact Us">
            <P>If you have any questions about this Privacy Policy, please contact us through our Roblox group or Discord community. We aim to respond to all privacy-related inquiries within 48 hours.</P>
          </Section>
        </div>

        <div style={S.legalNav}>
          <Link href="/legal/terms" style={S.legalNavLink}>← Terms of Service</Link>
        </div>
      </main>

      <Footer maxWidth={760} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section style={S.section}><h2 style={S.sectionTitle}>{title}</h2>{children}</section>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={S.p}>{children}</p>;
}
function List({ items }: { items: string[] }) {
  return (
    <ul style={S.list}>
      {items.map((item, i) => (
        <li key={i} style={S.listItem}><span style={S.listDot} />{item}</li>
      ))}
    </ul>
  );
}

const S: Record<string, React.CSSProperties> = {
  main:         { position: "relative", zIndex: 2, maxWidth: 760, margin: "0 auto", padding: "clamp(40px, 8vw, 56px) clamp(18px, 5vw, 24px) clamp(64px, 10vw, 80px)" },
  pageHeader:   { marginBottom: 52, paddingBottom: 40, borderBottom: "1px solid rgba(252,216,70,0.12)" },
  badge:        { display: "inline-flex", alignItems: "center", padding: "4px 12px", background: "rgba(252,216,70,0.08)", border: "1px solid rgba(252,216,70,0.18)", borderRadius: 100, fontSize: 11, fontWeight: 600, color: "#fcd846", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 18 },
  h1:           { fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, letterSpacing: "-1.2px", marginBottom: 10, background: "linear-gradient(135deg, #ffe98a 0%, #fcd846 38%, #a78bfa 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", display: "inline-block" },
  lastUpdated:  { fontSize: 13, color: "var(--text-tertiary)", marginBottom: 18 },
  intro:        { fontSize: "clamp(14.5px, 2.8vw, 15px)", color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 580 },
  content:      { display: "flex", flexDirection: "column", gap: 0 },
  section:      { padding: "32px 0", borderBottom: "1px solid rgba(252,216,70,0.10)" },
  sectionTitle: { fontSize: "clamp(16px, 3.2vw, 17px)", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.3px", marginBottom: 16 },
  p:            { fontSize: "clamp(14px, 2.6vw, 14.5px)", color: "var(--text-secondary)", lineHeight: 1.75, marginBottom: 12 },
  list:         { listStyle: "none", display: "flex", flexDirection: "column", gap: 10, margin: "12px 0" },
  listItem:     { display: "flex", alignItems: "flex-start", gap: 10, fontSize: "clamp(14px, 2.6vw, 14.5px)", color: "var(--text-secondary)", lineHeight: 1.6 },
  listDot:      { width: 5, height: 5, borderRadius: "50%", background: "#fcd846", flexShrink: 0, marginTop: 8 },
  legalNav:     { marginTop: 48, paddingTop: 32, borderTop: "1px solid rgba(252,216,70,0.10)", display: "flex", justifyContent: "flex-start" },
  legalNavLink: { fontSize: 13.5, color: "#fcd846", fontWeight: 500, textDecoration: "none" },
};