"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { Navbar } from "../components/navbar"
import { Footer } from "../components/footer"

const SERIF = "Georgia, 'Times New Roman', serif"
const SANS = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
const INK = "#1c1b1a"
const CREAM = "#d8d5c8"
const ACCENT = "#bc5b28"

const TIERS = [
  { key: "low", name: "Vexa Low", tag: "Tier S", ram: "≤8 GB RAM", vram: "4-6 GB VRAM", size: "~6 GB modelli", models: "Phi-4 Mini · TripoSR · Stable Audio 3 Small-SFX", file: "Vexa-Low Setup 1.8.0.exe", desc: "Per PC deboli. Tutto gira in locale, anche su CPU. Qualità essenziale ma funzionante." },
  { key: "mid", name: "Vexa", tag: "Tier M (consigliato)", ram: "16 GB RAM", vram: "8-12 GB VRAM", size: "~11 GB modelli", models: "Qwen3 8B · Hunyuan3D 2.1 · Stable Audio Open 1.0 · Kimodo", file: "Vexa Setup 1.8.0.exe", desc: "Il nostro pick. Buon bilancio qualità/risorse. Gira bene su un PC medio (es. RTX 3060). Set principale: Qwen3-8B + Hunyuan3D 2.1 + Stable Audio + Kimodo." },
  { key: "high", name: "Vexa High", tag: "Tier L", ram: "24+ GB RAM", vram: "16-24 GB VRAM", size: "~40 GB modelli", models: "Qwen3 14B · TRELLIS 2 · Stable Audio 3 Medium", desc: "Per workstation. Qualità massima, PBR, animazioni. Richiede GPU potente." },
]

const ALL_MODELS = [
  { name: "Phi-4 Mini", cat: "LLM", tier: "S", size: "2.5 GB", live: true },
  { name: "Gemma 4 E2B", cat: "LLM", tier: "S", size: "2 GB", live: true },
  { name: "Qwen 3.5 4B", cat: "LLM", tier: "S", size: "3.4 GB", live: true },
  { name: "Qwen3 8B", cat: "LLM", tier: "M", size: "5 GB", live: true },
  { name: "Gemma 4 E4B/12B", cat: "LLM", tier: "M", size: "6.6 GB", live: true },
  { name: "Qwen3 14B", cat: "LLM", tier: "L", size: "9 GB", live: true },
  { name: "gpt-oss 20B", cat: "LLM", tier: "L", size: "12 GB", live: true },
  { name: "Qwen3.8 27B", cat: "LLM", tier: "XL", size: "24 GB", live: true },
  { name: "TripoSR", cat: "3D", tier: "S", size: "4 GB", live: true },
  { name: "Hunyuan3D-2mini", cat: "3D", tier: "S", size: "6 GB", live: true },
  { name: "Hunyuan3D-2", cat: "3D", tier: "M", size: "10 GB", live: true },
  { name: "Hunyuan3D 2.1", cat: "3D", tier: "M", size: "12 GB", live: true },
  { name: "TRELLIS 2", cat: "3D", tier: "L", size: "16 GB", live: true },
  { name: "Stable Audio 3 Small-SFX", cat: "Audio", tier: "S", size: "1.8 GB", live: true },
  { name: "Stable Audio 3 Small-Music", cat: "Audio", tier: "S", size: "1.8 GB", live: true },
  { name: "TinyAudio", cat: "Audio", tier: "S", size: "0.1 GB", live: true },
  { name: "Stable Audio Open Small", cat: "Audio", tier: "M", size: "1 GB", live: true },
  { name: "Stable Audio 3 Medium", cat: "Audio", tier: "M", size: "3 GB", live: true },
  { name: "Stable Audio Open 1.0", cat: "Audio", tier: "L", size: "3 GB", live: true },
  { name: "MusicGen Small", cat: "Audio", tier: "L", size: "1.5 GB", live: true },
  { name: "Kimodo", cat: "Animazione", tier: "M", size: "7 GB", live: true },
]

