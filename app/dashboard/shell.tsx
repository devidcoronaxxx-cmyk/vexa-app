"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { supabase } from "@/lib/supabase"
import Settings from "@/app/components/Settings"
import { useI18n } from "@/app/localization/client"
import type { Profile, Project } from "@/lib/supabase"
import type { CSSProperties as Properties } from "react"


type ProjectWithMeta = Project

type SortKey = "updated" | "created" | "name"

interface ElectronAPI {
  openRobloxStudio?: () => Promise<void>
}

function getElectronAPI(): ElectronAPI | undefined {
  return (window as Window & { electronAPI?: ElectronAPI }).electronAPI
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// Deterministic gradient accent per project (name-hash → hue pairs)
const ACCENT_PAIRS = [
  ["#a78bfa", "#fcd846"],
  ["#c4b5fd", "#a78bfa"],
  ["#fcd846", "#fcd846"],
  ["#fbbf24", "#c4b5fd"],
  ["#a78bfa", "#fcd846"],
  ["#fb7185", "#fbbf24"],
] as const

function projectAccent(name: string): { from: string; to: string; rgbFrom: string; rgbTo: string } {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  const [from, to] = ACCENT_PAIRS[h % ACCENT_PAIRS.length]
  const hexToRgb = (hex: string) => `${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)}`
  return { from, to, rgbFrom: hexToRgb(from), rgbTo: hexToRgb(to) }
}


type FullProfile = Profile & {
  avatar_url?:       string | null
  roblox_user_id?:   number | null
  display_name?:     string | null
  username?:         string | null
  discord_id?:       string | null
  discord_username?: string | null
  discord_avatar?:   string | null
}


function getAvatarUrl(p: Profile): string | null {
  const fp = p as FullProfile
  return fp.avatar_url?.trim() || null
}

function safeDisplayName(p: Profile): string {
  const fp = p as FullProfile
  return fp.display_name?.trim() || fp.username?.trim() || "User"
}

function safeUsername(p: Profile): string {
  const fp = p as FullProfile
  const u = fp.username?.trim()
  return u ? "@" + u : ""
}


function RobloxAvatar({ userId, size = 32 }: { userId: number; size?: number }) {
  const [url, setUrl] = useState<string | null>(null)
  const initial = String(userId).charAt(0).toUpperCase()

  useEffect(() => {
    fetch(`/api/roblox-avatar?userId=${userId}`)
      .then(r => r.json())
      .then(d => { if (d.url) setUrl(d.url) })
      .catch(err => console.error("[RobloxAvatar] fetch threw:", err))
  }, [userId])

  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "1.5px solid rgba(255,255,255,0.11)" }}>
      {url
        ? <img src={url} width={size} height={size} alt="" style={{ objectFit: "cover", width: "100%", height: "100%", display: "block" }} />
        : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,rgba(255,255,255,0.14) 0%,rgba(255,255,255,0.06) 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.4), fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: "-0.01em" }}>{initial}</div>
      }
    </div>
  )
}

// ─── UserAvatar ───────────────────────────────────────────────────────────────
function UserAvatar({ profile, size = 32 }: { profile: Profile; size?: number }) {
  const fp = profile as FullProfile
  const avatarUrl = getAvatarUrl(profile)
  const initial   = safeDisplayName(profile).charAt(0).toUpperCase()

  if (fp.roblox_user_id && !avatarUrl) {
    return <RobloxAvatar userId={fp.roblox_user_id} size={size} />
  }

  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "1.5px solid rgba(255,255,255,0.11)", position: "relative" }}>
      {avatarUrl ? (
        <img src={avatarUrl} width={size} height={size} alt="" style={{ objectFit: "cover", width: "100%", height: "100%", display: "block" }} />
      ) : (
        <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,rgba(255,255,255,0.14) 0%,rgba(255,255,255,0.06) 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.4), fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: "-0.01em" }}>
          {initial}
        </div>
      )}
    </div>
  )
}

// ─── ProjectThumbnail ─────────────────────────────────────────────────────────
function ProjectThumbnail({ placeId }: { placeId: number | null }) {
  const [url,     setUrl]     = useState<string | null>(null)
  const [loading, setLoading] = useState(placeId === null)
  const [prevPlaceId, setPrevPlaceId] = useState(placeId)

  if (prevPlaceId !== placeId) {
    setPrevPlaceId(placeId)
    setUrl(null)
    setLoading(placeId !== null)
  }

  useEffect(() => {
    if (!placeId) return
    fetch(`/api/roblox-thumbnail?placeId=${placeId}`)
      .then(r => r.json())
      .then(d => { if (d.url) setUrl(d.url) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [placeId])

  if (loading) {
    return (
      <div className="g-shimmer" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <i className="bi bi-controller" style={{ fontSize: 30, color: "rgba(255,255,255,0.04)" }} />
      </div>
    )
  }

  if (!url) {
    return (
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.02)" }}>
        <i className="bi bi-controller" style={{ fontSize: 30, color: "rgba(255,255,255,0.07)" }} />
      </div>
    )
  }

  return (
    <img
      className="g-thumb-img"
      src={url}
      alt=""
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
    />
  )
}

// ─── Glass tokens ─────────────────────────────────────────────────────────────
const G = {
  fill:        "rgba(255,255,255,0.05)",
  fillHover:   "rgba(255,255,255,0.09)",
  border:      "rgba(252,216,70,0.14)",
  blur:        "blur(24px) saturate(1.6)",
  blurHeavy:   "blur(40px) saturate(1.8)",
  shadow:      "0 4px 24px rgba(0,0,0,0.35)",
  shadowModal: "0 16px 64px rgba(0,0,0,0.6)",
}

const glassPill: Properties = {
  background:           G.fill,
  backdropFilter:       G.blur,
  WebkitBackdropFilter: G.blur,
  border:               "1px solid " + G.border,
  boxShadow:            "inset 0 1px 0 rgba(255,255,255,0.10), 0 0 18px rgba(252,216,70,0.04)",
}

const glassModal: Properties = {
  background:           "rgba(8,9,12,0.97)",
  backdropFilter:       G.blurHeavy,
  WebkitBackdropFilter: G.blurHeavy,
  border:               "1px solid rgba(252,216,70,0.16)",
  boxShadow:            ["inset 0 1px 0 rgba(255,255,255,0.12)", G.shadowModal, "0 0 60px rgba(167,139,250,0.08)"].join(", "),
}

// ─── Shared modal backdrop ────────────────────────────────────────────────────
function ModalBackdrop({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.62)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "none", cursor: "default" }} />
}

