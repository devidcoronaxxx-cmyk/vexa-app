"use client";

/* eslint-disable react/no-unescaped-entities -- legal copy intentionally contains raw quotes/apostrophes */

import Link from "next/link";
import { useEffect, useState } from "react";
import { Footer } from "../../components/footer";
import type { CSSProperties } from "react";

const LAST_UPDATED = "August 8, 2026";

const sections = [
  { id: "acceptance",      title: "1. Acceptance of Terms" },
  { id: "description",     title: "2. Description of Service" },
  { id: "eligibility",     title: "3. Eligibility" },
  { id: "authentication",  title: "4. Roblox Account & Authentication" },
  { id: "acceptable-use",  title: "5. Acceptable Use" },
  { id: "generated",       title: "6. Generated Content" },
  { id: "ip",              title: "7. Intellectual Property" },
  { id: "subscriptions",   title: "8. Subscriptions & Billing" },
  { id: "data",            title: "9. Data & Privacy" },
  { id: "third-party",     title: "10. Third-Party Services" },
  { id: "plugin",          title: "11. Studio Plugin" },
  { id: "termination",     title: "12. Termination" },
  { id: "disclaimers",     title: "13. Disclaimer of Warranties" },
  { id: "liability",       title: "14. Limitation of Liability" },
  { id: "indemnification", title: "15. Indemnification" },
  { id: "governing-law",   title: "16. Governing Law" },
  { id: "changes",         title: "17. Changes to Terms" },
  { id: "contact",         title: "18. Contact" },
];