export default function DownloadPage() {
  const [version, setVersion] = useState("")
  const [downloading, setDownloading] = useState<string | null>(null)
  const [msg, setMsg] = useState("")

  useEffect(() => {
    fetch("/api/app/latest", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (d?.version) setVersion(String(d.version)) })
      .catch(() => {})
  }, [])

  const handleDownload = (tier: string) => {
    setDownloading(tier)
    setMsg("")
    fetch(`/api/app/download?tier=${tier}`, { cache: "no-store" })
      .then(async r => {
        if (r.redirected || r.ok) {
          const url = r.url
          if (url && url !== window.location.href) window.location.href = url
          else setMsg("Download non disponibile per questo tier. Controlla la configurazione.")
        } else {
          const d = await r.json().catch(() => ({}))
          setMsg(d?.message || "Download non disponibile per questo tier.")
        }
      })
      .catch(() => setMsg("Errore di rete. Riprova."))
      .finally(() => setTimeout(() => setDownloading(null), 1500))
  }

  return (
    <div style={{ minHeight: "100vh", background: CREAM, fontFamily: SANS, color: INK }}>
      <Navbar activePage="download" />

      <section style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "clamp(72px,10vw,120px) 24px clamp(48px,6vw,72px)", textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: "#fff", border: "1px solid #c8c4b8", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 30px", boxShadow: "0 20px 60px rgba(0,0,0,0.08)" }}>
          <Image src="/icons/vexa-mark-navy.png" alt="Vexa" width={42} height={42} style={{ objectFit: "contain" }} />
        </div>

        <h1 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(40px,6vw,62px)", letterSpacing: "-0.015em", margin: "0 0 18px", color: INK }}>
          Scarica Vexa
        </h1>

        <p style={{ fontSize: "clamp(15px,2.4vw,17px)", color: "rgba(28,27,26,0.6)", lineHeight: 1.7, margin: "0 auto 18px", maxWidth: 560 }}>
          Scegli la versione adatta al tuo PC. Ogni versione installa l&apos;app; i modelli locali si scaricano dopo, in base al tier.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", fontSize: 12.5, color: "rgba(28,27,26,0.45)", marginBottom: 34 }}>
          <span>{version ? `v${version}` : "ultima versione"}</span>
          <span>·</span>
          <span>Windows 10/11</span>
          <span>·</span>
          <span>Gratis</span>
          <span>·</span>
          <span>I modelli si installano da soli</span>
        </div>

        {msg && (
          <div style={{ marginBottom: 24, padding: "12px 18px", borderRadius: 12, background: "rgba(188,91,40,0.08)", border: "1px solid rgba(188,91,40,0.25)", color: ACCENT, fontSize: 13.5, maxWidth: 560 }}>
            {msg}
          </div>
        )}
      </section>

      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          {TIERS.map(t => (
            <div key={t.key} style={{ background: "#fff", border: "1px solid #c8c4b8", borderRadius: 18, padding: "26px 22px", boxShadow: "0 8px 30px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: ACCENT, border: `1px solid ${ACCENT}55`, borderRadius: 999, padding: "4px 11px" }}>{t.tag}</span>
              </div>
              <h3 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 26, margin: "10px 0 6px", color: INK }}>{t.name}</h3>
              <p style={{ fontSize: 13.5, color: "rgba(28,27,26,0.6)", lineHeight: 1.6, margin: "0 0 18px" }}>{t.desc}</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18, fontSize: 13, color: "rgba(28,27,26,0.7)" }}>
                <div><b>RAM:</b> {t.ram}</div>
                <div><b>VRAM:</b> {t.vram}</div>
                <div><b>Modelli:</b> {t.size}</div>
                <div style={{ fontSize: 12, color: "rgba(28,27,26,0.5)" }}>{t.models}</div>
              </div>

              <button onClick={() => handleDownload(t.key)} disabled={downloading === t.key} style={{ marginTop: "auto", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "14px 24px", borderRadius: 12, border: "none", background: `linear-gradient(135deg, #ffe98a 0%, ${ACCENT} 60%, #f2b705 100%)`, color: "#fff", fontWeight: 700, fontSize: 14, cursor: downloading === t.key ? "default" : "pointer", fontFamily: "inherit", boxShadow: "0 8px 24px rgba(188,91,40,0.25)", transition: "all .18s ease", opacity: downloading === t.key ? 0.7 : 1 }}>
                {downloading === t.key ? (
                  <span style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", animation: "spin 0.7s linear infinite" }} />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                )}
                {downloading === t.key ? "Download..." : `Download ${t.name}`}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 880, margin: "0 auto", padding: "0 24px 88px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          {[
            { t: "Sistemi completi", d: "Script, istanze, GUI, RemoteEvent — tutto generato e coerente.", icon: "bi-code-slash" },
            { t: "Sync con Rojo", d: "I file vanno nel progetto Rojo e Studio li prende live. Niente plugin, niente bridge.", icon: "bi-arrow-repeat" },
            { t: "Locali e gratis", d: "I modelli girano sulla tua macchina. Nessun costo, nessun limite.", icon: "bi-pc-display" },
          ].map(f => (
            <div key={f.t} style={{ background: "#fff", border: "1px solid #c8c4b8", borderRadius: 16, padding: "22px 20px" }}>
              <i className={"bi " + f.icon} style={{ fontSize: 20, color: ACCENT }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: INK, margin: "12px 0 6px" }}>{f.t}</div>
              <div style={{ fontSize: 13.5, color: "rgba(28,27,26,0.6)", lineHeight: 1.65 }}>{f.d}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 40px" }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(28,27,26,0.40)", marginBottom: 8 }}>Tutti i modelli disponibili</div>
        <h2 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(26px,3.6vw,36px)", letterSpacing: "-0.01em", margin: "0 0 10px", color: INK }}>Ogni modello, ogni tier.</h2>
        <p style={{ fontSize: 14.5, color: "rgba(28,27,26,0.55)", lineHeight: 1.65, maxWidth: 640, margin: "0 0 24px" }}>Nessun modello è obbligatorio: Vexa funziona anche senza, via cloud. Questi sono quelli che puoi installare in locale per generazione offline, raggruppati per categoria e tier.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
          {ALL_MODELS.map(m => (
            <div key={m.name} style={{ background: "#fff", border: "1px solid #c8c4b8", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: INK }}>{m.name}</span>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: ACCENT, border: `1px solid ${ACCENT}55`, borderRadius: 999, padding: "2px 8px" }}>{m.tier}</span>
              </div>
              <div style={{ fontSize: 12, color: "rgba(28,27,26,0.5)", marginBottom: 2 }}>{m.cat} · {m.size}</div>
            </div>
          ))}
        </div>
      </section>

      <Footer />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
