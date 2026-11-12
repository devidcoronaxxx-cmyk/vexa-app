"use client";

import { useState } from "react";
import { useTheme } from "@/app/components/ThemeProvider";
import Link from "next/link";
import config from "@/site.config.json";

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";


const NAV = [
  { href: "#build", label: "Cosa costruisce" },
  { href: "#how", label: "Come funziona" },
  { href: "#why", label: "Perché Vexa" },
  { href: "#faq", label: "FAQ" },
];

const BUILDS = [
  { icon: "bi-lightning-charge-fill", title: "Combat system", desc: "Melee e ranged con danni, cooldown e combo." },
  { icon: "bi-bank2", title: "Tycoon kit", desc: "Money drop, negozi e pulsanti di upgrade." },
  { icon: "bi-stars", title: "VFX", desc: "Aure, particelle, beam ed effetti tuned." },
  { icon: "bi-box-seam", title: "Modelli 3D", desc: "Mesh generate in locale con Hunyuan3D (richiede server locale attivo)." },
  { icon: "bi-person-raised-hand", title: "Animazioni", desc: "Keyframe naturali per ogni rig." },
  { icon: "bi-music-note-beamed", title: "Audio", desc: "Soundscape e layer musicali." },
];

const STEPS = [
  { num: "01", title: "Scarica e installa", desc: "Installer Windows, un click. I modelli si installano da soli al primo avvio." },
  { num: "02", title: "Descrivi l'idea", desc: "Scrivi cosa vuoi in italiano — un combat system, un'aura di fuoco, una spada 3D." },
  { num: "03", title: "Genera e usa", desc: "Il team Vexa costruisce tutto: script, animazioni, VFX, modelli — pronti per il tuo gioco." },
];

const COMP_ROWS = [
  { label: "App desktop separata (connette a Studio via Rojo)", vexa: true, roblox: false },
  { label: "Architetture multi-script complete", vexa: true, roblox: false },
  { label: "Luau tipizzato e idiomatico", vexa: true, roblox: false },
  { label: "Animazioni (keyframe)", vexa: true, roblox: false },
  { label: "VFX e particelle professionali", vexa: true, roblox: false },
  { label: "Modelli 3D (Hunyuan3D)", vexa: true, roblox: false },
  { label: "Modelli locali (Qwen + Hunyuan3D)", vexa: true, roblox: false },
  { label: "Completamente gratis", vexa: true, roblox: true },
];

const FAQS = [
  { q: "È gratis?", a: "Sì. Vexa è completamente gratis: niente carta di credito, niente paywall, niente limiti." },
  { q: "Funziona offline?", a: "Dopo aver scaricato i modelli (Tier S/M/L), Vexa genera in locale senza internet. Senza modelli, usa il cloud NVIDIA come fallback." },
  { q: "Cosa significa team di modelli?", a: "Qwen scrive codice e blueprint. Hunyuan3D costruisce mesh 3D reali quando il server locale è attivo. Gli script referenziano gli asset generati." },
  { q: "Devo sapere programmare?", a: "No. Descrivi cosa vuoi e Vexa scrive il Luau. Se sai programmare, puoi leggere e modificare tutto." },
  { q: "Come arrivano le cose in Studio?", a: "Tramite Rojo: Vexa scrive i file del progetto e Rojo li sincronizza live dentro Roblox Studio." },
  { q: "Su quali piattaforme gira?", a: "L'app desktop è per Windows. La dashboard web funziona ovunque." },
];