export default function TermsPage() {
  const [active, setActive] = useState<string>(sections[0].id);

  useEffect(() => {
    const visible = new Map<string, number>();
    const observers: IntersectionObserver[] = [];

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            visible.set(id, entry.intersectionRatio);
          } else {
            visible.delete(id);
          }
          if (visible.size > 0) {
            const first = sections.find(s => visible.has(s.id));
            if (first) setActive(first.id);
          }
        },
        { rootMargin: "-10% 0px -65% 0px", threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach(o => o.disconnect());
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: #d8d5c8; font-family: 'Space Grotesk', sans-serif !important; -webkit-font-smoothing: antialiased; }
        * { font-family: 'Space Grotesk', sans-serif !important; }
        @keyframes tmAurDrift { 0% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(4%,-6%,0) scale(1.12); } 100% { transform: translate3d(0,0,0) scale(1); } }
        @keyframes tmAurDrift2 { 0% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(-5%,5%,0) scale(1.15); } 100% { transform: translate3d(0,0,0) scale(1); } }
        .tm-aur { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
        .tm-aur::after { content: ''; position: absolute; inset: 0; background-image: radial-gradient(rgba(28, 27, 26,0.14) 1px, transparent 1px); background-size: 26px 26px; opacity: 0.35; mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%); -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%); }
        .tm-blob { position: absolute; border-radius: 50%; filter: blur(120px); will-change: transform; }
        .tm-blob-a { width: 55vw; height: 55vw; left: -18vw; top: -16vw; background: rgba(252,216,70,0.16); animation: tmAurDrift 22s ease-in-out infinite; }
        .tm-blob-b { width: 50vw; height: 50vw; right: -16vw; top: -8vw; background: rgba(167,139,250,0.18); animation: tmAurDrift2 26s ease-in-out infinite; }
        .tm-blob-c { width: 46vw; height: 46vw; left: 28vw; bottom: -22vw; background: rgba(196,181,253,0.12); animation: tmAurDrift 30s ease-in-out infinite reverse; }
        .tm-grain { position: fixed; inset: 0; z-index: 1; opacity: 0.55; pointer-events: none; mix-blend-mode: overlay; background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%25" height="100%25" filter="url(%23n)" opacity="0.5"/></svg>'); }

        .toc-item { transition: color 0.2s; }
        .toc-item:hover { color: rgba(217,249,157,0.7) !important; }
        .legal-nav-link:hover { color: rgba(217,249,157,0.85) !important; }
        .inline-link:hover { color: #ffe98a !important; }

        @media (max-width: 960px) {
          .toc-sidebar { display: none !important; }
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#d8d5c8", position: "relative" }}>

        <div className="tm-aur" aria-hidden>
          <div className="tm-blob tm-blob-a" />
          <div className="tm-blob tm-blob-b" />
          <div className="tm-blob tm-blob-c" />
          <div className="tm-grain" />
        </div>

        <div style={S.outerLayout}>

          <aside className="toc-sidebar" style={S.sidebar}>
            <p style={S.tocLabel}>On this page</p>
            <nav style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="toc-item"
                  style={{
                    ...S.tocItem,
                    color: active === s.id
                      ? "rgba(217,249,157,0.9)"
                      : "rgba(240,240,240,0.3)",
                    fontWeight: active === s.id ? 500 : 400,
                  }}
                >
                  {s.title}
                </a>
              ))}
            </nav>
          </aside>

          <main style={S.main}>

            <div style={S.pageHeader}>
              <h1 style={S.h1}>Terms of Service</h1>
              <p style={S.lastUpdated}>Last updated: {LAST_UPDATED}</p>
              <p style={S.intro}>
                Please read these Terms carefully before using Vexa. By accessing or using
                our service, you agree to be bound by these terms. If you do not agree, please
                discontinue use immediately.
              </p>
            </div>

            <div style={S.content}>

              <Section id="acceptance" title="1. Acceptance of Terms">
                <P>By accessing and using Vexa ("the Service"), operated by Vexa Studios ("we", "us", or "our"), you accept and agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree to these terms, you are prohibited from using or accessing this Service.</P>
                <P>These Terms constitute the entire agreement between you and Vexa Studios regarding your use of the Service, and supersede any prior agreements. We reserve the right to modify these terms at any time by posting an updated version. We will notify users of significant changes by updating the "Last updated" date at the top of this page. Your continued use of the Service after any changes constitutes your acceptance of the new terms.</P>
              </Section>

              <Section id="description" title="2. Description of Service">
                <P>Vexa is an AI-powered development tool that generates Roblox Luau scripts, systems, UI components, and game instances based on natural language prompts. The Service is accessible through our web dashboard at dash.vexaaai.vercel.app, our Roblox Studio plugin, and our browser-based chat interface — and is intended for use by Roblox developers of all skill levels.</P>
                <P>The Service connects to your Roblox account via OAuth2, syncs your game's hierarchy from Studio, and delivers generated output directly into your project through the Vexa plugin. Additional features include project management, version history, heartbeat-based session tracking, and collaborative tools. We reserve the right to modify, expand, suspend, or discontinue any feature or the Service in its entirety at any time, with or without notice.</P>
              </Section>

              <Section id="eligibility" title="3. Eligibility">
                <P>You must be at least 13 years of age to use Vexa. If you are under the age of majority in your jurisdiction, you represent that your parent or legal guardian has reviewed and agreed to these Terms on your behalf.</P>
                <P>By using the Service, you represent and warrant that: (a) you have the legal capacity to enter into a binding agreement; (b) you are not barred from receiving services under any applicable law; and (c) all registration information you provide is accurate and current. We reserve the right to deny access to any person or entity at our sole discretion.</P>
              </Section>

              <Section id="authentication" title="4. Roblox Account & Authentication">
                <P>To use Vexa, you must authenticate via Roblox OAuth2 through our authorization flow at dash.vexaaai.vercel.app. By connecting your Roblox account, you authorize us to access your public profile information including your username, display name, user ID, and avatar image. We do not access your Roblox inventory, Robux balance, private messages, or any private account data beyond what is explicitly requested.</P>
                <P>Upon successful authorization, a secure token is issued and stored locally in your Roblox Studio plugin settings. This token is used to authenticate all subsequent API calls including project fetching, output polling, heartbeat pings, and game model uploads. You are solely responsible for maintaining the confidentiality of this token and your account credentials.</P>
                <P>You may not share your account, allow others to access the Service through your account, or create multiple accounts to circumvent usage limits or restrictions. We reserve the right to revoke tokens and suspend or terminate accounts that violate these provisions.</P>
              </Section>

              <Section id="acceptable-use" title="5. Acceptable Use">
                <P>You agree to use Vexa only for lawful purposes and in a manner consistent with all applicable laws, regulations, and these Terms. You must not use the Service to:</P>
                <List items={[
                  "Generate scripts intended to exploit, harm, or harass other Roblox users or players",
                  "Create malicious code, cheats, exploits, aimbots, or unauthorized automation tools",
                  "Violate Roblox's Terms of Service, Community Standards, or Developer Guidelines",
                  "Infringe on any third party's intellectual property, copyright, trademark, or trade secret rights",
                  "Attempt to reverse-engineer, decompile, hack, disrupt, or gain unauthorized access to our infrastructure or APIs",
                  "Scrape, crawl, or systematically extract data or generated outputs from the Service using automated means",
                  "Use the Service to generate content that is illegal, defamatory, obscene, or harmful to minors",
                  "Resell, sublicense, or commercialize the Service or its outputs without prior written consent from Vexa Studios",
                  "Impersonate any person or entity, or misrepresent your affiliation with any person or entity",
                  "Upload or transmit viruses, malware, or any other malicious or harmful code",
                  "Interfere with or disrupt the integrity or performance of the Service or its related systems",
                  "Abuse the polling, heartbeat, or game model upload endpoints to place undue load on our servers",
                ]} />
                <P>We reserve the right to investigate and take appropriate action against anyone who violates these provisions, including suspending or terminating accounts, revoking API tokens, removing generated content, and reporting violations to law enforcement authorities.</P>
              </Section>

              <Section id="generated" title="6. Generated Content">
                <P>Scripts, code, instances, and other content generated by Vexa ("Generated Content") are provided for your use in Roblox projects. Generated Content is automatically inserted into your game via the Studio plugin when new output is detected. You are solely responsible for reviewing, testing, validating, and ensuring the safety and appropriateness of any Generated Content before publishing or distributing your game.</P>
                <P>We do not claim ownership of Generated Content produced through your unique prompts. However, because the underlying AI models may produce similar or identical outputs for different users, we cannot guarantee uniqueness or exclusivity of any Generated Content.</P>
                <P>Vexa Studios is not responsible for any bugs, errors, security vulnerabilities, performance issues, or unintended behaviors in Generated Content that may affect your games, experiences, or end users. All Generated Content is used at your own risk.</P>
              </Section>

              <Section id="ip" title="7. Intellectual Property">
                <P>The Vexa platform — including its web dashboard, Studio plugin, authentication system, APIs, design, source code, branding, logos, and all content created by Vexa Studios — is protected by copyright, trademark, and other applicable intellectual property laws. All rights are reserved by Vexa Studios unless otherwise stated.</P>
                <P>You may not reproduce, distribute, modify, create derivative works of, decompile, or otherwise extract any portion of the Service without our explicit prior written permission. This includes but is not limited to the plugin source, API endpoints, and dashboard UI.</P>
                <P>Any feedback, suggestions, or improvements you provide regarding the Service ("Feedback") shall be deemed non-confidential, and Vexa Studios shall have the right to use such Feedback for any purpose without restriction or compensation to you.</P>
              </Section>

              <Section id="subscriptions" title="8. Subscriptions & Billing">
                <P>Vexa may offer free and paid subscription tiers. Paid plans unlock additional generation capacity, higher usage limits, faster output, and priority access to new features. By subscribing to a paid plan, you agree to pay all applicable fees as described on our pricing page at the time of your subscription.</P>
                <P>Subscription fees are billed in advance on a recurring basis (monthly or annually, as selected). All fees are non-refundable except as required by applicable law or as explicitly stated in our refund policy. We reserve the right to change pricing at any time, with at least 14 days' notice to existing subscribers before changes take effect.</P>
                <P>You may cancel your subscription at any time through your account dashboard. Cancellation takes effect at the end of your current billing period. We reserve the right to suspend or downgrade accounts with overdue balances or failed payments.</P>
              </Section>

              <Section id="data" title="9. Data & Privacy">
                <P>Your use of the Service is governed by our <Link href="/legal/privacy" className="inline-link" style={S.inlineLink}>Privacy Policy</Link>, which is incorporated into these Terms by reference. By using the Service, you consent to the collection and use of your data as described in the Privacy Policy.</P>
                <P>When you use the Studio plugin, Vexa scans and uploads your game's service hierarchy — including script names, class names, folder structures, and source code — to our servers. This data is used solely to provide context to the AI for better code generation. We do not share this game data with third parties.</P>
                <P>You retain ownership of your prompts, game data, and project inputs. By submitting content, you grant Vexa Studios a limited, non-exclusive, royalty-free license to process your inputs solely for the purpose of delivering and improving the Service. We do not sell your personal data.</P>
              </Section>

              <Section id="third-party" title="10. Third-Party Services">
                <P>The Service integrates with third-party platforms including Roblox (for authentication and avatar data), payment processors (for billing), and infrastructure providers. These services are governed by their own terms and privacy policies, and Vexa Studios is not responsible for their content, availability, or practices.</P>
                <P>The Vexa Studio plugin makes HTTP requests to our API endpoints. Your use of the plugin requires that HTTP Requests are enabled in your Roblox Studio game settings. We are not responsible for network errors, Roblox API changes, or plugin behavior resulting from Roblox platform updates.</P>
              </Section>

              <Section id="plugin" title="11. Studio Plugin">
                <P>The Vexa Studio plugin ("the Plugin") is a Roblox Studio tool that connects to our Service, scans your game hierarchy, polls for new generated output, and automatically inserts scripts and instances into your project. The Plugin communicates with our servers at intervals defined by its polling (every 10 seconds), heartbeat (every 15 seconds), and auto-scan (every 60 seconds) cycles.</P>
                <P>By installing and using the Plugin, you acknowledge that it will: (a) send your game's service tree structure and source code to our servers; (b) store a session token in your Studio plugin settings; (c) automatically insert, update, or overwrite scripts and instances in your project when new output is available; and (d) send your Roblox user ID to associate your Studio session with your Vexa account.</P>
                <P>You are responsible for reviewing all code inserted by the Plugin before publishing your experience. Vexa Studios is not liable for any damage, data loss, or policy violations arising from auto-inserted content.</P>
              </Section>

              <Section id="termination" title="12. Termination">
                <P>We may suspend or terminate your access to the Service at our sole discretion, with or without notice, for any reason — including violation of these Terms, harmful conduct, extended inactivity, or discontinuation of the Service. Token revocation takes effect immediately and will cause the Studio plugin to require re-authorization.</P>
                <P>You may terminate your account at any time through your dashboard or by contacting us. Upon termination, your right to use the Service ceases immediately. Provisions that by their nature survive termination — including intellectual property rights, disclaimers, liability limitations, and indemnification — shall remain in effect.</P>
              </Section>

              <Section id="disclaimers" title="13. Disclaimer of Warranties">
                <P>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, VEXA STUDIOS EXPRESSLY DISCLAIMS ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.</P>
                <P>VEXA STUDIOS DOES NOT WARRANT THAT: (A) THE SERVICE WILL MEET YOUR REQUIREMENTS; (B) THE SERVICE WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE; (C) GENERATED OUTPUT WILL BE ACCURATE, FUNCTIONAL, OR FIT FOR ANY PURPOSE; OR (D) ANY ERRORS WILL BE CORRECTED. USE OF THE SERVICE IS ENTIRELY AT YOUR OWN RISK.</P>
              </Section>

              <Section id="liability" title="14. Limitation of Liability">
                <P>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, VEXA STUDIOS AND ITS OFFICERS, DIRECTORS, EMPLOYEES, CONTRACTORS, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES — INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR BUSINESS INTERRUPTION — ARISING FROM OR RELATED TO YOUR USE OF OR INABILITY TO USE THE SERVICE.</P>
                <P>IN NO EVENT SHALL VEXA STUDIOS' TOTAL CUMULATIVE LIABILITY TO YOU EXCEED THE GREATER OF: (A) THE AMOUNT YOU PAID TO VEXA STUDIOS IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR (B) FIFTY US DOLLARS (USD $50). THESE LIMITATIONS APPLY REGARDLESS OF THE THEORY OF LIABILITY.</P>
              </Section>

              <Section id="indemnification" title="15. Indemnification">
                <P>You agree to indemnify, defend, and hold harmless Vexa Studios and its officers, directors, employees, contractors, agents, licensors, and service providers from and against any claims, liabilities, damages, judgments, losses, costs, and fees (including reasonable legal fees) arising from: (a) your violation of these Terms; (b) your use of the Service or Plugin; (c) content you submit or generate; (d) your violation of any third party's rights; or (e) your violation of any applicable law or regulation.</P>
                <P>We reserve the right to assume the exclusive defense and control of any matter subject to indemnification by you, at our expense. You agree to cooperate fully with our defense of such claims.</P>
              </Section>

              <Section id="governing-law" title="16. Governing Law">
                <P>These Terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law provisions. Any disputes arising under these Terms shall be subject to binding arbitration, except where either party seeks injunctive relief to protect intellectual property rights.</P>
                <P>If any provision of these Terms is found invalid, illegal, or unenforceable, the remaining provisions shall continue in full force and effect. Our failure to enforce any right or provision shall not constitute a waiver of that right.</P>
              </Section>

              <Section id="changes" title="17. Changes to Terms">
                <P>We reserve the right to update or modify these Terms at any time. Material changes will be communicated by updating the "Last updated" date and, where appropriate, by email or a notice on the Service. Minor changes such as corrections or clarifications may be made without specific notification.</P>
                <P>Your continued use of the Service following any changes constitutes your acceptance of the revised Terms. If you do not agree to the revised Terms, you must stop using the Service and disconnect the Studio plugin.</P>
              </Section>

              <Section id="contact" title="18. Contact">
                <P>If you have any questions, concerns, or requests regarding these Terms, please contact us through one of the following channels:</P>
                <List items={[
                  "Discord: Join our community server and open a support ticket in the #support channel",
                  "Dashboard: Submit a request through the Help & Support section at dash.vexaaai.vercel.app",
                  "Email: Reach out via the contact address listed in your dashboard account settings",
                ]} />
                <P>We aim to respond to all inquiries within 12 hours. For urgent matters related to account security, billing disputes, or potential abuse, please mark your message as urgent.</P>
              </Section>

            </div>

            <div style={S.legalNav}>
              <Link href="/legal/privacy" className="legal-nav-link" style={S.legalNavLink}>
                Privacy Policy →
              </Link>
            </div>

          </main>

        </div>

        <Footer />

      </div>
    </>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={S.section}>
      <h2 style={S.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={S.p}>{children}</p>;
}

