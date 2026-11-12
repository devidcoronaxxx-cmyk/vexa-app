"use client"
import { useEffect, useState } from "react"

interface ElectronAPI {
  models?: {
    status: () => Promise<{ base: string; installed: string[]; hasAny: boolean }>
    install: (tier: string) => Promise<{ ok: boolean; code?: number; output?: string; error?: string }>
    onProgress: (cb: (d: { line: string }) => void) => () => void
  }
}
function getElectronAPI(): ElectronAPI | undefined {
  return (window as Window & { electronAPI?: ElectronAPI }).electronAPI
}

const TIERS = [
  { key: "S", label: "Tier S (PC debole)", size: "~8 GB", desc: "Phi-4 Mini + TripoSR + Stable Audio 3 Small. Funziona su CPU." },
  { key: "M", label: "Tier M (consigliato)", size: "~25 GB", desc: "Qwen3 8B + Hunyuan3D 2.1 + Stable Audio + Kimodo. RTX 3060." },
  { key: "L", label: "Tier L (workstation)", size: "~40 GB", desc: "Qwen3 14B + TRELLIS 2 + Stable Audio 3 Medium. GPU potente." },
]

export default function ModelInstallerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tier, setTier] = useState("M")
  const [installing, setInstalling] = useState(false)
  const [progress, setProgress] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) { const _t = setTimeout(() => { setProgress([]); setDone(false); setError(null); setInstalling(false) }, 0); return () => clearTimeout(_t) }
    const api = getElectronAPI()?.models
    if (!api) return
    const off = api.onProgress((d) => setProgress((p) => [...p, d.line]))
    return () => off()
  }, [open])

  const start = async () => {
    const api = getElectronAPI()?.models
    if (!api) { setError("Disponibile solo nell'app desktop."); return }
    setInstalling(true); setError(null); setProgress([])
    const res = await api.install(tier)
    setInstalling(false)
    if (res.ok) setDone(true)
    else setError(res.error || res.output?.slice(-300) || "Installazione fallita")
  }

  if (!open) return null

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2600, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}>
      <div style={{ width: "min(520px,calc(100vw - 32px))", background: "#17171b", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 18, padding: 24, color: "#ececec", fontFamily: "Inter, sans-serif" }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 700 }}>Installa modelli locali</h2>
        <p style={{ margin: "0 0 18px", fontSize: 13.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
          Vexa funziona anche senza (via cloud). I modelli locali servono per l&apos;offline e per qualità superiore. Scegli il tier adatto al tuo PC.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
          {TIERS.map(t => (
            <label key={t.key} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 12, borderRadius: 10, border: `1px solid ${tier === t.key ? "#fcd846" : "rgba(255,255,255,0.1)"}`, background: tier === t.key ? "rgba(252,216,70,0.06)" : "transparent", cursor: "pointer" }}>
              <input type="radio" name="tier" value={t.key} checked={tier === t.key} onChange={() => setTier(t.key)} style={{ marginTop: 3 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{t.label} <span style={{ fontWeight: 400, color: "rgba(255,255,255,0.4)", fontSize: 12 }}>({t.size})</span></div>
                <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{t.desc}</div>
              </div>
            </label>
          ))}
        </div>

        {progress.length > 0 && (
          <pre style={{ maxHeight: 160, overflow: "auto", background: "rgba(0,0,0,0.4)", padding: 10, borderRadius: 8, fontSize: 11, color: "rgba(255,255,255,0.7)", marginBottom: 12, whiteSpace: "pre-wrap" }}>
            {progress.join("")}
          </pre>
        )}

        {done && <div style={{ color: "#4ade80", fontSize: 13.5, marginBottom: 12 }}>✓ Modelli installati. Riavvia Vexa per attivarli.</div>}
        {error && <div style={{ color: "#fca5a5", fontSize: 12.5, marginBottom: 12, whiteSpace: "pre-wrap" }}>{error}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} disabled={installing} style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontFamily: "inherit" }}>
            Salta (usa cloud)
          </button>
          <button onClick={start} disabled={installing || done} style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#fcd846,#f2b705)", color: "#141005", fontWeight: 700, cursor: installing || done ? "default" : "pointer", fontFamily: "inherit" }}>
            {installing ? "Installazione..." : done ? "Fatto" : "Installa"}
          </button>
        </div>
      </div>
    </div>
  )
}