function Check({ yes }: { yes: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", background: yes ? "rgba(59,91,219,0.10)" : "transparent", border: yes ? `1px solid var(--accent)` : "1px solid #d1d5db" }}>
      {yes ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      ) : (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#c9c6b8" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      )}
    </span>
  );
}

export default function HomePage() {
  const { theme, toggle } = useTheme();
  const INK = "var(--text)";
  const MUTED = "var(--text-muted)";
  const CREAM = "var(--bg)";
  const CARD = "var(--card)";
  const LINE = "var(--border)";
  const ACCENT = "var(--accent)";
  const [open, setOpen] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const { features, stats } = config as {
    features: { title: string; desc: string }[];
    stats: { value: string; label: string }[];
  };

  return (
    <div style={{ background: CREAM, color: INK, fontFamily: SANS, minHeight: "100vh" }}>
      <style>{`
        ::selection { background: rgba(188,91,40,0.2); }
        .cl-link:hover { color: ${INK} !important; }
        .cl-btn-dark:hover { background: #000 !important; }
        .cl-btn-line:hover { border-color: ${INK} !important; }
        .cl-card:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(26, 31, 46,0.10) !important; }
        .cl-faq-a { max-height: 0; overflow: hidden; opacity: 0; transition: max-height .28s ease, opacity .2s ease, padding .2s ease; }
        .cl-faq-a.open { max-height: 300px; opacity: 1; }
        @keyframes clIn { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        .cl-in { animation: clIn .7s cubic-bezier(.16,1,.3,1) both; }
        .cl-in-1 { animation-delay: .08s; } .cl-in-2 { animation-delay: .16s; } .cl-in-3 { animation-delay: .24s; }
      `}</style>

      {/* NAV */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(243,241,234,0.88)", backdropFilter: "blur(14px)", borderBottom: `1px solid ${LINE}` }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px", height: 62, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
            <img src="/icons/vexa-mark-navy.png" alt="Vexa" width={26} height={26} style={{ objectFit: "contain" }} />
            <span style={{ fontSize: 17, fontWeight: 800, color: INK, letterSpacing: "-0.01em" }}>Vexa</span>
          </Link>
          <nav style={{ display: "flex", gap: 4 }} className="cl-desktop">
            {NAV.map(l => (
              <a key={l.href} href={l.href} className="cl-link" style={{ fontSize: 13.5, fontWeight: 500, color: MUTED, textDecoration: "none", padding: "8px 13px", borderRadius: 9, transition: "color .15s" }}>{l.label}</a>
            ))}
          </nav>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <a href="/local" className="cl-link" style={{ fontSize: 13.5, fontWeight: 600, color: MUTED, textDecoration: "none" }}>Apri app</a>
            <button type="button" onClick={toggle} aria-label="Toggle theme" suppressHydrationWarning style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid #d1d5db", background: "transparent", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#1a1f2e", marginRight: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        </button>
        <a href="/download" className="cl-btn-dark" style={{ fontSize: 13.5, fontWeight: 700, color: "#fff", background: INK, textDecoration: "none", padding: "10px 20px", borderRadius: 999, transition: "background .15s" }}>Download</a>
            <button type="button" onClick={() => setMenu(m => !m)} style={{ display: "none", background: "none", border: `1px solid ${LINE}`, borderRadius: 9, width: 36, height: 36, cursor: "pointer", fontSize: 16, color: INK }} className="cl-burger">≡</button>
          </div>
        </div>
        {menu && (
          <div style={{ borderTop: `1px solid ${LINE}`, padding: "10px 24px 16px", display: "flex", flexDirection: "column", gap: 2 }}>
            {NAV.map(l => (
              <a key={l.href} href={l.href} onClick={() => setMenu(false)} style={{ fontSize: 14, fontWeight: 600, color: INK, textDecoration: "none", padding: "10px 4px" }}>{l.label}</a>
            ))}
          </div>
        )}
      </header>

      {/* HERO */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "clamp(72px,10vw,130px) 24px clamp(48px,6vw,72px)", textAlign: "center" }}>
        <div className="cl-in" style={{ display: "inline-block", fontSize: 12.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: ACCENT, border: `1px solid ${ACCENT}55`, background: "#fff", padding: "7px 16px", borderRadius: 999, marginBottom: 26 }}>
          Gratis · Modelli locali · Team AI
        </div>
        <h1 className="cl-in cl-in-1" style={{ fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(42px,6.4vw,76px)", lineHeight: 1.06, letterSpacing: "-0.02em", margin: "0 0 22px", color: INK }}>
          Costruisci giochi Roblox<br />con le parole.
        </h1>
        <p className="cl-in cl-in-2" style={{ fontSize: "clamp(16px,2.4vw,19px)", color: MUTED, lineHeight: 1.65, maxWidth: 620, margin: "0 auto 34px" }}>
          Descrivi cosa vuoi — un combat system, un tycoon, una spada 3D. Il team Vexa (Qwen + Hunyuan3D + Stable Audio + Kimodo) scrive codice, mesh, animazioni, VFX e audio pronti per Studio.
        </p>
        <div className="cl-in cl-in-3" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/download" className="cl-btn-dark" style={{ fontSize: 15, fontWeight: 700, color: "#fff", background: INK, textDecoration: "none", padding: "15px 32px", borderRadius: 999, transition: "background .15s" }}>Download</a>
        <a href="/download" className="cl-btn-line" style={{ fontSize: 15, fontWeight: 700, color: INK, background: "transparent", border: `1.5px solid #d8d5c8`, textDecoration: "none", padding: "14px 30px", borderRadius: 999, transition: "border-color .15s" }}>Download</a>
        </div>
        <div style={{ display: "flex", gap: 0, justifyContent: "center", flexWrap: "wrap", marginTop: 56, borderTop: `1px solid ${LINE}`, maxWidth: 760, marginLeft: "auto", marginRight: "auto" }}>
          {stats.map((s, i) => (
            <div key={i} style={{ flex: "1 1 140px", padding: "22px 12px", borderLeft: i > 0 ? `1px solid ${LINE}` : "none" }}>
              <div style={{ fontFamily: SERIF, fontSize: 28, color: INK }}>{s.value}</div>
              <div style={{ fontSize: 12.5, color: MUTED, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* BUILD */}
      <section id="build" style={{ maxWidth: 1120, margin: "0 auto", padding: "clamp(48px,6vw,80px) 24px", scrollMarginTop: 70 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: ACCENT, marginBottom: 12 }}>Cosa costruisce</div>
        <h2 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(30px,4vw,44px)", letterSpacing: "-0.015em", margin: "0 0 12px" }}>Tutto il gioco, non solo snippet.</h2>
        <p style={{ fontSize: 16, color: MUTED, lineHeight: 1.65, maxWidth: 560, margin: "0 0 36px" }}>Sistemi completi multi-script, con le parti che si parlano: la mesh vera dentro le animazioni, gli effetti sui suoni giusti.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {BUILDS.map(b => (
            <div key={b.title} className="cl-card" style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 16, padding: "24px 22px", transition: "transform .2s, box-shadow .2s" }}>
              <i className={`bi ${b.icon}`} style={{ fontSize: 22, color: ACCENT }} />
              <div style={{ fontSize: 16, fontWeight: 700, margin: "14px 0 6px", letterSpacing: "-0.01em" }}>{b.title}</div>
              <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.6 }}>{b.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW */}
      <section id="how" style={{ borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`, background: "#eceade" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "clamp(48px,6vw,80px) 24px" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: ACCENT, marginBottom: 12 }}>Come funziona</div>
          <h2 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(30px,4vw,44px)", letterSpacing: "-0.015em", margin: "0 0 36px" }}>Dall&apos;idea al gioco in un minuto.</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 0 }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{ padding: "8px 28px 8px 0", borderLeft: i > 0 ? `1px solid ${LINE}` : "none", paddingLeft: i > 0 ? 28 : 0 }}>
                <div style={{ fontFamily: SERIF, fontSize: 15, color: ACCENT, marginBottom: 10 }}>{s.num}</div>
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.01em" }}>{s.title}</div>
                <div style={{ fontSize: 14.5, color: MUTED, lineHeight: 1.65 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY */}
      <section id="why" style={{ maxWidth: 760, margin: "0 auto", padding: "clamp(48px,6vw,80px) 24px", scrollMarginTop: 70 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: ACCENT, marginBottom: 12, textAlign: "center" }}>Perché Vexa</div>
        <h2 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(30px,4vw,44px)", letterSpacing: "-0.015em", margin: "0 0 36px", textAlign: "center" }}>Meglio dell&apos;Assistant di Studio.</h2>
        <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 18, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 110px", padding: "13px 20px", borderBottom: `1px solid ${LINE}`, background: "#f6f4ec" }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED }}>Funzione</span>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: INK, textAlign: "center" }}>Vexa</span>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: MUTED, textAlign: "center" }}>Assistant</span>
          </div>
          {COMP_ROWS.map((row, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 90px 110px", padding: "13px 20px", borderBottom: i < COMP_ROWS.length - 1 ? `1px solid ${LINE}` : "none", alignItems: "center", background: i % 2 === 0 ? "transparent" : "rgba(26, 31, 46,0.015)" }}>
              <span style={{ fontSize: 14, color: INK }}>{row.label}</span>
              <span style={{ display: "flex", justifyContent: "center" }}><Check yes={row.vexa} /></span>
              <span style={{ display: "flex", justifyContent: "center" }}><Check yes={row.roblox} /></span>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px clamp(48px,6vw,80px)" }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: ACCENT, marginBottom: 12, textAlign: "center" }}>Uno strumento · Tutto</div>
        <h2 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(30px,4vw,44px)", letterSpacing: "-0.015em", margin: "0 0 36px", textAlign: "center" }}>Tutto per costruire più in fretta.</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
          {features.map((f, i) => (
            <div key={i} className="cl-card" style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 16, padding: "24px 22px", transition: "transform .2s, box-shadow .2s" }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.01em" }}>{f.title}</div>
              <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.65 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ maxWidth: 700, margin: "0 auto", padding: "0 24px clamp(56px,7vw,88px)", scrollMarginTop: 70 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: ACCENT, marginBottom: 12, textAlign: "center" }}>FAQ</div>
        <h2 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(30px,4vw,44px)", letterSpacing: "-0.015em", margin: "0 0 32px", textAlign: "center" }}>Domande e risposte.</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={i} style={{ border: `1px solid ${isOpen ? ACCENT + "66" : LINE}`, borderRadius: 14, background: CARD, transition: "border-color .2s" }}>
                <button type="button" onClick={() => setOpen(isOpen ? null : i)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "17px 20px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: SANS }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: INK }}>{f.q}</span>
                  <span style={{ fontSize: 18, color: isOpen ? ACCENT : MUTED, transform: isOpen ? "rotate(45deg)" : "none", transition: "transform .2s", lineHeight: 1 }}>+</span>
                </button>
                <div className={`cl-faq-a${isOpen ? " open" : ""}`} style={{ paddingLeft: 20, paddingRight: 20, paddingBottom: isOpen ? 18 : 0 }}>
                  <p style={{ fontSize: 14.5, color: MUTED, lineHeight: 1.7, margin: 0 }}>{f.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px clamp(64px,8vw,100px)" }}>
        <div style={{ background: INK, color: "#fff", borderRadius: 24, padding: "clamp(44px,6vw,72px) clamp(28px,5vw,56px)", textAlign: "center" }}>
          <h2 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(32px,4.6vw,52px)", letterSpacing: "-0.015em", margin: "0 0 14px" }}>Pronto a costruire?</h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", margin: "0 0 32px" }}>Scarica Vexa e genera il tuo primo sistema oggi.</p>
          <a href="/download" style={{ display: "inline-block", fontSize: 15, fontWeight: 700, color: INK, background: "#f5f3ec", textDecoration: "none", padding: "15px 36px", borderRadius: 999 }}>Download per Windows</a>
          <p style={{ marginTop: 16, fontSize: 12.5, color: "rgba(255,255,255,0.45)" }}>Gratis · I modelli si installano da soli</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: `1px solid ${LINE}` }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "48px 24px 32px", display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 32 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
              <img src="/icons/vexa-mark-navy.png" alt="Vexa" width={24} height={24} style={{ objectFit: "contain" }} />
              <span style={{ fontSize: 16, fontWeight: 800 }}>Vexa</span>
            </div>
            <p style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.65, margin: 0, maxWidth: 260 }}>Il team AI per costruire giochi Roblox: codice, mesh, animazioni e VFX.</p>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED, marginBottom: 14 }}>Prodotto</div>
            {[["Scarica", "/download"], ["Apri app", "/local"], ["Accedi", "/local"]].map(([l, h]) => (
              <div key={l} style={{ marginBottom: 10 }}><Link href={h} style={{ fontSize: 14, color: INK, textDecoration: "none" }}>{l}</Link></div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED, marginBottom: 14 }}>Risorse</div>
            {[["Come funziona", "/#how"], ["FAQ", "/#faq"], ["Perché Vexa", "/#why"]].map(([l, h]) => (
              <div key={l} style={{ marginBottom: 10 }}><a href={h} style={{ fontSize: 14, color: INK, textDecoration: "none" }}>{l}</a></div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED, marginBottom: 14 }}>Legale</div>
            {[["Privacy", "/legal/privacy"], ["Termini", "/legal/terms"]].map(([l, h]) => (
              <div key={l} style={{ marginBottom: 10 }}><Link href={h} style={{ fontSize: 14, color: INK, textDecoration: "none" }}>{l}</Link></div>
            ))}
          </div>
        </div>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "20px 24px 32px", borderTop: `1px solid ${LINE}`, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 12.5, color: MUTED }}>© 2026 Vexa Studios</span>
          <span style={{ fontSize: 12.5, color: MUTED }}>Qwen + Hunyuan3D + Stable Audio + Kimodo · locali e gratis</span>
        </div>
      </footer>
    </div>
  );
}
