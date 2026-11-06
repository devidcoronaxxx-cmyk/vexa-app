"use client"
import { useEffect, useState } from "react"

type Engine = {
  id: string
  title: string
  desc: string
  icon: string
  tag: string
  port: number
  status: "installing" | "ready" | "soon" | "off"
  acc: string
}

const ENGINES: Engine[] = [
  {
    id: "qwen", title: "Qwen Chat", desc: "LLM open · ragionamento illimitato", icon: "bi-chat-dots", tag: "gpu",
    port: 9290, status: "off", acc: "#fcd846",
  },
  {
    id: "hunyuan", title: "Hunyuan3D-2", desc: "Testo/foto → modelli 3D · open unlimited", icon: "bi-box-seam", tag: "3d",
    port: 8081, status: "installing", acc: "#fcd846",
  },
  {
    id: "stable-audio", title: "Stable Audio", desc: "Musica/audio da testo locale", icon: "bi-music-note-beamed", tag: "audio",
    port: 9290, status: "soon", acc: "#22d3ee",
  },
  {
    id: "fluid", title: "AINVFX · Fluid", desc: "Effetti fluidi AI su video", icon: "bi-droplet", tag: "video",
    port: 8083, status: "soon", acc: "#60a5fa",
  },
]

export default function HubPage() {
  const [live, setLive] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const t = setInterval(async () => {
      const out: Record<string, boolean> = {}
      for (const e of ENGINES) {
        try {
          const r = await fetch(`http://127.0.0.1:${e.port}/health`, { signal: AbortSignal.timeout(1600) })
          out[e.id] = r.ok
        } catch { out[e.id] = false }
      }
      setLive(out)
    }, 4000)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{ padding: "28px 34px", maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 26 }}>
        <div style={{ width: 34, height: 34, borderRadius: 11, border: "1px solid rgba(252,216,70,0.35)", background: "linear-gradient(135deg,#ffe98a,#fcd846)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <i className="bi bi-grid-3x3-gap-fill" style={{ color: "#1a1a1a", fontSize: 15 }} />
        </div>
        <div>
          <h1 style={{ margin: 0, color: "#fff", fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em" }}>Everything Studio</h1>
          <p style={{ margin: "2px 0 0", color: "rgba(255,255,255,0.5)", fontSize: 13 }}>tutte le AI in un&apos;unica app · locali, illimitate, chiavi zero</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(330px,1fr))", gap: 16 }}>
        {ENGINES.map((e) => {
          const ok = live[e.id]
          const s = ok ? "ready" : e.status
          const dot = ok ? "#fcd846" : s === "installing" ? "#fcd846" : s === "soon" ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.18)"
          const label = ok ? "ATTIVO" : s === "installing" ? "INSTALLANDO…" : s === "soon" ? "DA ATTIVARE" : "OFFLINE"
          return (
            <button key={e.id} type="button" onClick={() => { if (s === "soon" || s === "off") alert("avvio motore: " + e.title) }}
              style={{
                textAlign: "left", padding: 20, borderRadius: 16, cursor: "pointer", fontFamily: "inherit", color: "#fff",
                background: "rgba(26,26,26,0.72)", border: "1px solid rgba(255,255,255,0.09)", backdropFilter: "blur(24px)",
                boxShadow: "0 2px 2px rgba(0,0,0,0.24), 0 8px 32px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.2)",
                transition: "transform .15s, border-color .15s", display: "flex", flexDirection: "column", gap: 12,
              }}
              onMouseEnter={(ev) => (ev.currentTarget.style.transform = "translateY(-2px)")}
              onMouseLeave={(ev) => (ev.currentTarget.style.transform = "")}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, border: `1px solid ${e.acc}44`, background: `${e.acc}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className={"bi " + e.icon} style={{ color: e.acc, fontSize: 18 }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", color: dot, border: `1px solid ${dot}55`, borderRadius: 999, padding: "4px 9px", background: `${dot}0d` }}>{label}</span>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 650, letterSpacing: "-0.01em" }}>{e.title}</div>
                <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.55)", marginTop: 3, lineHeight: 1.45 }}>{e.desc}</div>
              </div>
              <div style={{ display: "flex", gap: 7, fontSize: 10.5, color: "rgba(255,255,255,0.4)", marginTop: "auto" }}>
                <span style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "3px 7px" }}>{e.tag}</span>
                <span style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "3px 7px" }}>:{e.port}</span>
                {s === "ready" && <span style={{ border: "1px solid rgba(252,216,70,0.3)", borderRadius: 6, padding: "3px 7px", color: "#fcd846" }}>unlimited</span>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