function List({ items }: { items: string[] }) {
  return (
    <ul style={S.list}>
      {items.map((item, i) => (
        <li key={i} style={S.listItem}>
          <span style={S.listDot} />
          {item}
        </li>
      ))}
    </ul>
  );
}

const S: Record<string, CSSProperties> = {
  outerLayout: {
    position: "relative",
    zIndex: 2,
    display: "flex",
    maxWidth: 1100,
    margin: "0 auto",
    padding: "56px clamp(18px, 5vw, 40px) 0",
    gap: 56,
    alignItems: "flex-start",
  },

  sidebar: {
    width: 188,
    flexShrink: 0,
    position: "sticky",
    top: 40,
    paddingTop: 4,
  },
  tocLabel: {
    fontSize: 10.5,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "rgba(252,216,70,0.45)",
    marginBottom: 10,
  },
  tocItem: {
    fontSize: 12,
    textDecoration: "none",
    lineHeight: 1.45,
    padding: "3.5px 0",
    display: "block",
    transition: "color 0.18s",
  },

  main: {
    flex: 1,
    minWidth: 0,
    maxWidth: 680,
    paddingBottom: 80,
  },

  pageHeader: {
    marginBottom: 44,
    paddingBottom: 36,
    borderBottom: "1px solid rgba(252,216,70,0.12)",
  },
  h1: {
    fontSize: "clamp(24px, 4vw, 36px)",
    fontWeight: 800,
    letterSpacing: "-0.8px",
    color: "#efefef",
    marginBottom: 10,
    lineHeight: 1.15,
    background: "linear-gradient(135deg, #ffe98a 0%, #fcd846 38%, #a78bfa 100%)",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
    display: "inline-block",
  },
  lastUpdated: {
    fontSize: 12,
    color: "rgba(240,240,240,0.28)",
    marginBottom: 16,
  },
  intro: {
    fontSize: 14,
    color: "rgba(240,240,240,0.45)",
    lineHeight: 1.72,
  },

  content: {
    display: "flex",
    flexDirection: "column",
  },
  section: {
    padding: "30px 28px",
    marginBottom: 16,
    border: "1px solid rgba(252,216,70,0.09)",
    borderRadius: 18,
    background: "linear-gradient(180deg, rgba(252,216,70,0.04), rgba(28, 27, 26,0.015))",
    boxShadow: "0 12px 40px rgba(0,0,0,0.25), inset 0 1px 0 rgba(28, 27, 26,0.03)",
    scrollMarginTop: 48,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#e8f5c8",
    letterSpacing: "-0.2px",
    marginBottom: 14,
  },
  p: {
    fontSize: 13.5,
    color: "rgba(240,240,240,0.5)",
    lineHeight: 1.78,
    marginBottom: 12,
  },
  list: {
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: 9,
    margin: "12px 0",
  },
  listItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 11,
    fontSize: 13.5,
    color: "rgba(240,240,240,0.5)",
    lineHeight: 1.65,
  },
  listDot: {
    width: 4,
    height: 4,
    borderRadius: "50%",
    background: "rgba(252,216,70,0.7)",
    flexShrink: 0,
    marginTop: 8,
  },
  inlineLink: {
    color: "rgba(217,249,157,0.8)",
    textDecoration: "underline",
    textUnderlineOffset: 3,
    transition: "color 0.15s",
  },

  legalNav: {
    marginTop: 48,
    paddingTop: 28,
    display: "flex",
    justifyContent: "flex-end",
  },
  legalNavLink: {
    fontSize: 13,
    color: "rgba(217,249,157,0.6)",
    fontWeight: 500,
    textDecoration: "none",
    transition: "color 0.18s",
  },
};