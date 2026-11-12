"use client"

import { useEffect, useState } from "react"

const NIM_URL = "https://build.nvidia.com/z-ai/glm-5-3"
const DISMISS_KEY = "vexa_local_llm_dismissed"

type LlmStatus = {
  state: "off" | "downloading" | "downloaded" | "starting" | "ready" | "error"
  progress: number
  error?: string | null
  model?: string
}

type HunyuanStatus = {
  state: "off" | "downloading" | "extracting" | "downloading-models" | "starting" | "ready" | "error"
  progress: number
  error?: string | null
}

type ElectronNimApi = {
  setNimKey?: (key: string) => Promise<unknown>
  getLocalLlmStatus?: () => Promise<LlmStatus>
  startLocalLlm?: () => Promise<LlmStatus>
  onLocalLlmStatus?: (cb: (s: LlmStatus) => void) => () => void
  getHunyuanStatus?: () => Promise<HunyuanStatus>
  installHunyuan?: () => Promise<HunyuanStatus>
  retryHunyuan?: () => Promise<HunyuanStatus>
  onHunyuanStatus?: (cb: (s: HunyuanStatus) => void) => () => void
}
type WindowWithElectron = Window & { electronAPI?: ElectronNimApi }

type Backends = { hunyuan3d?: string | null; trellis?: string | null; local_llm?: string | null }

const textColor = "rgba(255,255,255,0.80)"
const dimColor = "rgba(255,255,255,0.44)"

const STATUS_UI: Record<string, { label: string; tone: string }> = {
  off: { label: "Modello locale non installato — funziona tutto subito, senza chiavi", tone: "#a78bfa" },
  downloading: { label: "Scaricamento modello locale…", tone: "#a78bfa" },
  downloaded: { label: "Modello scaricato, avvio…", tone: "#a78bfa" },
  starting: { label: "Caricamento modello locale (può richiedere un minuto)…", tone: "#a78bfa" },
  ready: { label: "Modello locale attivo — genera subito senza API key", tone: "#fcd846" },
  error: { label: "Modello locale non disponibile", tone: "#f48fb1" },
}

