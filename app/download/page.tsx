"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { Navbar } from "../components/navbar"
import { Footer } from "../components/footer"

const SERIF = "Georgia, 'Times New Roman', serif"
const SANS = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
const INK = "#1a1f2e"
const CREAM = "#ffffff"
const ACCENT = "#3b5bdb"

const TIERS = [
  { key: "low", name: "Vexa Low", tag: "Tier S", ram: "≤8 GB RAM", vram: "4-6 GB VRAM", size: "~6 GB modelli", models: "Phi-4 Mini · TripoSR · Stable Audio 3 Small-SFX", desc: "Per PC deboli. Tutto gira in locale, anche su CPU. Qualità essenziale ma funzionante." },
  { key: "mid", name: "Vexa", tag: "Tier M (consigliato)", ram: "16 GB RAM", vram: "8-12 GB VRAM", size: "~25 GB modelli", models: "Qwen3 8B · Hunyuan3D 2.1 · Stable Audio Open 1.0 · Kimodo", desc: "Il nostro pick. Buon bilancio qualità/risorse. Gira bene su un PC medio (es. RTX 3060). Set principale: Qwen3-8B + Hunyuan3D 2.1 + Stable Audio + Kimodo." },
  { key: "high", name: "Vexa High", tag: "Tier L", ram: "24+ GB RAM", vram: "16-24 GB VRAM", size: "~40 GB modelli", models: "Qwen3 14B · TRELLIS 2 · Stable Audio 3 Medium", desc: "Per workstation. Qualità massima, PBR, animazioni. Richiede GPU potente." },
]


export default function DownloadPage() {
  const [version, setVersion] = useState("")

  useEffect(() => {
    fetch("/api/app/latest", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (d?.version) setVersion(String(d.version)) })
      .catch(() => {})
  }, [])

  return (
    <div style={{ minHeight: "100vh", background: CREAM, fontFamily: SANS, color: INK }}>
      <Navbar activePage="download" />

      <section style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "clamp(72px,10vw,120px) 24px clamp(48px,6vw,72px)", textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: "#fff", border: "1px solid #e5e5e5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 30px", boxShadow: "0 20px 60px rgba(0,0,0,0.08)" }}>
          <Image src="/icons/vexa-mark-navy.png" alt="Vexa" width={42} height={42} style={{ objectFit: "contain" }} />
        </div>

        <h1 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(40px,6vw,62px)", letterSpacing: "-0.015em", margin: "0 0 18px", color: INK }}>
          Scarica Vexa
        </h1>

        <p style={{ fontSize: "clamp(15px,2.4vw,17px)", color: "rgba(26,31,46,0.6)", lineHeight: 1.7, margin: "0 auto 18px", maxWidth: 560 }}>
          Scegli la versione adatta al tuo PC. Ogni versione installa l&apos;app; i modelli locali si scaricano dopo, in base al tier.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", fontSize: 12.5, color: "rgba(26,31,46,0.45)", marginBottom: 34 }}>
          <span>{version ? `v${version}` : "ultima versione"}</span>
          <span>·</span>
          <span>Windows 10/11 (Mac/Linux in arrivo)</span>
          <span>·</span>
          <span>Gratis</span>
          <span>·</span>
          <span>I modelli si installano da soli</span>
        </div>
      </section>

      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          {TIERS.map(t => (
            <div key={t.key} style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 18, padding: "26px 22px", boxShadow: "0 8px 30px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: ACCENT, border: `1px solid ${ACCENT}55`, borderRadius: 999, padding: "4px 11px" }}>{t.tag}</span>
              </div>
              <h3 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 26, margin: "10px 0 6px", color: INK }}>{t.name}</h3>
              <p style={{ fontSize: 13.5, color: "rgba(26,31,46,0.6)", lineHeight: 1.6, margin: "0 0 18px" }}>{t.desc}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18, fontSize: 13, color: "rgba(26,31,46,0.7)" }}>
                <div><b>RAM:</b> {t.ram}</div>
                <div><b>VRAM:</b> {t.vram}</div>
                <div><b>Modelli:</b> {t.size}</div>
                <div style={{ fontSize: 12, color: "rgba(26,31,46,0.5)" }}>{t.models}</div>
              </div>
              <a href={`/api/app/download?tier=${t.key}`} target="_blank" rel="noopener noreferrer" style={{ marginTop: "auto", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "14px 24px", borderRadius: 12, border: "none", background: `linear-gradient(135deg, #60a5fa 0%, ${ACCENT} 60%, #3b5bdb 100%)`, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 8px 24px rgba(59,91,219,0.25)", transition: "all .18s ease", textDecoration: "none" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                Download {t.name}
              </a>
            </div>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 880, margin: "0 auto", padding: "0 24px 40px" }}>
        <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 16, padding: "24px 22px" }}>
          <h3 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 22, margin: "0 0 8px", color: INK }}>Codice aperto, nessun virus</h3>
          <p style={{ fontSize: 13.5, color: "rgba(26,31,46,0.6)", lineHeight: 1.65, margin: "0 0 14px" }}>
            Tutto il progetto è pubblico su GitHub: puoi leggere ogni riga di codice e verificare che non ci sia nulla di malevolo.
          </p>
          <a href="https://github.com/devidcoronaxxx-cmyk/vexa-app" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, border: "1px solid #e5e5e5", background: "transparent", color: INK, fontWeight: 600, fontSize: 13, textDecoration: "none", fontFamily: "inherit" }}>
            Vedi il codice su GitHub
          </a>
          <p style={{ fontSize: 12, color: "rgba(26,31,46,0.45)", marginTop: 14, lineHeight: 1.6 }}>
            Vuoi usare questo progetto per creare la tua app? Contattami prima — il codice è aperto per studio e verifica, ma non per uso commerciale senza permesso.
          </p>
        </div>
      </section>

      <section style={{ maxWidth: 880, margin: "0 auto", padding: "0 24px 88px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          {[
            { t: "Sistemi completi", d: "Script, istanze, GUI, RemoteEvent — tutto generato e coerente.", icon: "bi-code-slash" },
            { t: "Sync con Rojo", d: "I file vanno nel progetto Rojo e Studio li prende live, senza copiare e incollare.", icon: "bi-arrow-repeat" },
            { t: "Locali e gratis", d: "I modelli girano sulla tua macchina. Nessun costo, nessun limite.", icon: "bi-pc-display" },
          ].map(f => (
            <div key={f.t} style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 16, padding: "22px 20px" }}>
              <i className={"bi " + f.icon} style={{ fontSize: 20, color: ACCENT }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: INK, margin: "12px 0 6px" }}>{f.t}</div>
              <div style={{ fontSize: 13.5, color: "rgba(26,31,46,0.6)", lineHeight: 1.65 }}>{f.d}</div>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  )
}
