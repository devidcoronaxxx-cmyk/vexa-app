"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type FeedbackRow = { id: string; user_id: string; rating: number | null; comment: string | null; created_at: string }
type AdminOverviewResponse = { ok: boolean; counts: { users: number | null; messages: number | null; projects: number | null }; feedback: FeedbackRow[] }

const G = {
  fill: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.09)",
  blur: "blur(20px) saturate(1.5)",
  blurHeavy: "blur(40px) saturate(1.8)",
  shadowModal: "0 24px 80px rgba(0,0,0,0.7)",
}

const glassPill = {
  background: G.fill,
  backdropFilter: G.blur,
  WebkitBackdropFilter: G.blur,
  border: "1px solid " + G.border,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07)",
}

const glassModal = {
  background: "rgba(12,12,14,0.98)",
  backdropFilter: G.blurHeavy,
  WebkitBackdropFilter: G.blurHeavy,
  border: "1px solid rgba(255,255,255,0.10)",
  boxShadow: ["inset 0 1px 0 rgba(255,255,255,0.08)", "0 24px 80px rgba(0,0,0,0.7)"].join(", "),
}

function Stat({ icon, label, value }: { icon: string; label: string; value: number | null }) {
  return (
    <div style={{ flex: 1, padding: "14px 16px", ...glassPill, borderRadius: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
        <i className={"bi " + icon} style={{ fontSize: 14, color: "rgba(255,255,255,.32)" }} />
        <span style={{ fontSize: 10, color: "rgba(255,255,255,.32)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em" }}>{value === null ? "—" : value.toLocaleString()}</div>
    </div>
  )
}

export default function AdminPanel({ open, onClose, isMobile = false }: { open: boolean; onClose: () => void; isMobile?: boolean }) {
  const [closing, setClosing] = useState(false)
  const [tab, setTab] = useState<"overview" | "feedback" | "users">("overview")
  const [feedbackList, setFeedbackList] = useState<FeedbackRow[]>([])
  const [userList, setUserList] = useState<{ id: string; display_name: string | null; username: string | null; created_at: string }[]>([])
  const [userCount, setUserCount] = useState<number | null>(null)
  const [msgCount, setMsgCount] = useState<number | null>(null)
  const [projCount, setProjCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(open)
  const [prevOpen, setPrevOpen] = useState(open)

  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setClosing(false)
      setLoading(true)
    }
  }

  const close = useCallback(() => { setClosing(true); setTimeout(() => { setClosing(false); onClose() }, 240) }, [onClose])

  useEffect(() => {
    if (!open) return
    fetch("/api/admin/overview", { cache: "no-store" })
      .then(async r => { if (!r.ok) throw new Error(); return r.json() as Promise<AdminOverviewResponse> })
      .then(d => {
        setUserCount(d.counts.users); setMsgCount(d.counts.messages); setProjCount(d.counts.projects); setFeedbackList(d.feedback || [])
        supabase.from("profiles").select("id, display_name, username, created_at").order("created_at", { ascending: false }).limit(50).then(({ data }) => { if (data) setUserList(data as typeof userList) })
      })
      .catch(() => { setUserCount(null); setMsgCount(null); setProjCount(null); setFeedbackList([]); setUserList([]) })
      .finally(() => setLoading(false))
  }, [open])

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") close() }
    document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h)
  }, [close, open])

  if (!open && !closing) return null

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: closing ? "gFadeOut .24s ease forwards" : "gFadeIn .18s ease forwards" }}>
      <button type="button" onClick={close} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.68)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "none", cursor: "default" }} />
      <div style={{ position: "relative", width: isMobile ? "calc(100vw - 32px)" : "min(720px, calc(100vw - 32px))", maxHeight: isMobile ? "92vh" : "82vh", ...glassModal, borderRadius: 24, overflow: "hidden", display: "flex", flexDirection: "column", animation: closing ? "gScaleOut .24s ease forwards" : "gScaleIn .3s cubic-bezier(.16,1,.3,1) forwards" }}>
        <div style={{ padding: "20px 20px 0", borderBottom: "1px solid rgba(255,255,255,.07)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, ...glassPill, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className="bi bi-shield-check" style={{ fontSize: 15 }} />
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>Admin</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.32)" }}>vexa control panel</div>
              </div>
            </div>
            <button type="button" onClick={close} style={{ width: 30, height: 30, borderRadius: 8, ...glassPill, border: "1px solid rgba(255,255,255,.09)", color: "rgba(255,255,255,.38)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, transition: "all .18s ease" }}>
              <i className="bi bi-x-lg" />
            </button>
          </div>
          <div style={{ display: "flex", gap: 2 }}>
            {(["overview", "feedback", "users"] as const).map(t => (
              <button key={t} type="button" onClick={() => setTab(t)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 12px", background: "transparent", border: "none", cursor: "pointer", color: tab === t ? "#fff" : "rgba(255,255,255,.36)", fontWeight: tab === t ? 600 : 400, fontSize: 13, fontFamily: "inherit", borderBottom: tab === t ? "2px solid #fff" : "2px solid transparent", transition: "all .15s", marginBottom: -1 }}>
                <i className={"bi " + (t === "overview" ? "bi-bar-chart" : t === "feedback" ? "bi-chat-left-text" : "bi-people")} style={{ fontSize: 14 }} />
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid rgba(255,255,255,.10)", borderTopColor: "rgba(255,255,255,.7)", animation: "gSpin .7s linear infinite" }} />
            </div>
          ) : tab === "overview" ? (
            <>
              <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
                <Stat icon="bi-people" label="Users" value={userCount} />
                <Stat icon="bi-chat-dots" label="Messages" value={msgCount} />
                <Stat icon="bi-folder" label="Projects" value={projCount} />
              </div>
              <div style={{ padding: "12px 15px", ...glassPill, borderRadius: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.32)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 11 }}>Recent feedback</div>
                {feedbackList.length === 0
                  ? <p style={{ fontSize: 13, color: "rgba(255,255,255,.32)" }}>No feedback yet.</p>
                  : feedbackList.slice(0, 5).map(fb => (
                    <div key={fb.id} style={{ padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,.52)", lineHeight: 1.55 }}>{fb.comment}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,.22)", marginTop: 3 }}>{new Date(fb.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                    </div>
                  ))}
              </div>
            </>
          ) : tab === "feedback" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {feedbackList.length === 0
                ? <p style={{ textAlign: "center", color: "rgba(255,255,255,.32)", padding: 40 }}>No feedback yet.</p>
                : feedbackList.map(fb => (
                  <div key={fb.id} style={{ padding: "12px 15px", ...glassPill, borderRadius: 11 }}>
                    <p style={{ fontSize: 14, color: "rgba(255,255,255,.58)", lineHeight: 1.65, margin: 0 }}>{fb.comment}</p>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,.22)", marginTop: 6 }}>{new Date(fb.created_at).toLocaleDateString()}</div>
                  </div>
                ))}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.32)", marginBottom: 14 }}>{userCount !== null ? userCount + " registered users" : "Loading…"} · latest 50</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {userList.map((u, idx) => (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 13px", ...glassPill, borderRadius: 11 }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.09)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0, color: "#e8e9ec" }}>
                      {(u.display_name || u.username || "?").charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{u.display_name || "Unnamed"}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,.28)" }}>{u.username ? "@" + u.username : "no username"} · joined {new Date(u.created_at).toLocaleDateString()}</div>
                    </div>
                    <div style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,.18)" }}>#{String(idx + 1).padStart(3, "0")}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}