export default function KeySetupNim() {
  const [llm, setLlm] = useState<LlmStatus | null>(null)
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === "1" } catch { return false }
  })
  const [key, setKey] = useState("")
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [backends, setBackends] = useState<Backends | null>(null)
  const [hunyuan, setHunyuan] = useState<HunyuanStatus | null>(null)

  useEffect(() => {
    const api = (window as WindowWithElectron).electronAPI
    if (!api?.onLocalLlmStatus) return
    return api.onLocalLlmStatus(setLlm)
  }, [])

  useEffect(() => {
    const api = (window as WindowWithElectron).electronAPI
    if (!api?.onHunyuanStatus) return
    return api.onHunyuanStatus(setHunyuan)
  }, [])

  // Backend 3D locales: il route /api/actions/models li espone coi loro URL
  // solo quando il relativo server è davvero raggiungibile (zero cost).
  useEffect(() => {
    const api = (window as WindowWithElectron).electronAPI
    if (!api?.onLocalLlmStatus) return
    const tick = () => {
      fetch("/api/actions/models", { cache: "no-store" })
        .then(r => r.json().catch(() => null))
        .then(d => setBackends({ hunyuan3d: d?.backends?.hunyuan3d || null, trellis: d?.backends?.trellis || null, local_llm: d?.backends?.local_llm || null }))
        .catch(() => {})
    }
    const t = setInterval(tick, 8000)
    tick()
    return () => clearInterval(t)
  }, [])

  // Only Electron exposes the local-model subscription; the initial snapshot
  // arrives right after the page loads (did-finish-load broadcast in main.js).
  if (!llm || dismissed) return null

  const status = STATUS_UI[llm?.state || "off"] || STATUS_UI.off

  const storeKey = () => {
    const raw = key.trim()
    if (!/^nvapi-.+/.test(raw) || raw.length < 24) {
      setNote("La chiave deve iniziare con nvapi-. Ricopiala dalla pagina di GLM-5.3.")
      return
    }
    const el = (window as WindowWithElectron).electronAPI
    if (el?.setNimKey) {
      setSaving(true)
      el.setNimKey(raw)
        .then(() => setNote("Chiave salvata. Vexa si sta riavviando con la tua chiave..."))
        .catch((e) => { setSaving(false); setNote("Errore: " + (e?.message || e)) })
    }
  }

  const startLlm = () => {
    (window as WindowWithElectron).electronAPI?.startLocalLlm?.()
  }

  const downloading = llm?.state && ["downloaded", "downloading", "starting"].includes(llm.state)
  const huReady = hunyuan?.state === "ready" || !!backends?.hunyuan3d

  return (
    <>
    <div style={{
      width: "100%", marginTop: 26, padding: 20, borderRadius: 18,
      background: "linear-gradient(135deg, rgba(167,139,250,0.10), rgba(252,216,70,0.08))",
      border: "1px solid rgba(167,139,250,0.28)",
      boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
      textAlign: "left", animation: "fadeSlideUp .5s cubic-bezier(.16,1,.3,1) both",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", minWidth: 0 }}>
          <i className="bi bi-cpu" style={{ fontSize: 18, color: status.tone, marginTop: 3, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#e8e9ec", letterSpacing: "-0.01em", fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>
              Vexa gira subito — modello open-source integrato
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.55, color: status.tone }}>
              {status.label} · <span style={{ color: dimColor }}>Qwen3-8B (Q4), nessuna chiave necessaria.</span>
            </p>

            {llm?.state === "off" && (
              <button
                type="button"
                onClick={startLlm}
                style={{ marginTop: 12, padding: "10px 16px", borderRadius: 11, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit", color: "#050507", background: "#a78bfa" }}
              >
                Scarica il modello locale (~5,3 GB)
              </button>
            )}

            {downloading && (
              <div style={{ marginTop: 12 }}>
                <div style={{ height: 8, borderRadius: 100, background: "rgba(255,255,255,0.10)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${llm?.progress || 0}%`, background: "linear-gradient(90deg,#a78bfa,#fcd846)", borderRadius: 100, transition: "width .6s ease" }} />
                </div>
                <p style={{ margin: "6px 0 0", fontSize: 11.5, color: dimColor }}>
                  {llm?.progress || 0}% · la prima generazione parte subito dopo il download
                </p>
              </div>
            )}

            {llm?.state === "error" && (
              <button
                type="button"
                onClick={startLlm}
                style={{ marginTop: 12, padding: "10px 16px", borderRadius: 11, border: "1px solid rgba(244,143,177,0.5)", cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit", color: "#f48fb1", background: "transparent" }}
              >
                Riprova
              </button>
            )}
          </div>
        </div>
        <button
          type="button"
          aria-label="Chiudi"
          onClick={() => { try { localStorage.setItem(DISMISS_KEY, "1") } catch {}; setDismissed(true) }}
          style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.55)", cursor: "pointer", fontSize: 16, lineHeight: 1 }}
        >×</button>
      </div>

      {llm?.state === "off" && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: dimColor }}>
            <b style={{ color: textColor }}>Vuoi build più avanzati?</b> Collega la tua chiave NVIDIA gratuita (modello GLM-5.3):{" "}
            <a href={NIM_URL} target="_blank" rel="noopener noreferrer" style={{ color: "#fcd846", fontWeight: 600, textDecoration: "underline" }}>
              build.nvidia.com/z-ai/glm-5-3
            </a>
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="nvapi-…"
              style={{ flex: 1, minWidth: 0, padding: "10px 13px", borderRadius: 11, fontSize: 13.5, color: "#e8e9ec", background: "rgba(5,5,7,0.6)", border: "1px solid rgba(255,255,255,0.14)", outline: "none", fontFamily: "inherit" }}
            />
            <button
              type="button"
              onClick={storeKey}
              disabled={saving || !key.trim()}
              style={{ padding: "10px 16px", borderRadius: 11, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit", color: "#050507", background: "#fcd846", opacity: saving || !key.trim() ? 0.55 : 1, whiteSpace: "nowrap" }}
            >
              {saving ? "Salvataggio…" : "Usa la mia chiave"}
            </button>
          </div>
          {note && <p style={{ margin: "10px 0 0", fontSize: 12, color: "#a78bfa" }}>{note}</p>}
        </div>
      )}
    </div>

    <div style={{
      width: "100%", marginTop: 14, padding: 16, borderRadius: 14,
      background: "rgba(5,5,7,0.35)", border: "1px solid rgba(255,255,255,0.10)",
      textAlign: "left",
    }}>
      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: "#e8e9ec", fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>
        Modelli 3D — open source, in locale, gratis
      </p>
      <p style={{ margin: "5px 0 10px", fontSize: 12, lineHeight: 1.55, color: dimColor }}>
        Hunyuan3D 2.1 fa testo&rarr;3D con qualità professionale (agente unico con Qwen, si installa da solo dentro Vexa)· TRELLIS 2 è il veloce immagine&rarr;3D. Niente altro da scaricare, niente da pagare.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 11, marginTop: 2, color: huReady ? "#fcd846" : dimColor }}>{huReady ? "●" : "○"}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <b style={{ fontSize: 12.5, color: "#e8e9ec" }}>Hunyuan3D 2.1</b>
            {huReady ? (
              <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#fcd846" }}>Attivo — scegli &quot;Hunyuan3D 2.1&quot; nel tipo 3D Model.</p>
            ) : hunyuan?.state === "downloading" ? (
              <>
                <p style={{ margin: "2px 0 0", fontSize: 11.5, color: dimColor }}>
                  Installazione dentro Vexa… {hunyuan?.progress || 0}% — ~20 GB, serve spazio libero sul disco.
                </p>
                <div style={{ marginTop: 8, height: 7, borderRadius: 100, background: "rgba(255,255,255,0.10)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${hunyuan?.progress || 0}%`, background: "linear-gradient(90deg,#a78bfa,#fcd846)", borderRadius: 100, transition: "width .6s ease" }} />
                </div>
              </>
            ) : hunyuan?.state === "extracting" ? (
              <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#a78bfa" }}>
                Estrazione del motore 3D… (un paio di minuti)
              </p>
            ) : hunyuan?.state === "downloading-models" ? (
              <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#a78bfa" }}>
                Scaricamento dei modelli 3D (Hunyuan, ~19 GB)… si fa da solo dentro Vexa
              </p>
            ) : hunyuan?.state === "starting" ? (
              <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#a78bfa" }}>
                Avvio del motore 3D… (primo caricamento più lento)
              </p>
            ) : hunyuan?.state === "error" ? (
              <>
                <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#f48fb1" }}>{hunyuan.error || "Installazione non riuscita."}</p>
                <button
                  type="button"
                  onClick={() => (window as WindowWithElectron).electronAPI?.retryHunyuan?.()}
                  style={{ marginTop: 8, padding: "7px 14px", borderRadius: 9, border: "1px solid rgba(244,143,177,0.5)", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: "inherit", color: "#f48fb1", background: "transparent" }}
                >
                  Riprova
                </button>
              </>
            ) : (
              <>
                <p style={{ margin: "2px 0 0", fontSize: 11.5, color: dimColor }}>
                  Installato dentro Vexa, si scarica da solo (testo&rarr;3D professionale, agente con Qwen).
                </p>
                <button
                  type="button"
                  onClick={() => (window as WindowWithElectron).electronAPI?.installHunyuan?.()}
                  style={{ marginTop: 8, padding: "7px 14px", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: "inherit", color: "#050507", background: "#a78bfa" }}
                >
                  Installa il motore 3D
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
    </>
  )
}