// ─── ProjectLoadingOverlay ────────────────────────────────────────────────────
function ProjectLoadingOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(9,9,11,0.82)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14,
      animation: "gFadeIn 0.18s ease forwards",
    }}>

      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        border: "2.5px solid rgba(255,255,255,0.08)",
        borderTopColor: "rgba(255,255,255,0.38)",
        animation: "gSpin 0.75s linear infinite",
      }} />

      <span style={{
        fontSize: 12,
        fontWeight: 500,
        color: "rgba(255,255,255,0.28)",
        letterSpacing: "0.04em",
        fontFamily: "'Inter', sans-serif",
      }}>
        Loading project…
      </span>
    </div>
  )
}

// ─── DeleteConfirmModal ───────────────────────────────────────────────────────
function DeleteConfirmModal({ open, projectName, onConfirm, onCancel }: { open: boolean; projectName: string; onConfirm: () => void; onCancel: () => void }) {
  const [closing, setClosing] = useState(false)
  const [prevOpen, setPrevOpen] = useState(open)

  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setClosing(false)
  }

  const close = useCallback(() => { setClosing(true); setTimeout(() => { setClosing(false); onCancel() }, 220) }, [onCancel])
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") close() }
    document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h)
  }, [open, close])
  if (!open && !closing) return null
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: closing ? "gFadeOut .22s ease forwards" : "gFadeIn .18s ease forwards" }}>
      <ModalBackdrop onClick={close} />
      <div style={{ position: "relative", width: "min(400px,calc(100vw - 40px))", ...glassModal, borderRadius: 20, overflow: "hidden", animation: closing ? "gScaleOut .22s ease forwards" : "gScaleIn .28s cubic-bezier(.16,1,.3,1) forwards" }}>
        <div style={{ padding: "24px 24px 20px" }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(252,129,129,.10)", border: "1px solid rgba(252,129,129,.20)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, animation: "gShakeIn .4s cubic-bezier(.16,1,.3,1)" }}>
            <i className="bi bi-trash3" style={{ fontSize: 20, color: "#fc8181" }} />
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, letterSpacing: "-0.02em", color: "#fff" }}>Delete project?</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.55 }}>
            <span style={{ color: "rgba(255,255,255,.75)", fontWeight: 600 }}>{projectName}</span> and all its messages will be permanently deleted.
          </div>
        </div>
        <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />
        <div style={{ display: "flex", gap: 10, padding: "16px 24px" }}>
          <button type="button" onClick={close} style={{ flex: 1, height: 40, borderRadius: 10, ...glassPill, fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,.7)", cursor: "pointer", fontFamily: "inherit", transition: "all .18s" }}>Cancel</button>
          <button type="button" onClick={onConfirm} style={{ flex: 1, height: 40, borderRadius: 10, background: "rgba(252,129,129,.14)", border: "1px solid rgba(252,129,129,.28)", fontSize: 14, fontWeight: 700, color: "#fc8181", cursor: "pointer", fontFamily: "inherit", transition: "all .18s" }}>Delete</button>
        </div>
      </div>
    </div>
  )
}

