"use client"

import { useEffect, useState } from "react"

type QaReport = {
  source?: string
  channel?: string
  runId?: string
  time?: number
  receivedAt?: number
  checks: Record<string, unknown>
}

const cardStyle: React.CSSProperties = {
  position: "fixed",
  right: 14,
  bottom: 14,
  width: 300,
  zIndex: 45,
  background: "rgba(10,12,16,0.92)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(252,216,70,0.16)",
  borderRadius: 14,
  boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
  color: "#e8e9ec",
  fontFamily: "'Space Grotesk', 'Inter', sans-serif",
  padding: "10px 12px",
  fontSize: 12,
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: ok ? "rgba(252,216,70,0.08)" : "rgba(252,129,129,0.10)", border: `1px solid ${ok ? "rgba(252,216,70,0.35)" : "rgba(252,129,129,0.40)"}`, color: ok ? "#fcd846" : "#fc8181", borderRadius: 999, padding: "2px 8px", fontWeight: 600 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: ok ? "#fcd846" : "#fc8181", flexShrink: 0 }} />
      {label}
    </span>
  )
}

const ago = (ms?: number) => {
  if (!ms) return ""
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000))
  if (s < 3) return "ora"
  if (s < 60) return `${s}s fa`
  return `${Math.floor(s / 60)}m fa`
}

export default function RuntimeQaPanel({ bridgeUrl, enabled }: { bridgeUrl: string; enabled: boolean }) {
  const [latest, setLatest] = useState<QaReport | null>(null)
  const [waiting, setWaiting] = useState(false)
  const [count, setCount] = useState(0)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let active = true
    const poll = async () => {
      try {
        const res = await fetch(`${bridgeUrl}/api/mcp/collect`, { cache: "no-store", signal: AbortSignal.timeout(3000) })
        if (!res.ok) throw new Error("bad status")
        const data = await res.json()
        if (!active) return
        setCount(data?.count ?? 0)
        const reports: QaReport[] = data?.reports ?? []
        if (reports.length > 0) {
          setLatest(reports[0])
          setWaiting(false)
        } else {
          setWaiting(true)
        }
        setOffline(false)
      } catch {
        if (active) setOffline(true)
      }
    }
    poll()
    const timer = setInterval(poll, 4000)
    return () => { active = false; clearInterval(timer) }
  }, [bridgeUrl, enabled])

  if (!enabled && !latest) return null

  const c = latest?.checks ?? {}
  const noCrash = c.noCrash !== false
  const course = c.course as { reachable?: boolean; chain?: number; total?: number } | undefined
  const errors = Array.isArray(c.errors) ? (c.errors as string[]) : []
  const spawnOk = c.spawnlocation === true
  const hasReport = !!latest && count > 0

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: offline ? "#fc8181" : hasReport ? "#fcd846" : "#f59e0b", flexShrink: 0, animation: waiting && !offline ? "pulse 1.3s ease-in-out infinite" : "none" }} />
        <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: "0.02em", color: "#e8e9ec" }}>RUNTIME QA</span>
        {hasReport && <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{ago(latest?.receivedAt)}</span>}
      </div>

      {offline && <div style={{ color: "#fc8181", fontSize: 11.5 }}>Bridge offline — risultati QA non raggiungono l&apos;app. Avvia il bridge Vexa.</div>}

      {!offline && !hasReport && (
        <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11.5, lineHeight: 1.5 }}>
          Premi <b style={{ color: "#fcd846" }}>Play</b> in Studio: il probe VexaQA si auto-verifica (errori script, spawn, corso raggiungibile) e i risultati compaiono qui in tempo reale.
        </div>
      )}

      {hasReport && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            <Badge ok={spawnOk} label={spawnOk ? "Spawn" : "NO SPAWN"} />
            <Badge ok={noCrash} label={noCrash ? "Script ok" : `${errors.length} error${errors.length === 1 ? "" : "i"}`} />
            {course && <Badge ok={course.reachable !== false} label={course.reachable !== false ? `Corso ${course.chain}/${course.total}` : `Corso ✕ ${course.chain}/${course.total}`} />}
            {typeof c.leaderstats === "boolean" && <Badge ok={c.leaderstats} label={c.leaderstats ? "Progressione" : "No progressione"} />}
            {typeof c.progression === "boolean" && <Badge ok={c.progression} label={c.progression ? "Loop attivo" : "Nessun progresso"} />}
            {Array.isArray(c.remotesDead) && (c.remotesDead as string[]).length > 0 && <Badge ok={false} label={`${(c.remotesDead as string[]).length} remote morte`} />}
            {c.humanoid === false && <Badge ok={false} label="Niente player" />}
            {c.combat === true && <Badge ok label="Scontro ok" />}
          </div>
          {Array.isArray(c.remotesDead) && (c.remotesDead as string[]).length > 0 && (
            <div style={{ color: "#fc8181", fontSize: 11, lineHeight: 1.45 }}>
              Remote senza handler: {(c.remotesDead as string[]).join(", ")}
            </div>
          )}
          {errors.length > 0 && (
            <div style={{ color: "#fc8181", fontSize: 11, lineHeight: 1.45, maxHeight: 68, overflowY: "auto" }}>
              {errors.map((e, i) => (
                <div key={i} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>• {e}</div>
              ))}
            </div>
          )}
          <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 10.5 }}>
            {Number(c.spawns) || 0} oggetti · {Number(c.scripts) || 0} script · {Number(c.remotes) || 0} remotes · {String(latest?.source || "VexaQA")} via {String(latest?.channel || "—")}
          </div>
        </div>
      )}
    </div>
  )
}