// ─── NewProjectModal ──────────────────────────────────────────────────────────
function NewProjectModal({ open, onClose, profile, onCreate, creating }: { open: boolean; onClose: () => void; profile: Profile; onCreate: (name: string) => void; creating: boolean }) {
  const [name, setName] = useState("")
  const [closing, setClosing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [prevOpen, setPrevOpen] = useState(open)

  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setClosing(false)
      setName("")
    }
  }

  const close = useCallback(() => { setClosing(true); setTimeout(() => { setClosing(false); setName(""); onClose() }, 220) }, [onClose])
  const submit = () => { if (!name.trim() || creating) return; onCreate(name.trim().slice(0, 32)) }
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 80) }, [open])
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") close() }
    document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h)
  }, [open, close])
  if (!open && !closing) return null
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: closing ? "gFadeOut .22s ease forwards" : "gFadeIn .18s ease forwards" }}>
      <ModalBackdrop onClick={close} />
      <div style={{ position: "relative", width: "min(480px,calc(100vw - 32px))", ...glassModal, borderRadius: 22, overflow: "hidden", animation: closing ? "gScaleOut .22s ease forwards" : "gScaleIn .3s cubic-bezier(.16,1,.3,1) forwards" }}>
        <div style={{ padding: "22px 22px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>New project</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.35)", marginTop: 3 }}>Give your project a name to get started</div>
          </div>
          <button type="button" onClick={close} style={{ width: 30, height: 30, borderRadius: 8, ...glassPill, color: "rgba(255,255,255,.4)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, border: "1px solid rgba(255,255,255,0.10)", transition: "all .18s" }}>
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <div style={{ padding: "18px 22px 14px" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Project name</label>
          <input ref={inputRef} value={name} onChange={e => setName(e.target.value.slice(0, 32))} onKeyDown={e => e.key === "Enter" && submit()} placeholder="e.g. Combat System, Admin Panel…" maxLength={32}
            style={{ width: "100%", height: 42, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.10)", borderRadius: 11, padding: "0 14px", fontSize: 14, color: "#fff", fontFamily: "inherit", outline: "none", transition: "border-color .2s, box-shadow .2s" }} />
        </div>
        <div style={{ height: 1, background: "rgba(255,255,255,.07)", margin: "0 22px" }} />
        <div style={{ padding: "14px 22px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Project type</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={submit} disabled={creating || !name.trim()} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, padding: 14, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.20)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.14)", borderRadius: 13, cursor: name.trim() && !creating ? "pointer" : "not-allowed", opacity: name.trim() ? 1 : 0.5, position: "relative", textAlign: "left", transition: "all .18s" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><i className="bi bi-person" style={{ fontSize: 18 }} /></div>
              <div><div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>Solo</div><div style={{ fontSize: 12, color: "rgba(255,255,255,.4)", marginTop: 2 }}>Just you, building fast</div></div>
              <div style={{ position: "absolute", top: 12, right: 12, color: "#fff", fontSize: 14 }}><i className="bi bi-check-circle-fill" /></div>
            </button>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, padding: 14, background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 13, opacity: 0.45, position: "relative" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.4)" }}><i className="bi bi-people" style={{ fontSize: 18 }} /></div>
              <div><div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,.5)" }}>Collaborate</div><div style={{ fontSize: 12, color: "rgba(255,255,255,.3)", marginTop: 2 }}>Build with your team</div></div>
              <div style={{ position: "absolute", top: 10, right: 10, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.10)", borderRadius: 6, padding: "2px 7px" }}>Soon</div>
            </div>
          </div>
        </div>
        <div style={{ height: 1, background: "rgba(255,255,255,.07)", margin: "0 22px" }} />
        <div style={{ padding: "13px 22px 20px", display: "flex", alignItems: "center", gap: 10 }}>
          <UserAvatar profile={profile} size={28} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,.72)" }}>{safeDisplayName(profile)}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.3)" }}>will be set as project owner</div>
          </div>
          {creating && <div style={{ marginLeft: "auto", width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,.12)", borderTopColor: "rgba(255,255,255,.7)", animation: "gSpin .7s linear infinite" }} />}
        </div>
      </div>
    </div>
  )
}

// ─── AdminPanel ───────────────────────────────────────────────────────────────
type FeedbackRow = { id: string; comment: string | null; created_at: string }
type AdminOverviewResponse = { ok: boolean; counts: { users: number | null; messages: number | null; projects: number | null }; feedback: FeedbackRow[] }

function StatCard({ icon, label, value }: { icon: string; label: string; value: number | null }) {
  return (
    <div style={{ flex: 1, padding: "16px 18px", ...glassPill, borderRadius: 14, transition: "transform .2s, box-shadow .2s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <i className={"bi " + icon} style={{ fontSize: 15, color: "rgba(255,255,255,.35)" }} />
        <span style={{ fontSize: 11, color: "rgba(255,255,255,.35)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", color: "#fff" }}>{value === null ? "—" : value.toLocaleString()}</div>
    </div>
  )
}

function AdminPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [closing,      setClosing]      = useState(false)
  const [tab,          setTab]          = useState<"overview" | "feedback" | "users">("overview")
  const [feedbackList, setFeedbackList] = useState<FeedbackRow[]>([])
  const [userList,     setUserList]     = useState<{ id: string; display_name: string | null; username: string | null; created_at: string; avatar_url?: string | null; roblox_user_id?: number | null }[]>([])
  const [userCount,    setUserCount]    = useState<number | null>(null)
  const [msgCount,     setMsgCount]     = useState<number | null>(null)
  const [projCount,    setProjCount]    = useState<number | null>(null)
  const [loading,      setLoading]      = useState(open)
  const [prevOpen,     setPrevOpen]     = useState(open)

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
        supabase.from("profiles")
          .select("id, display_name, username, created_at, avatar_url, roblox_user_id")
          .order("created_at", { ascending: false }).limit(50)
          .then(({ data }) => { if (data) setUserList(data as typeof userList) })
      })
      .catch(() => { setUserCount(null); setMsgCount(null); setProjCount(null); setFeedbackList([]); setUserList([]) })
      .finally(() => setLoading(false))
  }, [open])

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") close() }
    document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h)
  }, [open, close])

  if (!open && !closing) return null

  const tabs = [
    { id: "overview"  as const, label: "Overview",  icon: "bi-bar-chart" },
    { id: "feedback"  as const, label: "Feedback",  icon: "bi-chat-left-text" },
    { id: "users"     as const, label: "Users",     icon: "bi-people" },
  ]

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: closing ? "gFadeOut .24s ease forwards" : "gFadeIn .18s ease forwards" }}>
      <ModalBackdrop onClick={close} />
      <div style={{ position: "relative", width: "min(720px,calc(100vw - 32px))", maxHeight: "82vh", ...glassModal, borderRadius: 24, overflow: "hidden", display: "flex", flexDirection: "column", animation: closing ? "gScaleOut .24s ease forwards" : "gScaleIn .3s cubic-bezier(.16,1,.3,1) forwards" }}>
        <div style={{ padding: "20px 20px 0", borderBottom: "1px solid rgba(255,255,255,.07)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, ...glassPill, display: "flex", alignItems: "center", justifyContent: "center" }}><i className="bi bi-shield-check" style={{ fontSize: 15 }} /></div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em", color: "#fff" }}>Admin</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.35)" }}>vexa control panel</div>
              </div>
            </div>
            <button type="button" onClick={close} style={{ width: 30, height: 30, borderRadius: 8, ...glassPill, border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,.4)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, transition: "all .18s" }}><i className="bi bi-x-lg" /></button>
          </div>
          <div style={{ display: "flex", gap: 2 }}>
            {tabs.map(t => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", background: "transparent", border: "none", cursor: "pointer", color: tab === t.id ? "#fff" : "rgba(255,255,255,.38)", fontWeight: tab === t.id ? 600 : 400, fontSize: 13, fontFamily: "inherit", borderBottom: tab === t.id ? "2px solid #fff" : "2px solid transparent", transition: "all .15s", marginBottom: -1 }}>
                <i className={"bi " + t.icon} style={{ fontSize: 14 }} />{t.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, gap: 14 }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid rgba(255,255,255,.12)", borderTopColor: "rgba(255,255,255,.7)", animation: "gSpin .7s linear infinite" }} />
              <span style={{ fontSize: 12, color: "rgba(255,255,255,.25)", animation: "gPulse 1.5s ease-in-out infinite" }}>Loading data…</span>
            </div>
          ) : tab === "overview" ? (
            <>
              <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                <StatCard icon="bi-people" label="Users" value={userCount} />
                <StatCard icon="bi-chat-dots" label="Messages" value={msgCount} />
                <StatCard icon="bi-folder" label="Projects" value={projCount} />
              </div>
              <div style={{ padding: "14px 16px", ...glassPill, borderRadius: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Recent feedback</div>
                {feedbackList.length === 0
                  ? <p style={{ fontSize: 13, color: "rgba(255,255,255,.35)" }}>No feedback yet.</p>
                  : feedbackList.slice(0, 5).map((fb, i) => (
                    <div key={fb.id} style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,.05)", animation: `gSlideDown .3s ${i * 0.05}s cubic-bezier(.16,1,.3,1) both` }}>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,.55)", lineHeight: 1.5 }}>{fb.comment}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,.25)", marginTop: 4 }}>{new Date(fb.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                  ))}
              </div>
            </>
          ) : tab === "feedback" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {feedbackList.length === 0
                ? <div style={{ textAlign: "center", padding: 40 }}><p style={{ fontSize: 14, color: "rgba(255,255,255,.35)" }}>No feedback yet.</p></div>
                : feedbackList.map((fb, i) => (
                  <div key={fb.id} style={{ padding: "14px 16px", ...glassPill, borderRadius: 12, animation: `gSlideDown .3s ${i * 0.04}s cubic-bezier(.16,1,.3,1) both` }}>
                    <p style={{ fontSize: 14, color: "rgba(255,255,255,.6)", lineHeight: 1.6, margin: 0 }}>{fb.comment}</p>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,.25)", marginTop: 8 }}>{new Date(fb.created_at).toLocaleDateString()}</div>
                  </div>
                ))}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.35)", marginBottom: 16 }}>{userCount !== null ? userCount + " registered users" : "Loading…"} · showing latest 50</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {userList.map((u, idx) => {
                  const userName = u.display_name || u.username || "Unnamed"
                  return (
                    <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", ...glassPill, borderRadius: 12, animation: `gSlideDown .3s ${idx * 0.03}s cubic-bezier(.16,1,.3,1) both`, transition: "background .18s" }}>
                      {u.roblox_user_id ? (
                        <RobloxAvatar userId={u.roblox_user_id} size={32} />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "1.5px solid rgba(255,255,255,.10)" }}>
                          {u.avatar_url
                            ? <img src={u.avatar_url} width={32} height={32} style={{ objectFit: "cover", width: "100%", height: "100%", display: "block" }} alt="" />
                            : <div style={{ width: "100%", height: "100%", background: "rgba(255,255,255,.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,.7)" }}>{userName.charAt(0).toUpperCase()}</div>
                          }
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", display: "flex", alignItems: "center", gap: 6 }}>
                          {userName}
                          {u.roblox_user_id && (
                            <span style={{ fontSize: 10, color: "#fcd846", background: "rgba(252,216,70,0.10)", border: "1px solid rgba(252,216,70,0.22)", borderRadius: 4, padding: "1px 5px", fontWeight: 600 }}>
                              Roblox
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,.3)" }}>{u.username ? "@" + u.username : "no username"} · joined {new Date(u.created_at).toLocaleDateString()}</div>
                      </div>
                      <div style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,.2)" }}>#{String(idx + 1).padStart(3, "0")}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── RobloxStudioModal ────────────────────────────────────────────────────────
function RobloxStudioModal({ open, onClose, onOpenStudio }: { open: boolean; onClose: () => void; onOpenStudio: () => void }) {
  const [closing, setClosing] = useState(false)
  const [prevOpen, setPrevOpen] = useState(open)

  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setClosing(false)
  }

  const close = useCallback(() => { setClosing(true); setTimeout(() => { setClosing(false); onClose() }, 220) }, [onClose])
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") close() }
    document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h)
  }, [open, close])
  if (!open && !closing) return null
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: closing ? "gFadeOut .22s ease forwards" : "gFadeIn .18s ease forwards" }}>
      <ModalBackdrop onClick={close} />
      <div style={{ position: "relative", width: "min(420px,calc(100vw - 40px))", ...glassModal, borderRadius: 20, overflow: "hidden", animation: closing ? "gScaleOut .22s ease forwards" : "gScaleIn .28s cubic-bezier(.16,1,.3,1) forwards" }}>
        <div style={{ padding: "24px 24px 20px" }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(252,216,70,.10)", border: "1px solid rgba(252,216,70,.20)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, animation: "gShakeIn .4s cubic-bezier(.16,1,.3,1)" }}>
            <i className="bi bi-rocket-takeoff" style={{ fontSize: 20, color: "#fcd846" }} />
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, letterSpacing: "-0.02em", color: "#fff" }}>Open Roblox Studio?</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.55 }}>
            Start building with Vexa right away. Rojo sync connects to Studio automatically.
          </div>
        </div>
        <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />
        <div style={{ display: "flex", gap: 10, padding: "16px 24px" }}>
          <button type="button" onClick={close} style={{ flex: 1, height: 40, borderRadius: 10, ...glassPill, fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,.7)", cursor: "pointer", fontFamily: "inherit", transition: "all .18s" }}>Not now</button>
          <button type="button" onClick={() => { onOpenStudio(); close() }} style={{ flex: 1, height: 40, borderRadius: 10, background: "rgba(252,216,70,.14)", border: "1px solid rgba(252,216,70,.28)", fontSize: 14, fontWeight: 700, color: "#fcd846", cursor: "pointer", fontFamily: "inherit", transition: "all .18s" }}>Open Studio</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main DashboardShell ──────────────────────────────────────────────────────
export default function DashboardShell({ profile, initialProjects }: { profile: Profile; initialProjects: Project[] }) {
  const { locale, setLocale } = useI18n()
  const [projects,         setProjects]         = useState<ProjectWithMeta[]>(initialProjects)
  const [newProjectOpen,   setNewProjectOpen]   = useState(false)
  const [creating,         setCreating]         = useState(false)
  const [deleteOpen,       setDeleteOpen]       = useState(false)
  const [deleteId,         setDeleteId]         = useState<string | null>(null)
  const [deleteName,       setDeleteName]       = useState("")
  const [settingsOpen,     setSettingsOpen]     = useState(false)
  const [adminOpen,        setAdminOpen]        = useState(false)
  const [profileMenuOpen,  setProfileMenuOpen]  = useState(false)
  const [sortMenuOpen,     setSortMenuOpen]     = useState(false)
  const [search,           setSearch]           = useState("")
  const [sort,             setSort]             = useState<SortKey>("updated")
  const [scrolled,         setScrolled]         = useState(false)
  const [filter,           setFilter]           = useState<"all" | "fav">("all")
  const [favoriteIds,      setFavoriteIds]      = useState<string[]>(() => {
    if (typeof window === "undefined") return []
    try { const raw = localStorage.getItem("vexa:favs"); return raw ? JSON.parse(raw) as string[] : [] } catch { return [] }
  })
  // Project loading overlay
  const [loadingProject,   setLoadingProject]   = useState(false)
  // Roblox Studio prompt
  const [robloxStudioOpen, setRobloxStudioOpen] = useState(false)

  useEffect(() => {
    try { localStorage.setItem("vexa:favs", JSON.stringify(favoriteIds)) } catch {}
  }, [favoriteIds])

  const toggleFavorite = (id: string) => {
    setFavoriteIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const profileMenuRef = useRef<HTMLDivElement>(null)
  const sortMenuRef    = useRef<HTMLDivElement>(null)

  const isAdmin   = !!(profile as FullProfile & { is_admin?: boolean }).is_admin
  const firstName = safeDisplayName(profile).split(" ")[0]

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 10)
    window.addEventListener("scroll", h, { passive: true })
    return () => window.removeEventListener("scroll", h)
  }, [])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) setProfileMenuOpen(false)
      if (sortMenuRef.current    && !sortMenuRef.current.contains(e.target as Node))    setSortMenuOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  // Navigate to project after delay so loading screen is visible
  const handleProjectClick = (projectId: string) => {
    setLoadingProject(true)
    setTimeout(() => {
      window.location.href = `/project/${projectId}`
    }, 1500)
  }

  const displayed = useMemo(() => {
    let list = [...projects]
    if (filter === "fav") list = list.filter(p => favoriteIds.includes(p.id))
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter(p => p.name.toLowerCase().includes(q)) }
    list.sort((a, b) => {
      if (sort === "name")    return a.name.localeCompare(b.name)
      if (sort === "created") return new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime()
      return new Date(b.updated_at || b.created_at || "").getTime() - new Date(a.updated_at || a.created_at || "").getTime()
    })
    return list
  }, [projects, search, sort, filter, favoriteIds])

  const handleCreate = async (name: string) => {
    setCreating(true)
    const { data, error } = await supabase.from("projects").insert({ user_id: profile.id, name }).select().single()
    if (!error && data) {
      setProjects(prev => [data, ...prev]); setNewProjectOpen(false)
      if (typeof window !== "undefined" && getElectronAPI()) {
        setRobloxStudioOpen(true)
      }
    }
    setCreating(false)
  }

  const handleOpenStudio = async () => {
    try { await getElectronAPI()?.openRobloxStudio?.() } catch {}
  }

  const promptDelete  = (id: string, name: string) => { setDeleteId(id); setDeleteName(name); setDeleteOpen(true) }
  const cancelDelete  = () => { setDeleteOpen(false); setDeleteId(null); setDeleteName("") }
  const confirmDelete = async () => {
    if (!deleteId) return; setDeleteOpen(false)
    const id = deleteId; setDeleteId(null); setDeleteName("")
    await supabase.from("projects").delete().eq("id", id)
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  const signOut = async () => { await supabase.auth.signOut(); window.location.href = "/auth/login" }

  const sortLabels: Record<SortKey, string> = { updated: "Last updated", created: "Date created", name: "Name (A–Z)" }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Space Grotesk', 'Inter', sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; color: #e8e8ee; background: transparent; }
        p      { font-size: 18px; line-height: 1.6; letter-spacing: -0.01em; font-weight: 400; }
        strong { font-weight: 600; color: white; }
        ::placeholder { color: rgba(255,255,255,0.22); }
        input:focus   { outline: none; border-color: rgba(255,255,255,0.26) !important; box-shadow: 0 0 0 3px rgba(255,255,255,0.04) !important; }

        @keyframes gSpin      { to { transform: rotate(360deg) } }
        @keyframes gFadeIn    { from { opacity: 0 } to { opacity: 1 } }
        @keyframes gFadeOut   { from { opacity: 1 } to { opacity: 0 } }
        @keyframes gScaleIn   { from { opacity: 0; transform: scale(0.94) translateY(8px) } to { opacity: 1; transform: scale(1) translateY(0) } }
        @keyframes gScaleOut  { from { opacity: 1; transform: scale(1) translateY(0) } to { opacity: 0; transform: scale(0.94) translateY(6px) } }
        @keyframes gCardIn    { from { opacity: 0; transform: translateY(20px) scale(0.97) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes gMenuIn    { from { opacity: 0; transform: translateY(6px) scale(0.97) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes gHeaderIn  { from { opacity: 0; transform: translateY(-12px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes gHeroIn    { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes gSlideDown { from { opacity: 0; transform: translateY(-8px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes gShakeIn   { 0% { transform: scale(0.7) rotate(-8deg) } 60% { transform: scale(1.1) rotate(4deg) } 100% { transform: scale(1) rotate(0deg) } }
        @keyframes gShimmer   { 0% { background-position: -200% center } 100% { background-position: 200% center } }
        @keyframes gPulse     { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }
        @keyframes gFloat     { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
        @keyframes gBounceIn  { 0% { transform: scale(0) } 60% { transform: scale(1.15) } 100% { transform: scale(1) } }
        @keyframes gCountUp   { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }

        .g-nav-btn:hover       { background: rgba(255,255,255,0.07) !important; }
        .g-menu-item:hover     { background: rgba(255,255,255,0.07) !important; color: #fff !important; }
        .g-signout:hover       { color: #fc8181 !important; }
        .g-new-btn:hover       { background: rgba(255,255,255,0.10) !important; border-color: rgba(255,255,255,0.20) !important; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.3) !important; }
        .g-new-btn:active      { transform: translateY(0) scale(0.97) !important; }
        .g-add-card:hover      { background: rgba(255,255,255,0.05) !important; border-color: rgba(255,255,255,0.16) !important; color: rgba(255,255,255,0.5) !important; transform: translateY(-3px) !important; }

        /* Project card — NO upward translate on hover, just a subtle lift */
        .g-proj-card           { transition: box-shadow 0.26s ease, border-color 0.26s ease, opacity 0.2s ease, transform 0.26s cubic-bezier(.16,1,.3,1) !important; }
        .g-proj-card:hover     { box-shadow: 0 16px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(252,216,70,0.28), 0 0 32px rgba(252,216,70,0.12) !important; border-color: rgba(252,216,70,0.4) !important; transform: translateY(-3px) !important; }
        .g-proj-card:active    { opacity: 0.85 !important; transform: translateY(0) scale(0.985) !important; }
        .g-proj-card:hover .g-accent-glow { opacity: 1 !important; }

        /* Delete button — smooth reveal, no shapeshifting */
        .g-proj-card .g-del-btn {
          opacity: 0;
          transform: scale(0.85);
          transition: opacity 0.2s ease, transform 0.2s ease, background 0.15s ease, color 0.15s ease, border-color 0.15s ease !important;
        }
        .g-proj-card:hover .g-del-btn {
          opacity: 1 !important;
          transform: scale(1) !important;
        }
        .g-del-btn:hover       { background: rgba(252,129,129,0.15) !important; color: #fc8181 !important; border-color: rgba(252,129,129,0.3) !important; }

        .g-fav-btn { opacity: 0; transform: scale(0.85); transition: opacity 0.2s ease, transform 0.2s ease, background 0.15s ease, border-color 0.15s ease !important; }
        .g-proj-card:hover .g-fav-btn { opacity: 1 !important; transform: scale(1) !important; }
        .g-fav-btn.g-fav-active { opacity: 1; transform: scale(1); }
        .g-fav-btn:hover       { background: rgba(251,191,36,0.15) !important; border-color: rgba(251,191,36,0.35) !important; }

        .g-sort-btn:hover      { background: rgba(255,255,255,0.07) !important; }
        .g-sort-item:hover     { background: rgba(255,255,255,0.06) !important; }
        .g-search:focus        { border-color: rgba(255,255,255,0.20) !important; }
        .g-close-search:hover  { color: rgba(255,255,255,0.6) !important; }
        .g-thumb-img           { transition: transform 0.5s ease !important; }
        .g-proj-card:hover .g-thumb-img { transform: scale(1.06) !important; }

        .g-shimmer {
          background: linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 75%);
          background-size: 200% 100%;
          animation: gShimmer 1.6s ease-in-out infinite;
        }
      `}</style>


      <ProjectLoadingOverlay visible={loadingProject} />

      <NewProjectModal open={newProjectOpen} onClose={() => setNewProjectOpen(false)} profile={profile} onCreate={handleCreate} creating={creating} />
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} profile={profile} locale={locale} setLocale={setLocale} />
      {isAdmin && <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} />}
      <DeleteConfirmModal open={deleteOpen} projectName={deleteName} onConfirm={confirmDelete} onCancel={cancelDelete} />
      <RobloxStudioModal open={robloxStudioOpen} onClose={() => setRobloxStudioOpen(false)} onOpenStudio={handleOpenStudio} />

      <div className="vx-sky">
        <div className="aur aur-a" /><div className="aur aur-b" /><div className="aur aur-c" /><div className="aur aur-d" />
        <div className="grain" />
      </div>

      <div className="vx-app" style={{ minHeight: "100vh", background: "transparent", fontFamily: "'Space Grotesk', 'Inter', sans-serif", color: "#fff", position: "relative", overflow: "hidden" }}>

        <header style={{
          position: "sticky", top: 0, zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 28px",
          height: 58,
          background: scrolled ? "rgba(6,7,10,0.9)" : "rgba(6,7,10,0.55)",
          backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
          borderBottom: scrolled ? "1px solid rgba(252,216,70,0.16)" : "1px solid rgba(255,255,255,0.06)",
          boxShadow: scrolled ? "0 6px 40px rgba(0,0,0,0.5), 0 1px 0 rgba(252,216,70,0.06)" : "none",
          transition: "background 0.3s, border-color 0.3s, box-shadow 0.3s",
          animation: "gHeaderIn 0.45s cubic-bezier(0.16,1,0.3,1) both",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, animation: "gFloat 6s ease-in-out infinite" }}>
            <Image src="/icons/vexa-mark-cream.png" alt="Vexa" width={22} height={22} style={{ objectFit: "contain", filter: "drop-shadow(0 0 8px rgba(252,216,70,0.5))" }} />
            <span className="vx-display" style={{ fontSize: 15, color: "#fff", letterSpacing: "-0.02em" }}>Vexa</span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#060810", background: "linear-gradient(135deg,#fcd846,#fcd846)", borderRadius: 6, padding: "2px 6px", marginLeft: 2 }}>Studio</span>
          </div>


          <div ref={profileMenuRef} style={{ position: "relative" }}>
            <button type="button" className="g-nav-btn" onClick={() => setProfileMenuOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px 5px 5px", borderRadius: 10, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s" }}>
              <UserAvatar profile={profile} size={28} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.72)" }}>{firstName}</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.38, transition: "transform .2s", transform: profileMenuOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {profileMenuOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 210, ...glassModal, borderRadius: 14, padding: 5, animation: "gMenuIn 0.22s cubic-bezier(0.16,1,0.3,1)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: 4 }}>
                  <UserAvatar profile={profile} size={32} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{safeDisplayName(profile)}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>{safeUsername(profile)}</div>
                  </div>
                </div>
                <button type="button" className="g-menu-item" onClick={() => { setSettingsOpen(true); setProfileMenuOpen(false) }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 8, border: "none", background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "background 0.15s, color 0.15s" }}>
                  <i className="bi bi-gear" style={{ fontSize: 14 }} />Settings
                </button>
                {isAdmin && (
                  <button type="button" className="g-menu-item" onClick={() => { setAdminOpen(true); setProfileMenuOpen(false) }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 8, border: "none", background: "transparent", color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "background 0.15s, color 0.15s" }}>
                  <i className="bi bi-shield-check" style={{ fontSize: 14 }} />Admin Panel
                </button>
                )}
                <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0" }} />
                <button type="button" className="g-menu-item g-signout" onClick={signOut} style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 8, border: "none", background: "transparent", color: "rgba(255,255,255,0.38)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "background 0.15s, color 0.15s" }}>
                  <i className="bi bi-box-arrow-right" style={{ fontSize: 14 }} />Sign out
                </button>
              </div>
            )}
          </div>
        </header>


        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "44px 28px 80px", animation: "gHeroIn 0.55s 0.08s cubic-bezier(0.16,1,0.3,1) both", position: "relative", zIndex: 1 }}>

          {/* ─── Premium hero ─────────────────────────────────────────────── */}
          {/* Spectacular hero */}
          <div className="vx-hero-panel" style={{ padding: "32px 34px", marginBottom: 20 }}>
            <div style={{ position: "absolute", top: -140, right: -80, width: 340, height: 340, borderRadius: "50%", background: "radial-gradient(circle, rgba(167,139,250,0.32) 0%, transparent 65%)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: -180, left: 140, width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(252,216,70,0.22) 0%, transparent 65%)", pointerEvents: "none" }} />

            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <div style={{ position: "relative", width: 66, height: 66, borderRadius: 21, padding: 2, border: "1px solid rgba(252,216,70,0.35)", boxShadow: "0 10px 30px rgba(0,0,0,0.4), 0 0 34px rgba(252,216,70,0.25), inset 0 1px 0 rgba(255,255,255,0.2)", flexShrink: 0, background: "linear-gradient(135deg, rgba(252,216,70,0.35), rgba(167,139,250,0.35))" }}>
                  <div style={{ borderRadius: 18, overflow: "hidden", width: "100%", height: "100%" }}>
                    <UserAvatar profile={profile} size={62} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#ffe98a", marginBottom: 5, display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fcd846", boxShadow: "0 0 10px rgba(252,216,70,0.9)", animation: "livePulse 2.2s ease infinite" }} />
                    Welcome back
                  </div>
                  <h1 className="vx-display" style={{ fontSize: 34, color: "#fff", margin: 0, animation: "gCountUp .5s .1s cubic-bezier(.16,1,.3,1) both" }}>
                    <span className="vx-grad-anim">{firstName}</span>
                  </h1>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: "6px 0 0", lineHeight: 1.4, animation: "gCountUp .5s .18s cubic-bezier(.16,1,.3,1) both" }}>
                    {projects.length === 0
                      ? "Ready to build something legendary?"
                      : `${projects.length} project${projects.length !== 1 ? "s" : ""} · ${projects.length === 1 ? "your workspace is live" : "your workspaces are ready"}`}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button type="button" className="g-new-btn vx-btn vx-btn-prime" onClick={() => setNewProjectOpen(true)} style={{ padding: "12px 22px", fontSize: 14, animation: "gCountUp .5s .25s cubic-bezier(.16,1,.3,1) both" }}>
                  <i className="bi bi-plus-lg" style={{ fontSize: 13 }} />New project
                </button>
              </div>
            </div>
          </div>

          {/* ─── Stats row ────────────────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 26, animation: "gSlideDown .4s .15s cubic-bezier(.16,1,.3,1) both" }}>
            {[
              { icon: "bi-folder2-open", label: "Projects", value: projects.length, color: "#a78bfa", rgb: "167,139,250" },
              { icon: "bi-stars", label: "AI generated", value: projects.length > 0 ? projects.length * 3 : 0, color: "#fcd846", rgb: "190,242,100" },
              { icon: "bi-activity", label: "Last update", value: projects.length > 0 ? "Live" : "—", color: "#fcd846", rgb: "163,230,53" },
            ].map(s => (
              <div key={s.label} className="vx-stat" style={{ display: "flex", alignItems: "center", gap: 12, padding: "15px 17px", border: "1px solid rgba(255,255,255,0.08)", boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 0 30px rgba(${s.rgb},0.05)` }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `rgba(${s.rgb},0.12)`, border: `1px solid rgba(${s.rgb},0.28)`, boxShadow: `0 4px 14px rgba(${s.rgb},0.15), inset 0 1px 0 rgba(255,255,255,0.12)` }}>
                  <i className={"bi " + s.icon} style={{ fontSize: 16, color: s.color }} />
                </div>
                <div>
                  <div className="num" style={{ fontSize: 21 }}>{s.value}</div>
                  <div className="lbl" style={{ marginTop: 3 }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 18, animation: "gSlideDown .4s .1s cubic-bezier(.16,1,.3,1) both" }}>
            <div>
              <h2 className="vx-display" style={{ fontSize: 24, color: "#fff", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
                <span>Your projects</span>
                <span className="vx-chip vx-chip-lime" style={{ borderRadius: 999, padding: "3px 10px", fontSize: 12 }}>{projects.length}</span>
              </h2>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", margin: "5px 0 0", lineHeight: 1.4 }}>
                {filter === "fav"
                  ? "Your starred projects, ready to jump back into"
                  : "Every build, system, and experiment you've shipped"}
              </p>
            </div>
          </div>

          {projects.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22, flexWrap: "wrap", animation: "gSlideDown .4s .1s cubic-bezier(.16,1,.3,1) both" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, padding: 3, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10 }}>
                {([["all", "bi-folder2-open", "All"], ["fav", "bi-star", "Favorites"]] as const).map(([key, icon, label]) => {
                  const count = key === "all" ? projects.length : projects.filter(p => favoriteIds.includes(p.id)).length
                  const active = filter === key
                  return (
                    <button key={key} type="button" onClick={() => setFilter(key)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 7, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: active ? 700 : 500, color: active ? "#fff" : "rgba(255,255,255,0.45)", background: active ? "rgba(252,216,70,0.22)" : "transparent", boxShadow: active ? "inset 0 1px 0 rgba(255,255,255,0.10), 0 2px 10px rgba(0,0,0,0.25)" : "none", transition: "all .18s" }}>
                      <i className={"bi " + icon} style={{ fontSize: 12 }} />
                      {label}
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: active ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)", background: active ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)", borderRadius: 6, padding: "1px 6px" }}>{count}</span>
                    </button>
                  )
                })}
              </div>
              <div style={{ flex: 1, minWidth: 180, position: "relative" }}>
                <i className="bi bi-search" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "rgba(255,255,255,0.26)", pointerEvents: "none" }} />
                <input className="g-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects…"
                  style={{ width: "100%", height: 38, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, paddingLeft: 36, paddingRight: search ? 34 : 14, fontSize: 13, color: "#fff", fontFamily: "inherit", outline: "none", transition: "border-color 0.2s, box-shadow 0.2s" }} />
                {search && (
                  <button type="button" className="g-close-search" onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(255,255,255,0.28)", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", transition: "color 0.15s" }}>
                    <i className="bi bi-x-circle-fill" />
                  </button>
                )}
              </div>
              <div ref={sortMenuRef} style={{ position: "relative" }}>
                <button type="button" className="g-sort-btn" onClick={() => setSortMenuOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 12px", height: 38, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s", whiteSpace: "nowrap" }}>
                  <i className="bi bi-arrow-down-up" style={{ fontSize: 13 }} />
                  {sortLabels[sort]}
                  <i className={"bi " + (sortMenuOpen ? "bi-chevron-up" : "bi-chevron-down")} style={{ fontSize: 11, opacity: 0.5, transition: "transform .2s" }} />
                </button>
                {sortMenuOpen && (
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 180, ...glassModal, borderRadius: 12, padding: 5, animation: "gMenuIn 0.18s cubic-bezier(0.16,1,0.3,1)", zIndex: 100 }}>
                    {(["updated", "created", "name"] as SortKey[]).map(k => (
                      <button key={k} type="button" className="g-sort-item" onClick={() => { setSort(k); setSortMenuOpen(false) }} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 11px", borderRadius: 8, border: "none", background: "transparent", color: sort === k ? "#fff" : "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: sort === k ? 600 : 400, cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s" }}>
                        {sortLabels[k]}
                        {sort === k && <i className="bi bi-check-lg" style={{ fontSize: 13, animation: "gBounceIn .25s cubic-bezier(.34,1.56,.64,1)" }} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}


          {projects.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px", textAlign: "center", animation: "gHeroIn .5s .15s cubic-bezier(.16,1,.3,1) both" }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18, animation: "gFloat 5s ease-in-out infinite" }}>
                <i className="bi bi-controller" style={{ fontSize: 28, color: "rgba(255,255,255,0.12)" }} />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8, color: "#fff" }}>No projects yet</h2>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", marginBottom: 24, lineHeight: 1.6, maxWidth: 280 }}>Get started by making your first project.</p>
              <button type="button" className="vx-btn vx-btn-prime" onClick={() => setNewProjectOpen(true)} style={{ padding: "12px 22px", fontSize: 14 }}>
                <i className="bi bi-plus-lg" style={{ fontSize: 13 }} />Create project
              </button>
            </div>
          ) : displayed.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 20px", textAlign: "center", animation: "gFadeIn .3s ease" }}>
              <i className={"bi " + (filter === "fav" ? "bi-star" : "bi-search")} style={{ fontSize: 28, color: "rgba(255,255,255,0.12)", marginBottom: 14 }} />
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", margin: 0 }}>
                {filter === "fav"
                  ? search.trim()
                    ? `No favorites match "${search}"`
                    : "No favorite projects yet — tap the star on a project to pin it here"
                  : `No projects match "${search}"`}
              </p>
              {filter === "fav" && !search.trim() && (
                <button type="button" onClick={() => setFilter("all")} style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", background: "rgba(252,216,70,0.14)", border: "1px solid rgba(252,216,70,0.35)", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", fontFamily: "inherit", transition: "all .18s" }}>
                  <i className="bi bi-folder2-open" style={{ fontSize: 12 }} />View all projects
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(272px, 1fr))", gap: 14 }}>
              {displayed.map((project, idx) => {
                const accent = projectAccent(project.name)
                const initials = project.name.trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join("") || "VX"
                return (
                  <div
                    key={project.id}
                    className="g-proj-card vx-card"
                    onClick={() => handleProjectClick(project.id)}
                    style={{
                      position: "relative",
                      background: "linear-gradient(180deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.02) 100%)",
                      border: "1px solid rgba(255,255,255,0.09)",
                      borderRadius: 18,
                      overflow: "hidden",
                      cursor: "pointer",
                      animation: `gCardIn 0.5s cubic-bezier(0.16,1,0.3,1) ${idx * 0.06}s both`,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                    }}
                  >
                    <div className="g-accent-glow" style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0, transition: "opacity .25s", background: `radial-gradient(420px 200px at 50% -30px, rgba(${accent.rgbFrom},0.14), transparent 70%)`, }} />

                    <div style={{ position: "relative", width: "100%", paddingTop: "52%", overflow: "hidden" }}>
                      <ProjectThumbnail placeId={project.place_id ?? null} />

                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 70, background: "linear-gradient(to top, rgba(9,9,11,0.95), transparent)", pointerEvents: "none" }} />
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${accent.from}, ${accent.to})`, boxShadow: `0 0 12px rgba(${accent.rgbFrom},0.5)` }} />
                      <button
                        type="button"
                        className={favoriteIds.includes(project.id) ? "g-fav-btn g-fav-active" : "g-fav-btn"}
                        onClick={e => { e.stopPropagation(); toggleFavorite(project.id) }}
                        aria-label={favoriteIds.includes(project.id) ? "Remove from favorites" : "Add to favorites"}
                        style={{
                          position: "absolute", top: 12, left: 12,
                          width: 28, height: 28, borderRadius: 9,
                          background: "rgba(0,0,0,0.55)",
                          backdropFilter: "blur(8px)",
                          border: "1px solid rgba(255,255,255,0.10)",
                          cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12,
                          transition: "background 0.15s, color 0.15s, transform 0.15s",
                        }}
                      >
                        <i className="bi bi-star-fill" style={favoriteIds.includes(project.id) ? { color: "#fbbf24", textShadow: "0 0 10px rgba(251,191,36,0.5)" } : { color: "rgba(255,255,255,0.4)" }} />
                      </button>
                      <button
                        type="button"
                        className="g-del-btn"
                        onClick={e => { e.stopPropagation(); promptDelete(project.id, project.name) }}
                        style={{
                          position: "absolute", top: 12, right: 12,
                          width: 28, height: 28, borderRadius: 9,
                          background: "rgba(0,0,0,0.55)",
                          backdropFilter: "blur(8px)",
                          border: "1px solid rgba(255,255,255,0.10)",
                          color: "rgba(255,255,255,0.55)",
                          cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11,

                        }}
                      >
                        <i className="bi bi-trash3" />
                      </button>
                      <div style={{ position: "absolute", bottom: 10, right: 12, display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(255,255,255,0.5)", background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.10)", padding: "4px 8px", borderRadius: 8, backdropFilter: "blur(8px)" }}>
                        <i className="bi bi-clock" style={{ fontSize: 10 }} />
                        {timeAgo(project.updated_at || project.created_at || "")}
                      </div>
                    </div>


                    <div style={{ padding: "13px 15px 15px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, letterSpacing: "-0.01em", color: "#fff", background: `linear-gradient(135deg, rgba(${accent.rgbFrom},0.22), rgba(${accent.rgbTo},0.14))`, border: `1px solid rgba(${accent.rgbFrom},0.35)`, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.10), 0 4px 12px rgba(${accent.rgbFrom},0.18)` }}>
                          {initials}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", letterSpacing: "-0.015em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                          {project.name}
                        </div>
                      </div>
                      {project.description ? (
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", lineHeight: 1.5, marginTop: 9, marginBottom: 2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {project.description}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.24)", lineHeight: 1.5, marginTop: 9, marginBottom: 2 }}>No description yet</div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10 }}>
                        <UserAvatar profile={profile} size={16} />
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                          {safeDisplayName(profile)}
                        </span>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.15)" }}>·</span>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                          <i className="bi bi-arrow-up-right" style={{ fontSize: 11 }} />
                          Open
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}


              <button
                type="button"
                className="g-add-card"
                onClick={() => setNewProjectOpen(true)}
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px dashed rgba(255,255,255,0.08)",
                  borderRadius: 14,
                  cursor: "pointer",
                  minHeight: 210,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
                  color: "rgba(255,255,255,0.2)",
                  fontFamily: "inherit",
                  transition: "all 0.24s cubic-bezier(.34,1.26,.64,1)",
                  animation: `gCardIn 0.5s cubic-bezier(0.16,1,0.3,1) ${displayed.length * 0.06}s both`,
                }}
              >
                <i className="bi bi-plus-lg" style={{ fontSize: 22 }} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>New project</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
