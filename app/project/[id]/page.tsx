"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import { supabase } from "@/lib/supabase"
import { LOCALES, useI18n } from "@/app/localization/client"
import type { Profile, Project, Message } from "@/lib/supabase"
import type { CSSProperties as Properties } from "react"
import Settings from "@/app/components/Settings"
import AdminPanel from "@/app/components/AdminPanel"
import KeySetupNim from "@/app/components/KeySetupNim"
import MechanicsCanvas, { deriveMechanics } from "@/app/components/MechanicsCanvas"
import LandingStar from "@/app/components/LandingStar"

interface PieResponse {
  ok?: boolean
  type?: "generation" | "clarification" | "chat"
  data?: {
    title: string; summary: string
    scripts: { name: string; type: string; parent: string; code: string }[]
    instances: { name: string; class: string; className: string; parent: string }[]
    notes: string[]; warnings: string[]; suggestions?: string[]; thoughts?: string[]; plan?: string[]
    thinking_steps?: string[]
    animations?: AnimData[]
    cinematics?: CinematicData[]
    audio?: AudioData[]
  }
  title?: string; summary?: string
  scripts?: { name: string; type: string; parent: string; code: string }[]
  instances?: { name: string; class: string; className: string; parent: string }[]
  notes?: string[]; warnings?: string[]; suggestions?: string[]; thoughts?: string[]; plan?: string[]
  thinking_steps?: string[]
  animations?: AnimData[]
  cinematics?: CinematicData[]
  audio?: AudioData[]
  question?: string
  options?: string[]
  message?: string
  __model: string
  __reqType?: string
  __eff_type?: string
  __taste?: { score: number; grade: string; verdict: string; weak: string[] }
  __novelty?: { score: number; coverage: number; used: number; total: number; note?: string; directive?: string }
}

type CinematicShot = {
  time?: number; duration?: number; pos?: number[]; lookAt?: number[]; fov?: number
  shake?: number; shakeFreq?: number; roll?: number; ease?: string
  cut?: boolean; orbit?: boolean; target?: string; follow?: string | boolean; targetOffset?: number[]
}
type CinematicData = {
  name?: string; description?: string; target?: string; trigger?: string; loop?: boolean; duration?: number
  shots?: CinematicShot[]
  flashes?: { time?: number; duration?: number; color?: number[]; opacity?: number }[]
  lighting?: { time?: number; duration?: number }[]
  slowmo?: { time?: number; duration?: number; timescale?: number }[]
  post?: { time?: number; effect?: string; easing?: string; hold?: boolean }[]
  bars?: { time?: number; amount?: number }[]
  vignette?: { time?: number; amount?: number }[]
  vfx?: { time?: number; kind?: string }[]
  sounds?: { time?: number; name?: string; loop?: boolean; stop?: boolean }[]
  events?: { time?: number; remote?: string }[]
}
type AnimData = { name?: string; target?: string; loop?: boolean; description?: string; duration?: number }
type AudioData = { name?: string; kind?: string; loop?: boolean; description?: string; volume?: number }

type QAPair = { question: string; answer: string }
type GenerationStep = { id: string; label: string; status: "pending" | "running" | "done" | "error" }

type LocalProject = {
  id: string
  name: string
  description?: string | null
  created_at?: string
  updated_at?: string
  place_id?: string | null
}

interface ElectronAPI {
  openRobloxStudio?: () => Promise<void>
  rojo?: {
    status: () => Promise<RojoStatus>
    start: () => Promise<RojoStatus & { ok?: boolean; error?: string }>
    stop: () => Promise<RojoStatus>
    apply: (payload: Record<string, unknown>) => Promise<{ ok: boolean; written: string[]; deleted: string[]; skipped: number; error?: string }>
    openWorkspace: () => Promise<{ ok: boolean; dir?: string; error?: string }>
  }
}

type RojoStatus = {
  installed: boolean
  version: string | null
  cli: string | null
  running: boolean
  port: number
  url: string
  workspace: string
  project: string
  error?: string | null
  log?: string[]
}

function getElectronAPI(): ElectronAPI | undefined {
  return (window as Window & { electronAPI?: ElectronAPI }).electronAPI
}

const EXPLORE_GRADS = [
  "linear-gradient(160deg,#2a1245 0%,#a31245 55%,#ff7a3d 100%)",
  "linear-gradient(160deg,#062a44 0%,#0e7cc4 55%,#8fdcf5 100%)",
  "linear-gradient(160deg,#330b33 0%,#a4128f 55%,#ff5ea8 100%)",
  "linear-gradient(160deg,#062b22 0%,#0e9c6c 55%,#cdf25e 100%)",
  "linear-gradient(160deg,#3d1c07 0%,#c46a0e 55%,#ffd45e 100%)",
  "linear-gradient(160deg,#141433 0%,#4a1da8 55%,#9d8bff 100%)",
];

function ExploreGallery({ query, onUse }: { query: string; onUse: (prompt: string, type: ProjectTypeId) => void }) {
  const q = query.trim().toLowerCase();
  const items = QUICK_STARTS.filter(qs => !q || qs.label.toLowerCase().includes(q) || qs.prompt.toLowerCase().includes(q));
  return (
    <div style={{ padding: "4px 16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
      {items.length === 0 && (
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", textAlign: "center", padding: "30px 0" }}>No prompts match “{query}”.</div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {items.map((qs, i) => (
          <button
            key={qs.label}
            type="button"
            onClick={() => onUse(qs.prompt, qs.type)}
            style={{ position: "relative", height: 150, borderRadius: 16, overflow: "hidden", background: EXPLORE_GRADS[i % EXPLORE_GRADS.length], border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", fontFamily: "inherit", textAlign: "left", padding: 0, boxShadow: "0 12px 32px rgba(0,0,0,0.4)" }}
            className="lm-explore-card"
          >
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(80% 55% at 50% 0%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0) 70%)" }} />
            <div style={{ position: "absolute", top: 12, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
              <i className={"bi " + qs.icon} style={{ fontSize: 30, color: "rgba(255,255,255,0.92)", filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.4))" }} />
            </div>
            <div style={{ position: "absolute", left: 8, right: 8, bottom: 8, background: "rgba(255,255,255,0.96)", borderRadius: 999, padding: "7px 12px", fontSize: 11.5, fontWeight: 700, color: "#101418", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {qs.label}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const STORAGE_KEY_REDUCE_MOTION  = "vexa_reduce_motion"
const STORAGE_KEY_SEND_ON_ENTER  = "vexa_send_on_enter"
const STORAGE_KEY_COMPACT_MODE   = "vexa_compact_mode"


const PROMPT_LIMIT_UNCONNECTED = 3

const MODES = [
  { id: "generate", label: "Generate", icon: "bi-stars" },
  { id: "thinking", label: "Thinking", icon: "bi-lightbulb" },
] as const
type ModeId = typeof MODES[number]["id"]

const PROJECT_TYPES = [
  { id: "scripting", label: "Scripting", icon: "bi-code-slash" },
  { id: "animation", label: "Animation", icon: "bi-person-raised-hand" },
  { id: "vfx",       label: "VFX",       icon: "bi-lightning-charge" },
  { id: "cinematic", label: "Cinematic", icon: "bi-film" },
  { id: "model3d",   label: "3D Model",  icon: "bi-box-seam" },
  { id: "sound",     label: "Sound",     icon: "bi-music-note" },
  { id: "plan",      label: "Plan",      icon: "bi-list-check" },
] as const

const QUICK_STARTS: { type: ProjectTypeId; icon: string; label: string; prompt: string }[] = [
  { type: "scripting", icon: "bi-controller",       label: "Full game kit",       prompt: "Make me a complete game: an adventure world with a collect-fight-upgrade loop, themed VFX, sound design, a signature attack animation and a cinematic trailer intro — all in one build." },
  { type: "scripting", icon: "bi-code-slash",        label: "Combat system",        prompt: "A full melee combat system with damage, cooldowns, and a hit effect on the target." },
  { type: "vfx",       icon: "bi-lightning-charge",  label: "Fire aura VFX",        prompt: "A looping fire aura VFX around a player — embers, glow, flickering flame particles." },
  { type: "model3d",   icon: "bi-box-seam",          label: "3D sword model",       prompt: "A detailed 3D sword model with a metallic blade, glowing crystal core, and a weld script." },
  { type: "animation", icon: "bi-person-raised-hand",label: "Wave animation",       prompt: "A natural waving animation with smooth keyframes for the right arm and wrist." },
  { type: "sound",     icon: "bi-music-note",        label: "Eerie dungeon audio",  prompt: "A soundscape for a dark dungeon: echoing wind, dripping water, distant footsteps and low ambient rumble, with a creepy music layer." },
  { type: "cinematic", icon: "bi-film",              label: "Anime ultimate attack", prompt: "An anime-style ultimate attack showcase: cinematic camera push-in on the charge, whip shot + hitstop on the strike, low-angle aftermath, shockwave and beam VFX, stinger sounds, all synced to one clock." },
  { type: "scripting", icon: "bi-arrow-repeat",      label: "Inventory system",     prompt: "A full inventory system with hotbar, data store saving, and item equipping." },
]
type ProjectTypeId = typeof PROJECT_TYPES[number]["id"]

const BUILDING_PROMPTS = [
  "What are we building today?", "what we cooking?", "What's the move?", "Drop the idea.",
  "Let's get to work.", "What's on the agenda?", "What are we shipping?", "What's the vision?",
  "What do you need?", "Ready when you are.", "Let's build something.", "What's the play?",
  "Got an idea? let's go.", "What are we scripting today?", "What's on your mind?",
]

const CDN = "https://glxm.cdn.troojin.com"

function getGreeting(name: string): string {
  const h = new Date().getHours(); const f = name.split(" ")[0]
  if (h >= 5  && h < 12) return "Good morning, " + f + "."
  if (h >= 12 && h < 17) return "Good afternoon, " + f + "."
  if (h >= 17 && h < 21) return "Good evening, " + f + "."
  return "It's late, " + f + ". Get some rest!"
}
function isLateHour(): boolean { const h = new Date().getHours(); return h >= 21 || h < 5 }
function getRandomPrompt() { return BUILDING_PROMPTS[Math.floor(Math.random() * BUILDING_PROMPTS.length)] }
function getRandomN<T>(arr: T[], n: number): T[] { if (arr.length <= n) return arr; return [...arr].sort(() => Math.random() - 0.5).slice(0, n) }
function stripTicks(t: string) { if (!t) return t; return t.replace(/```[\w]*/g, "").replace(/`/g, "").trim() }
function safeDisplayName(p: Profile) { return (p as FullProfile).display_name?.trim() || (p as FullProfile).username?.trim() || "User" }

function landingName(p: Profile | null): string {
  let email = ""
  try { email = (typeof window !== "undefined" && localStorage.getItem("gx_sb_email")) || "" } catch {}
  const fromEmail = email ? email.split("@")[0].replace(/[._-]+/g, " ").trim() : ""
  if (fromEmail) return fromEmail.split(" ")[0]
  return p ? safeDisplayName(p).split(" ")[0] : ""
}

function isGamePrompt(prompt: string) {
  const p = " " + (prompt || "").toLowerCase() + " "
  return /(make|build|create|crea|creami|fammi|fai|fare|costruisc|voglio)\b[\s\S]{0,40}\b(game|gioco|world|mondo|roblox)\b/.test(p)
    || /\b(blox ?fruit|obbie|obby|tycoon|simulator|simulatore|survival|horror|rpg|mmo|mmorpg|roguelike|souls ?like|fighting game|open world|sandbox|platformer)\b/.test(p)
    || /\b(game|gioco)\b[\s\S]{0,30}\b(like|tipo|stile|come|simile|ispirato|inspired)\b/.test(p)
}

function parseQA(content: string): QAPair[] | null {
  const lines = content.trim().split("\n").filter(l => l.trim())
  if (lines.length < 2 || lines.length % 2 !== 0) return null
  const pairs: QAPair[] = []
  for (let i = 0; i < lines.length; i += 2) {
    if (!lines[i].startsWith("Q: ") || !lines[i + 1]?.startsWith("A: ")) return null
    pairs.push({ question: lines[i].slice(3).trim(), answer: lines[i + 1].slice(3).trim() })
  }
  return pairs.length > 0 ? pairs : null
}

function buildQAChain(messages: Message[], beforeIndex: number): QAPair[] {
  const pairs: QAPair[] = []
  let i = beforeIndex - 1
  while (i >= 0) {
    const msg = messages[i]
    if (msg.role === "user") {
      const qa = parseQA(msg.content)
      if (qa) { pairs.unshift(...qa); i--; continue }
    } else if (msg.role === "assistant") {
      try {
        const d = JSON.parse(msg.content)
        if (d.type === "clarification") { i--; continue }
      } catch {}
    }
    break
  }
  return pairs
}

type FullProfile = Profile & {
  avatar_url?: string | null; roblox_user_id?: number | null
  display_name?: string | null; username?: string | null
  discord_id?: string | null; discord_username?: string | null; discord_avatar?: string | null
  is_admin?: boolean
}

function getAvatarUrl(p: Profile): string | null { return (p as FullProfile).avatar_url?.trim() || null }

function RobloxAvatar({ userId, size = 32 }: { userId: number; size?: number }) {
  const [url, setUrl] = useState<string | null>(null)
  const initial = String(userId).charAt(0).toUpperCase()
  useEffect(() => {
    fetch(`/api/roblox-avatar?userId=${userId}`).then(r => r.json()).then(d => { if (d.url) setUrl(d.url) }).catch(() => {})
  }, [userId])
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "1.5px solid rgba(255,255,255,0.11)" }}>
      {url ? <img src={url} width={size} height={size} alt="" style={{ objectFit: "cover", width: "100%", height: "100%", display: "block" }} />
        : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,rgba(255,255,255,0.14) 0%,rgba(255,255,255,0.06) 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.4), fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{initial}</div>}
    </div>
  )
}

function UserAvatar({ profile, size = 32 }: { profile: Profile; size?: number }) {
  const fp = profile as FullProfile
  const avatarUrl = getAvatarUrl(profile)
  const initial = safeDisplayName(profile).charAt(0).toUpperCase()
  if (fp.roblox_user_id && !avatarUrl) return <RobloxAvatar userId={fp.roblox_user_id} size={size} />
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: "1.5px solid rgba(255,255,255,0.11)", position: "relative" }}>
      {avatarUrl ? <img src={avatarUrl} width={size} height={size} alt="" style={{ objectFit: "cover", width: "100%", height: "100%", display: "block" }} />
        : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,rgba(255,255,255,0.14) 0%,rgba(255,255,255,0.06) 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.4), fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{initial}</div>}
    </div>
  )
}

function toCdnAsset(path: string) { return path.startsWith("/") ? `${CDN}${path}` : path }

function getStudioIcon(type: string, size: 16 | 32 = 16) {
  const base = toCdnAsset(size === 32 ? "/assistant/StudioIcons/32" : "/assistant/StudioIcons")
  if (!type) return `${base}/Script.png`
  const t = type.toLowerCase().replace(/\s+/g, "")
  if (t.includes("localscript"))    return `${base}/LocalScript.png`
  if (t.includes("modulescript"))   return `${base}/ModuleScript.png`
  if (t.includes("script"))         return `${base}/Script.png`
  if (t.includes("folder"))         return `${base}/Folder.png`
  if (t.includes("remoteevent"))    return `${base}/RemoteEvent.png`
  if (t.includes("remotefunction")) return `${base}/RemoteFunction.png`
  if (t.includes("screengui"))      return `${base}/ScreenGui.png`
  if (t.includes("frame"))          return `${base}/Frame.png`
  return `${base}/Script.png`
}

function prettyScriptType(type: string) {
  if (!type) return "Script"
  const t = type.toLowerCase().replace(/\s+/g, "")
  if (t.includes("localscript"))  return "LocalScript"
  if (t.includes("modulescript")) return "ModuleScript"
  return "Script"
}

const LUA_KEYWORDS = new Set(["local","function","if","then","else","elseif","end","for","while","do","repeat","until","return","break","and","or","not","in","true","false","nil","self"])
const LUA_BUILTINS = new Set(["game","workspace","script","_G","print","warn","error","pairs","ipairs","tostring","tonumber","typeof","type","table","math","string","task","wait","pcall","xpcall","setmetatable","getmetatable","require","Instance","Color3","Vector3","Vector2","UDim2","UDim","CFrame","TweenInfo","Enum","BrickColor"])
const LUA_COLORS = { keyword: "#eb7973", builtin: "#8fb4ff", string: "#8ee9b6", comment: "#6a6f81", number: "#f2ba2a", operator: "#bcbec8", identifier: "#bcbec8", text: "#bcbec8", property: "#70a0ff" }
type LuaToken = { type: keyof typeof LUA_COLORS; value: string }
function tokenizeLua(code: string): LuaToken[] {
  const tokens: LuaToken[] = []; let i = 0
  while (i < code.length) {
    if (code.slice(i, i + 2) === "--") { const end = code.indexOf("\n", i); const val = end === -1 ? code.slice(i) : code.slice(i, end); tokens.push({ type: "comment", value: val }); i += val.length; continue }
    if (code.slice(i, i + 2) === "[[") { const end = code.indexOf("]]", i + 2); const val = end === -1 ? code.slice(i) : code.slice(i, end + 2); tokens.push({ type: "string", value: val }); i += val.length; continue }
    if (code[i] === '"' || code[i] === "'") { const q = code[i]; let j = i + 1; while (j < code.length) { if (code[j] === "\\") { j += 2; continue } if (code[j] === q) { j++; break } if (code[j] === "\n") break; j++ }; tokens.push({ type: "string", value: code.slice(i, j) }); i = j; continue }
    if (/[0-9]/.test(code[i])) { let j = i; while (j < code.length && /[0-9.]/.test(code[j])) j++; tokens.push({ type: "number", value: code.slice(i, j) }); i = j; continue }
    if (/[a-zA-Z_]/.test(code[i])) { let j = i; while (j < code.length && /[a-zA-Z0-9_]/.test(code[j])) j++; const word = code.slice(i, j); const prev = tokens.slice().reverse().find(t => t.value.trim()); const isProp = prev?.value === "."; if (LUA_KEYWORDS.has(word)) tokens.push({ type: "keyword", value: word }); else if (LUA_BUILTINS.has(word)) tokens.push({ type: "builtin", value: word }); else if (isProp) tokens.push({ type: "property", value: word }); else tokens.push({ type: "identifier", value: word }); i = j; continue }
    if (/[+\-*/%^#=<>~&|(){}:;,./\[\]]/.test(code[i])) { tokens.push({ type: "operator", value: code[i] }); i++; continue }
    tokens.push({ type: "text", value: code[i] }); i++
  }
  return tokens
}
function highlightLua(code: string) {
  return tokenizeLua(code).map(({ type, value }) => {
    const esc = value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    const color = LUA_COLORS[type]
    return color ? `<span style="color:${color}${type === "comment" ? ";font-style:italic" : ""}">${esc}</span>` : esc
  }).join("")
}

const G = {
  fill: "rgba(255,255,255,0.04)", fillHover: "rgba(255,255,255,0.08)",
  border: "rgba(252,216,70,0.14)", borderHover: "rgba(252,216,70,0.35)",
  blur: "blur(20px) saturate(1.5)", blurHeavy: "blur(40px) saturate(1.8)",
  shadow: "0 4px 24px rgba(0,0,0,0.35)", shadowModal: "0 24px 80px rgba(0,0,0,0.7)",
}
const glassPill: Properties = { background: G.fill, backdropFilter: G.blur, WebkitBackdropFilter: G.blur, border: "1px solid " + G.border, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07)" }
const glassModal: Properties = { background: "rgba(8,9,12,0.98)", backdropFilter: G.blurHeavy, WebkitBackdropFilter: G.blurHeavy, border: "1px solid rgba(252,216,70,0.16)", boxShadow: ["inset 0 1px 0 rgba(255,255,255,0.08)", G.shadowModal, "0 0 60px rgba(167,139,250,0.08)"].join(", ") }

type ScriptPreviewScript = { name: string; type: string; parent: string; code: string }

function ScriptPreviewModal({ script, onClose, isMobile }: { script: ScriptPreviewScript | null; onClose: () => void; isMobile: boolean }) {
  const [copied, setCopied] = useState(false)
  const [closing, setClosing] = useState(false)
  const [prevScript, setPrevScript] = useState(script)
  const close = useCallback(() => { setClosing(true); setTimeout(() => { setClosing(false); onClose() }, 260) }, [onClose])

  if (script !== prevScript) {
    setPrevScript(script)
    if (script) {
      setClosing(false)
      setCopied(false)
    }
  }

  useEffect(() => { if (!script) return; const h = (e: KeyboardEvent) => { if (e.key === "Escape") close() }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h) }, [script, close])
  if (!script && !closing) return null
  if (!script) return null
  const copy = () => { navigator.clipboard.writeText(script.code || "").then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) }) }
  const highlighted = highlightLua(script.code || "-- (empty script)")
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: closing ? "fadeOut .26s ease forwards" : "fadeIn .18s ease forwards" }}>
      <button type="button" onClick={close} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "none", cursor: "default" }} />
      <div style={{ position: "relative", width: isMobile ? "calc(100vw - 20px)" : "min(860px, calc(100vw - 40px))", maxHeight: isMobile ? "90vh" : "85vh", background: "#0c0d12", border: "1px solid rgba(252,216,70,0.16)", borderRadius: 22, boxShadow: "0 40px 80px rgba(0,0,0,0.7), 0 0 60px rgba(167,139,250,0.06)", display: "flex", flexDirection: "column", overflow: "hidden", animation: closing ? "scaleOut .26s ease forwards" : "scaleIn .32s cubic-bezier(.16,1,.3,1) forwards" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 16px 14px", borderBottom: "1px solid rgba(252,216,70,0.10)", background: "#0c0d12", flexShrink: 0 }}>
          <img src={getStudioIcon(script.type, 32)} width={32} height={32} alt="" style={{ imageRendering: "pixelated", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#c9cbd4", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{script.name || "Unnamed"}</div>
            <div style={{ fontSize: 12, color: "#5a5e6e", marginTop: 1 }}>{prettyScriptType(script.type)}{script.parent ? " · " + script.parent : ""}</div>
          </div>
          <button type="button" onClick={copy} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", background: copied ? "rgba(78,205,196,0.12)" : "#23262f", border: copied ? "1px solid rgba(78,205,196,0.3)" : "1px solid #343945", borderRadius: 10, color: copied ? "#4ecdc4" : "#c9cbd4", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all .2s ease" }}>
            <i className={"bi " + (copied ? "bi-check-lg" : "bi-clipboard")} style={{ fontSize: 13, transition: "transform .2s cubic-bezier(.34,1.56,.64,1)", transform: copied ? "scale(1.2)" : "scale(1)" }} />{copied ? "Copied!" : "Copy"}
          </button>
          <button type="button" onClick={close} style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "#23262f", border: "1px solid #343945", borderRadius: 10, color: "#5a5e6e", cursor: "pointer", transition: "all .15s ease" }}>
            <i className="bi bi-x-lg" style={{ fontSize: 13 }} />
          </button>
        </div>
        <div style={{ display: "flex", flex: 1, overflow: "auto", fontFamily: "'Fira Mono', 'JetBrains Mono', monospace", fontSize: 13, lineHeight: 1.65, background: "#0c0d12" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", padding: "16px 12px 16px 16px", color: "#3e4252", userSelect: "none", flexShrink: 0, borderRight: "1px solid rgba(252,216,70,0.08)", minWidth: 48 }}>
            {(script.code || "").split("\n").map((_, idx) => <div key={idx} style={{ fontSize: 12, lineHeight: "1.65", color: "#3e4252" }}>{idx + 1}</div>)}
          </div>
          <pre style={{ flex: 1, padding: "16px 20px", margin: 0, whiteSpace: "pre", color: "#c9cbd4", overflow: "visible", background: "transparent" }} dangerouslySetInnerHTML={{ __html: highlighted }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "1px solid rgba(252,216,70,0.10)", flexShrink: 0, background: "#0c0d12" }}>
          <span style={{ fontSize: 12, color: "#5a5e6e", fontFamily: "monospace" }}>{(script.code || "").split("\n").length} lines</span>
        </div>
      </div>
    </div>
  )
}

function ThinkingPill({ steps }: { steps: GenerationStep[] }) {
  const running = steps.find(s => s.status === "running")
  const allDone = steps.length > 0 && steps.every(s => s.status === "done" || s.status === "error")
  const label = allDone ? "Done" : running?.label ?? steps[0]?.label ?? "Thinking…"
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 15px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(252,216,70,0.18)", borderRadius: 100, animation: "pillAppear .35s cubic-bezier(.16,1,.3,1) both", boxShadow: "0 0 24px rgba(252,216,70,0.05)" }}>
      {allDone
        ? <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, animation: "checkPop .3s cubic-bezier(.34,1.56,.64,1) both" }}><circle cx="7.5" cy="7.5" r="6.5" stroke="rgba(252,216,70,0.25)" strokeWidth="1.5" /><path d="M4.5 7.5l2 2 4-4" stroke="#fcd846" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        : <div style={{ width: 15, height: 15, borderRadius: "50%", border: "1.5px solid rgba(252,216,70,0.15)", borderTopColor: "#fcd846", animation: "spin .65s linear infinite", flexShrink: 0 }} />
      }
      <span style={{ fontSize: 13, fontWeight: 500, color: allDone ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.72)", whiteSpace: "nowrap", transition: "color .3s ease" }}>{label}</span>
    </div>
  )
}

function ReactionBar({ thumbsUp, thumbsDown, onThumbsUp, onThumbsDown, onRetry }: { thumbsUp: boolean; thumbsDown: boolean; onThumbsUp: () => void; onThumbsDown: () => void; onRetry: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)", animation: "fadeSlideUp .3s .1s cubic-bezier(.16,1,.3,1) both" }}>
      <button type="button" onClick={onThumbsUp} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", background: thumbsUp ? "rgba(255,255,255,0.07)" : "transparent", border: thumbsUp ? "1px solid rgba(255,255,255,0.14)" : "1px solid transparent", borderRadius: 8, cursor: "pointer", color: thumbsUp ? "#e8e9ec" : "rgba(255,255,255,0.32)", fontSize: 12, fontFamily: "inherit", transition: "all .18s ease" }} className="reaction-btn">
        <i className={"bi " + (thumbsUp ? "bi-hand-thumbs-up-fill" : "bi-hand-thumbs-up")} style={{ fontSize: 13, transition: "transform .2s cubic-bezier(.34,1.56,.64,1)", transform: thumbsUp ? "scale(1.2)" : "scale(1)" }} />Good
      </button>
      <button type="button" onClick={onThumbsDown} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", background: thumbsDown ? "rgba(252,100,100,0.07)" : "transparent", border: thumbsDown ? "1px solid rgba(252,100,100,0.18)" : "1px solid transparent", borderRadius: 8, cursor: "pointer", color: thumbsDown ? "#fc8181" : "rgba(255,255,255,0.32)", fontSize: 12, fontFamily: "inherit", transition: "all .18s ease" }} className="reaction-btn">
        <i className={"bi " + (thumbsDown ? "bi-hand-thumbs-down-fill" : "bi-hand-thumbs-down")} style={{ fontSize: 13, transition: "transform .2s cubic-bezier(.34,1.56,.64,1)", transform: thumbsDown ? "scale(1.15)" : "scale(1)" }} />Bad
      </button>
      <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.07)", margin: "0 3px" }} />
      <button type="button" onClick={onRetry} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", background: "transparent", border: "1px solid transparent", borderRadius: 8, cursor: "pointer", color: "rgba(255,255,255,0.32)", fontSize: 12, fontFamily: "inherit", transition: "all .18s ease" }} className="reaction-btn">
        <i className="bi bi-arrow-clockwise" style={{ fontSize: 13 }} />Retry
      </button>
    </div>
  )
}

/* ──────────────── CINEMATIC CARD — timeline visualization ──────────────── */

function CinematicTimeline({ cin }: { cin: CinematicData }) {
  const duration = Math.max(cin.duration || 8, 0.1)
  const shots = (cin.shots || []).slice().sort((a, b) => (a.time || 0) - (b.time || 0))
  const slowmo = cin.slowmo || []
  const pct = (t: number) => Math.min(100, Math.max(0, (t / duration) * 100))
  return (
    <div style={{ position: "relative", height: 58, marginTop: 10, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(167,139,250,0.05), rgba(125,211,252,0.05))" }} />
      {shots.map((s, i) => {
        const left = pct(s.time || 0)
        const w = Math.max(2, pct((s.duration || 1) + (s.time || 0)) - left)
        return (
          <div key={"s" + i} title={`shot ${i + 1} · ${(s.time || 0).toFixed(1)}s + ${(s.duration || 0).toFixed(1)}s${s.orbit ? " · orbit" : ""}${s.cut ? " · cut" : ""}`}
            style={{ position: "absolute", top: 4, left: `${left}%`, width: `${w}%`, height: 20, borderRadius: 5, background: s.cut ? "rgba(251,113,133,0.8)" : "linear-gradient(135deg, rgba(167,139,250,0.9), rgba(125,211,252,0.9))", opacity: 0.85, boxShadow: "0 0 12px rgba(167,139,250,0.25)" }} />
        )
      })}
      {slowmo.map((sm, i) => {
        const hitstop = (sm.timescale || 1) < 0.1
        return (
          <div key={"m" + i} title={`${hitstop ? "hitstop" : "slow-mo"} ${(sm.timescale || 0).toFixed(2)}x · ${(sm.time || 0).toFixed(1)}s${(sm.duration || 0).toFixed(1)}s`}
            style={{ position: "absolute", top: 27, left: `${pct(sm.time || 0)}%`, width: Math.max(3, pct((sm.duration || 0.2) + (sm.time || 0)) - pct(sm.time || 0)), height: 9, borderRadius: 4, background: hitstop ? "#fc8181" : "#fbbf24", opacity: 0.92 }} />
        )
      })}
      {((cin.vfx || []) as { time?: number; kind?: string }[]).map((v, i) => (
        <div key={"v" + i} title={`vfx ${v.kind || ""} @${(v.time || 0).toFixed(1)}s`} style={{ position: "absolute", top: 40, left: `${pct(v.time || 0)}%`, width: 3, height: 14, background: "#c084fc", transform: "translateX(-50%)", borderRadius: 2 }} />
      ))}
      {(cin.events || []).map((e, i) => (
        <div key={"e" + i} title={`event ${e.remote || ""} @${(e.time || 0).toFixed(1)}s`} style={{ position: "absolute", top: 40, left: `${pct(e.time || 0)}%`, width: 3, height: 14, background: "#fb7185", transform: "translateX(-50%)", borderRadius: 2 }} />
      ))}
      {(cin.flashes || []).map((f, i) => (
        <div key={"f" + i} title={`flash @${(f.time || 0).toFixed(1)}s`} style={{ position: "absolute", top: 40, left: `${pct(f.time || 0)}%`, width: 3, height: 14, background: "#ffffff", transform: "translateX(-50%)", borderRadius: 2 }} />
      ))}
      {(cin.sounds || []).map((sd, i) => (
        <div key={"a" + i} title={`${sd.stop ? "stop " : ""}${sd.name || "sound"} @${(sd.time || 0).toFixed(1)}s`} style={{ position: "absolute", top: 40, left: `${pct(sd.time || 0)}%`, width: 4, height: 14, background: sd.stop ? "#f87171" : "#4ecdc4", transform: "translateX(-50%)", borderRadius: 2 }} />
      ))}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", justifyContent: "space-between", padding: "0 10px 3px", fontSize: 9, color: "rgba(255,255,255,0.25)", fontVariantNumeric: "tabular-nums" }}>
        <span>0s</span><span>{(duration / 2).toFixed(1)}s</span><span>{duration.toFixed(1)}s</span>
      </div>
    </div>
  )
}

function CinematicCard({ cin, index }: { cin: CinematicData; index: number }) {
  const [open, setOpen] = useState(false)
  const shots = cin.shots || []
  const flashes = cin.flashes || []
  const slowmo = cin.slowmo || []
  const post = cin.post || []
  const vfx = cin.vfx || []
  const sounds = cin.sounds || []
  const events = cin.events || []
  const hitstops = slowmo.filter(s => (s.timescale || 1) < 0.1)
  const chips: { icon: string; label: string; color: string }[] = []
  if (shots.length) chips.push({ icon: "bi-camera-video", label: `${shots.length} shots`, color: "#a78bfa" })
  if (vfx.length) chips.push({ icon: "bi-lightning-charge-fill", label: `${vfx.length} vfx`, color: "#c084fc" })
  if (sounds.length) chips.push({ icon: "bi-soundwave", label: `${sounds.length} sounds`, color: "#4ecdc4" })
  if (slowmo.length) chips.push({ icon: "bi-stopwatch", label: `${slowmo.length} slowmo`, color: "#fbbf24" })
  if (post.length) chips.push({ icon: "bi-sliders", label: `${post.length} post`, color: "#7dd3fc" })
  if (flashes.length) chips.push({ icon: "bi-fire", label: `${flashes.length} flashes`, color: "#fc8181" })
  if (events.length) chips.push({ icon: "bi-broadcast", label: `${events.length} events`, color: "#fb7185" })
  const trigger = cin.trigger === "remote" ? "remote" : "auto"
  return (
    <div style={{ marginBottom: 14, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden", animation: `fadeSlideUp .3s ${index * 0.05}s cubic-bezier(.16,1,.3,1) both` }}>
      <button type="button" onClick={() => setOpen(v => !v)} style={{ width: "100%", display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: "inherit" }}>
        <div style={{ width: 28, height: 28, borderRadius: 9, flexShrink: 0, background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <i className="bi bi-film" style={{ fontSize: 13, color: "#c4b5fd" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#e8e9ec", letterSpacing: "-0.01em" }}>{cin.name || "Scene"}</span>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: trigger === "remote" ? "#7dd3fc" : "#fcd846", background: trigger === "remote" ? "rgba(125,211,252,0.10)" : "rgba(252,216,70,0.10)", border: `1px solid ${trigger === "remote" ? "rgba(125,211,252,0.28)" : "rgba(252,216,70,0.25)"}`, borderRadius: 6, padding: "2px 7px" }}>{trigger}</span>
            {cin.loop === true && <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#fbbf24", background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.28)", borderRadius: 6, padding: "2px 7px" }}>loop</span>}
            {hitstops.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#fc8181", background: "rgba(252,129,129,0.10)", border: "1px solid rgba(252,129,129,0.28)", borderRadius: 6, padding: "2px 7px" }}>hitstop</span>}
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontVariantNumeric: "tabular-nums" }}>{(cin.duration || 0).toFixed(1)}s</span>
            <i className={"bi " + (open ? "bi-chevron-up" : "bi-chevron-down")} style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.25)", transition: "transform .2s cubic-bezier(.34,1.56,.64,1)" }} />
          </div>
          {cin.description && <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginTop: 5 }}>{stripTicks(cin.description)}</div>}
          {chips.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9 }}>
              {chips.map((c, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 7, fontSize: 11, fontWeight: 600, color: c.color }}>
                  <i className={"bi " + c.icon} style={{ fontSize: 10 }} />{c.label}
                </span>
              ))}
            </div>
          )}
          <CinematicTimeline cin={cin} />
        </div>
      </button>
      {open && shots.length > 0 && (
        <div style={{ padding: "0 14px 13px 52px", animation: "expandDown .26s cubic-bezier(.16,1,.3,1) both" }}>
          {shots.map((s, i) => {
            const tags: string[] = []
            if (s.orbit) tags.push("orbit")
            if (s.cut) tags.push("cut")
            if (s.target || s.follow) tags.push("track " + (s.target || String(s.follow)))
            if (s.shake) tags.push("shake " + s.shake)
            if (s.roll) tags.push("roll " + s.roll + "°")
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < shots.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", fontSize: 12 }}>
                <span style={{ color: "rgba(255,255,255,0.28)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>#{i + 1}</span>
                <span style={{ color: "rgba(255,255,255,0.55)", fontVariantNumeric: "tabular-nums" }}>{s.time?.toFixed(1)}s → {(s.duration || 0).toFixed(1)}s</span>
                {s.fov != null && <span style={{ color: "rgba(255,255,255,0.4)", fontVariantNumeric: "tabular-nums" }}>fov {s.fov}</span>}
                {s.ease && <span style={{ color: "rgba(255,255,255,0.4)" }}>{s.ease}</span>}
                {tags.map((t, j) => <span key={j} style={{ color: "#c4b5fd", fontSize: 11 }}>{t}</span>)}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ──────────────── REASONING BLOCK — borderless, clean ──────────────── */

function ReasoningBlock({ thoughts, plan }: { thoughts: string[]; plan: string[] }) {
  const [open, setOpen] = useState(false)
  const hasThoughts = thoughts.length > 0
  const hasPlan     = plan.length > 0
  if (!hasThoughts && !hasPlan) return null

  const totalSteps = thoughts.length + plan.length

  return (
    <div style={{ marginBottom: 16, animation: "expandDown .38s cubic-bezier(.16,1,.3,1) both" }}>
      {/* collapsed toggle row — no box, just a subtle text button */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="reasoning-toggle"
        style={{
          display: "flex", alignItems: "center", gap: 7, width: "100%",
          padding: "6px 0", background: "transparent", border: "none",
          borderRadius: 8,
          cursor: "pointer", fontFamily: "inherit", textAlign: "left",
          outline: "none",
        }}
      >
        <i
          className={open ? "bi bi-chevron-down" : "bi bi-chevron-right"}
          style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", transition: "transform .22s cubic-bezier(.34,1.56,.64,1)", flexShrink: 0 }}
        />
        <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.28)", letterSpacing: "0.01em" }}>
          {open ? "Reasoning trace" : `Thought for ${totalSteps} step${totalSteps !== 1 ? "s" : ""}`}
        </span>
      </button>

      {/* expanded body — no box/border, just indented content */}
      {open && (
        <div style={{
          paddingLeft: 16,
          paddingTop: 8,
          animation: "expandDown .26s cubic-bezier(.16,1,.3,1) both",
        }}>
          {hasThoughts && (
            <>
              {hasPlan && (
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.18)", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 7 }}>Reasoning</div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {thoughts.map((t, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex", gap: 10, alignItems: "flex-start",
                      padding: "4px 6px", borderRadius: 6,
                      animation: `fadeSlideUp .22s ${i * 0.04}s cubic-bezier(.16,1,.3,1) both`,
                    }}
                    className="reasoning-row"
                  >
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, paddingTop: 6 }}>
                      <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.14)", flexShrink: 0 }} />
                      {i < thoughts.length - 1 && (
                        <div style={{ width: 1, flex: 1, background: "rgba(255,255,255,0.05)", marginTop: 4, minHeight: 12 }} />
                      )}
                    </div>
                    <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.38)", lineHeight: 1.65, paddingBottom: i < thoughts.length - 1 ? 8 : 0 }}>{stripTicks(t)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {hasPlan && (
            <>
              {hasThoughts && <div style={{ height: 10 }} />}
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.18)", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 8 }}>Plan</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {plan.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex", gap: 9, alignItems: "flex-start",
                      animation: `fadeSlideUp .22s ${(thoughts.length + i) * 0.04}s cubic-bezier(.16,1,.3,1) both`,
                    }}
                  >
                    {/* plain number, no box */}
                    <span style={{
                      fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.22)",
                      flexShrink: 0, minWidth: 16, paddingTop: 1, fontVariantNumeric: "tabular-nums",
                    }}>{i + 1}.</span>
                    <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.44)", lineHeight: 1.65 }}>{stripTicks(p)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ──────────────── CLARIFICATION CARD ──────────────── */

function ClarificationCard({
  question,
  options,
  onAnswer,
}: {
  question: string
  options: string[]
  onAnswer: (question: string, answer: string) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)

  const pick = (opt: string) => {
    if (selected) return
    setSelected(opt)
    onAnswer(question, opt)
  }

  return (
    <div style={{
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16,
      overflow: "hidden",
      animation: "expandDown .32s cubic-bezier(.16,1,.3,1) both",
    }}>
      {/* header strip */}
      <div style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: "11px 15px 10px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{
          width: 20, height: 20, borderRadius: 6,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.09)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <i className="bi bi-patch-question" style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Quick question
        </span>
      </div>

      {/* question text */}
      <div style={{ padding: "13px 15px 0" }}>
        <p style={{ fontSize: 14, color: "#e8e9ec", lineHeight: 1.65, margin: 0, fontWeight: 500 }}>
          {question}
        </p>
      </div>

      {/* option pills — clicking sends the message directly */}
      {options.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, padding: "12px 15px 15px" }}>
          {options.map((opt, i) => {
            const isSelected = selected === opt
            const isDisabled = selected !== null && !isSelected
            return (
              <button
                key={i}
                type="button"
                onClick={() => pick(opt)}
                disabled={!!selected}
                className={!selected ? "clarif-opt" : ""}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  padding: "7px 14px",
                  background: isSelected
                    ? "rgba(255,255,255,0.10)"
                    : "rgba(255,255,255,0.04)",
                  border: isSelected
                    ? "1px solid rgba(255,255,255,0.22)"
                    : "1px solid rgba(255,255,255,0.09)",
                  borderRadius: 100,
                  fontSize: 13, fontWeight: 500,
                  color: isDisabled ? "rgba(255,255,255,0.22)" : isSelected ? "#fff" : "rgba(255,255,255,0.65)",
                  cursor: selected ? "default" : "pointer",
                  fontFamily: "inherit",
                  opacity: isDisabled ? 0.45 : 1,
                  transition: "all .18s ease",
                  animation: `chipPop .28s ${i * 0.06}s cubic-bezier(.34,1.56,.64,1) both`,
                }}
              >
                {isSelected && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ animation: "checkPop .22s cubic-bezier(.34,1.56,.64,1) both", flexShrink: 0 }}>
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {opt}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ──────────────── PROMPT LIMIT BANNER ──────────────── */

function PromptLimitBanner({ used, limit }: { used: number; limit: number }) {
  const remaining = limit - used
  const isOut = remaining <= 0
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 15px",
      background: isOut ? "rgba(252,100,100,0.06)" : "rgba(255,184,0,0.045)",
      border: `1px solid ${isOut ? "rgba(252,100,100,0.18)" : "rgba(255,184,0,0.14)"}`,
      borderRadius: 12,
      marginBottom: 12,
      animation: "fadeSlideUp .3s cubic-bezier(.16,1,.3,1) both",
    }}>
      <i className={`bi ${isOut ? "bi-plug-fill" : "bi-lightning-charge-fill"}`} style={{ fontSize: 13, color: isOut ? "#fc8181" : "#ffc048", flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: isOut ? "#fc8181" : "#ffc048", flex: 1, lineHeight: 1.5 }}>
        {isOut
          ? "Connect Studio to keep generating — you've used your 3 free prompts."
          : `${remaining} free prompt${remaining !== 1 ? "s" : ""} left. Connect Studio to unlock unlimited.`}
      </span>
    </div>
  )
}

/* ──────────────── MESSAGE BUBBLE ──────────────── */

function MessageBubble({ msg, isMobile, qaHistory = [], onSuggestionClick, onClarificationAnswer, onRetry, onFeedback, pluginConnected, index = 0 }: {
  msg: Message; isMobile: boolean; qaHistory?: QAPair[]
  onSuggestionClick?: (s: string) => void
  onClarificationAnswer?: (question: string, answer: string) => void
  onRetry?: () => void; onFeedback?: (id: string) => void; pluginConnected?: boolean | null
  index?: number
}) {
  const [previewScript, setPreviewScript] = useState<ScriptPreviewScript | null>(null)
  const [thumbsUp, setThumbsUp] = useState(false)
  const [thumbsDown, setThumbsDown] = useState(false)
  const handleThumbsUp = () => { if (thumbsDown) setThumbsDown(false); setThumbsUp(v => !v) }
  const handleThumbsDown = () => { if (thumbsDown) return; if (thumbsUp) setThumbsUp(false); setThumbsDown(true); onFeedback?.(msg.id) }
  const staggerDelay = Math.min(index * 0.035, 0.25)

  let data: PieResponse = { __model: "" }
  try {
    const parsed = JSON.parse(msg.content)
    data = parsed.data ? { ...parsed.data, __model: parsed.__model, type: parsed.type, thinking_steps: parsed.data.thinking_steps || parsed.thinking_steps } : parsed
  } catch {
    data = { type: "chat", message: msg.content, __model: "" }
  }

  const responseType = data.type || "generation"
  const notes        = data.notes || []
  const suggestions  = data.suggestions || []
  const [displayedNotes]       = useState(() => getRandomN(notes, 3))
  const [displayedSuggestions] = useState(() => getRandomN(suggestions, 3))

  const REQ_BADGES: Record<string, { label: string; icon: string; grad: string; tint: string }> = {
    vfx:       { label: "VFX & Particles", icon: "bi-activity",        grad: "linear-gradient(135deg, #a78bfa, #fcd846)", tint: "rgba(167,139,250,0.10)" },
    model3d:   { label: "3D Model",        icon: "bi-box-seam",         grad: "linear-gradient(135deg, #fcd846, #a78bfa)", tint: "rgba(252,216,70,0.10)" },
    animation: { label: "Animation",       icon: "bi-person-arms-up",   grad: "linear-gradient(135deg, #c4b5fd, #fcd846)", tint: "rgba(196,181,253,0.10)" },
    sound:     { label: "Sound & Music",   icon: "bi-music-note-beamed", grad: "linear-gradient(135deg, #7dd3fc, #a78bfa)", tint: "rgba(125,211,252,0.10)" },
    cinematic: { label: "Cinematic",       icon: "bi-film",             grad: "linear-gradient(135deg, #c4b5fd, #7dd3fc)", tint: "rgba(196,181,253,0.10)" },
    plan:      { label: "Plan",            icon: "bi-diagram-3",        grad: "linear-gradient(135deg, #fcd846, #fcd846)", tint: "rgba(252,216,70,0.10)" },
    scripting: { label: "System",          icon: "bi-code-slash",       grad: "linear-gradient(135deg, #a78bfa, #9d8bff)", tint: "rgba(167,139,250,0.10)" },
  }
  const reqBadge = REQ_BADGES[data.__eff_type || data.__reqType || ""]

  if (msg.role === "user") {
    const qa = parseQA(msg.content)
    if (qa) {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", animation: `msgInRight .4s ${staggerDelay}s cubic-bezier(.16,1,.3,1) both` }}>
        <div style={{ maxWidth: isMobile ? "88%" : "72%", background: "#2f2e2b", border: "1px solid #3a3936", borderRadius: 14, padding: "12px 16px" }}>
            {qa.map((pair, i) => (
              <div key={i} style={{ marginBottom: i < qa.length - 1 ? 12 : 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.35)", flexShrink: 0, letterSpacing: "0.06em" }}>Q</span>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.62)", lineHeight: 1.6, fontWeight: 500 }}>{pair.question}</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginTop: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.45)", flexShrink: 0, letterSpacing: "0.06em" }}>A</span>
                  <span style={{ fontSize: 14, color: "#fff", lineHeight: 1.6, fontWeight: 600 }}>{pair.answer}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
    )
    }
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", animation: `msgInRight .4s ${staggerDelay}s cubic-bezier(.16,1,.3,1) both` }}>
        <div style={{ maxWidth: isMobile ? "88%" : "72%", background: "#2f2e2b", border: "1px solid #3a3936", borderRadius: 14, padding: "11px 16px", fontSize: 14, lineHeight: 1.65, color: "#f0efea", fontWeight: 400, wordBreak: "break-word" }}>
          {msg.content}
        </div>
      </div>
    )
  }

  /* ── CLARIFICATION ── */
  if (responseType === "clarification") {
    return (
      <div style={{ display: "flex", alignItems: "flex-start", animation: `msgInLeft .4s ${staggerDelay}s cubic-bezier(.16,1,.3,1) both` }}>
        <div style={{ flex: 1, minWidth: 0, maxWidth: isMobile ? "100%" : "82%" }}>
          <ClarificationCard
            question={data.question || ""}
            options={data.options || []}
            onAnswer={(q, a) => onClarificationAnswer?.(q, a)}
          />
          <ReactionBar thumbsUp={thumbsUp} thumbsDown={thumbsDown} onThumbsUp={handleThumbsUp} onThumbsDown={handleThumbsDown} onRetry={() => onRetry?.()} />
        </div>
      </div>
    )
  }

  /* ── CHAT ── */
  if (responseType === "chat") {
    return (
      <div style={{ display: "flex", alignItems: "flex-start", animation: `msgInLeft .4s ${staggerDelay}s cubic-bezier(.16,1,.3,1) both` }}>
        <div style={{ flex: 1, minWidth: 0, maxWidth: isMobile ? "100%" : "82%" }}>
          <p style={{ fontSize: 14.5, color: "#e7e5de", lineHeight: 1.8, margin: "0 0 4px", whiteSpace: "pre-wrap" }}>{data.message || ""}</p>
          <ReactionBar thumbsUp={thumbsUp} thumbsDown={thumbsDown} onThumbsUp={handleThumbsUp} onThumbsDown={handleThumbsDown} onRetry={() => onRetry?.()} />
        </div>
      </div>
    )
  }

  /* ── GENERATION ── */
  const scripts     = data.scripts     || []
  const instances   = data.instances   || []
  const warnings    = data.warnings    || []
  const thoughts    = data.thoughts    || []
  const plan        = data.plan        || []
  const cinematics  = data.cinematics  || []
  const animations  = data.animations  || []
  const audio       = data.audio       || []
  const isNotConnected = pluginConnected === false && scripts.length > 0
  const hasQA = qaHistory.length > 0
  const connectedBorder = "1px solid rgba(255,255,255,0.07)"

  return (
    <>
      <ScriptPreviewModal script={previewScript} onClose={() => setPreviewScript(null)} isMobile={isMobile} />
      <div style={{ display: "flex", alignItems: "flex-start", animation: `msgInLeft .4s ${staggerDelay}s cubic-bezier(.16,1,.3,1) both` }}>
        <div style={{ flex: 1, minWidth: 0, maxWidth: "100%" }}>
          {hasQA && (
            <div style={{ padding: "11px 15px", background: "rgba(255,255,255,0.02)", border: connectedBorder, borderBottom: "none", borderRadius: "14px 14px 0 0" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.20)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Context</div>
              {qaHistory.map((pair, i) => (
                <div key={i} style={{ marginBottom: i < qaHistory.length - 1 ? 9 : 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.20)", flexShrink: 0, letterSpacing: "0.05em" }}>Q</span>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.36)", lineHeight: 1.55 }}>{pair.question}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginTop: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.46)", flexShrink: 0, letterSpacing: "0.05em" }}>A</span>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.60)", lineHeight: 1.55, fontWeight: 500 }}>{pair.answer}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10, animation: "fadeSlideUp .3s cubic-bezier(.16,1,.3,1) both" }}>
            <img src="/icons/vexa-logo.svg" alt="" width={17} height={17} style={{ objectFit: "contain" }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: "0.05em" }}>VEXA</span>
          </div>
          {(() => {
            const actions = scripts.length + instances.length + animations.length + cinematics.length + audio.length;
            if (!actions) return null;
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 13, marginBottom: 14, animation: "fadeSlideUp .3s .02s cubic-bezier(.16,1,.3,1) both" }}>
                <span style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <i className="bi bi-check-lg" style={{ fontSize: 14, color: "#fff" }} />
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#fff" }}>Generation complete</span>
                  <span style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.40)", marginTop: 1 }}>{actions} action{actions !== 1 ? "s" : ""} in this build</span>
                </span>
              </div>
            );
          })()}
          <div style={hasQA ? { border: connectedBorder, borderTop: "none", borderRadius: "0 0 14px 14px", padding: "14px 15px 0" } : {}}>
            {isNotConnected && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 13px", marginBottom: 12, ...glassPill, borderRadius: 11, animation: "fadeSlideUp .3s cubic-bezier(.16,1,.3,1) both" }}>
                <i className="bi bi-plug" style={{ fontSize: 12, color: "rgba(255,255,255,0.32)" }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.42)" }}>plugin not connected — scripts generated but won&apos;t auto-insert. <a href="https://discord.vexaaai.vercel.app" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.42)", textDecoration: "underline" }}>get help</a></span>
              </div>
            )}

            <ReasoningBlock thoughts={thoughts} plan={plan} />

            {reqBadge && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, animation: "fadeSlideUp .3s .02s cubic-bezier(.16,1,.3,1) both" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 11px 4px 9px", borderRadius: 8, background: reqBadge.tint, border: "1px solid rgba(255,255,255,0.09)" }}>
                  <span style={{ width: 16, height: 16, borderRadius: 5, background: reqBadge.grad, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <i className={`bi ${reqBadge.icon}`} style={{ fontSize: 9, color: "#0a0a0c" }} />
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.03em", color: "rgba(255,255,255,0.72)", textTransform: "uppercase" }}>{reqBadge.label}</span>
                </span>
              </div>
            )}

            {data.title   && <h3 style={{ fontSize: 16, fontWeight: 700, color: "#e8e9ec", margin: "0 0 7px", letterSpacing: "-0.018em", animation: "fadeSlideUp .3s cubic-bezier(.16,1,.3,1) both" }}>{stripTicks(data.title)}</h3>}
            {data.summary && <p  style={{ fontSize: 14, color: "rgba(255,255,255,0.62)", lineHeight: 1.75, margin: "0 0 15px", animation: "fadeSlideUp .3s .05s cubic-bezier(.16,1,.3,1) both" }}>{stripTicks(data.summary)}</p>}
            {(data.__taste || data.__novelty) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 13, animation: "fadeSlideUp .3s .06s cubic-bezier(.16,1,.3,1) both" }}>
                {data.__taste && (() => {
                  const t = data.__taste
                  const color = t.score >= 80 ? "#fcd846" : t.score >= 70 ? "#fcd846" : t.score >= 60 ? "#fbbf24" : t.score >= 45 ? "#fb923c" : "#f87171"
                  return (
                    <span title={`verdict: ${t.verdict}${t.weak?.length ? " · weak axes: " + t.weak.join(", ") : ""}`} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", ...glassPill, borderRadius: 10, fontSize: 12, border: "1px solid rgba(255,255,255,0.07)" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, background: `${color}1f`, border: `1px solid ${color}44`, color, fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{t.score}</span>
                      <span style={{ lineHeight: 1.25 }}>
                        <span style={{ display: "block", color: "rgba(255,255,255,0.85)", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", fontSize: 10 }}>Taste {t.grade}</span>
                        {t.weak?.length > 0 && <span style={{ display: "block", color: "rgba(255,255,255,0.40)", fontSize: 11, marginTop: 1 }}>weak: {t.weak.join(", ")}</span>}
                      </span>
                    </span>
                  )
                })()}
                {data.__novelty && (() => {
                  const n = data.__novelty
                  const varietyColor = n.coverage >= 50 ? "#4ecdc4" : "#fbbf24"
                  return (
                    <span title={n.directive || n.note || ""} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", ...glassPill, borderRadius: 10, fontSize: 12, border: "1px solid rgba(255,255,255,0.07)" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, background: `${varietyColor}1f`, border: `1px solid ${varietyColor}44`, color: varietyColor, fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                        <i className="bi bi-stars" style={{ fontSize: 13 }} />
                      </span>
                      <span style={{ lineHeight: 1.25 }}>
                        <span style={{ display: "block", color: "rgba(255,255,255,0.85)", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", fontSize: 10 }}>Novelty</span>
                        <span style={{ display: "block", color: "rgba(255,255,255,0.40)", fontSize: 11, marginTop: 1 }}>{typeof n.used === "number" ? `${n.used}/${n.total} mechanic families` : n.note || "—"}</span>
                      </span>
                    </span>
                  )
                })()}
              </div>
            )}
            {!!warnings.length && (
              <div style={{ padding: "11px 14px", background: "rgba(255,184,0,0.045)", border: "1px solid rgba(255,184,0,0.14)", borderRadius: 11, marginBottom: 13, animation: "fadeSlideUp .3s cubic-bezier(.16,1,.3,1) both" }}>
                {warnings.map((w, i) => <p key={i} style={{ fontSize: 13, color: "#ffc048", margin: 0 }}><i className="bi bi-exclamation-triangle" style={{ marginRight: 7 }} />{stripTicks(w)}</p>)}
              </div>
            )}
            {!!cinematics.length && (
              <div style={{ marginBottom: 14, animation: "fadeSlideUp .3s .08s cubic-bezier(.16,1,.3,1) both" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 9 }}>Cinematics ({cinematics.length})</div>
                {cinematics.map((cin, i) => <CinematicCard key={i} cin={cin} index={i} />)}
              </div>
            )}
            {!!animations.length && (
              <div style={{ marginBottom: 14, animation: "fadeSlideUp .3s .08s cubic-bezier(.16,1,.3,1) both" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 9 }}>Animations ({animations.length})</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {animations.map((a, i) => (
                    <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px", ...glassPill, borderRadius: 9, fontSize: 12, animation: `chipPop .3s ${i * 0.05}s cubic-bezier(.34,1.56,.64,1) both` }}>
                      <i className="bi bi-person-arms-up" style={{ fontSize: 12, color: "#c4b5fd" }} />
                      <span style={{ color: "#c9cbd4" }}>{a.name || "Unnamed"}</span>
                      <span style={{ color: "rgba(255,255,255,0.28)", fontSize: 11 }}>{a.loop === true ? "loop" : "once"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!!audio.length && (
              <div style={{ marginBottom: 14, animation: "fadeSlideUp .3s .08s cubic-bezier(.16,1,.3,1) both" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 9 }}>Audio ({audio.length})</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {audio.map((a, i) => (
                    <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px", ...glassPill, borderRadius: 9, fontSize: 12, animation: `chipPop .3s ${i * 0.05}s cubic-bezier(.34,1.56,.64,1) both` }}>
                      <i className="bi bi-music-note-beamed" style={{ fontSize: 12, color: "#4ecdc4" }} />
                      <span style={{ color: "#c9cbd4" }}>{a.name || "Unnamed"}</span>
                      <span style={{ color: "rgba(255,255,255,0.28)", fontSize: 11 }}>{a.kind || "sfx"}{a.loop === true ? " · loop" : ""}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!!instances.length && (
              <div style={{ marginBottom: 14, animation: "fadeSlideUp .3s .08s cubic-bezier(.16,1,.3,1) both" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 9 }}>Instances ({instances.length})</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {instances.map((inst, i) => (
                    <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px", ...glassPill, borderRadius: 9, fontSize: 12, animation: `chipPop .3s ${i * 0.05}s cubic-bezier(.34,1.56,.64,1) both` }}>
                      <img src={getStudioIcon(inst.class || inst.className)} width={14} height={14} alt="" style={{ imageRendering: "pixelated", flexShrink: 0 }} />
                      <span style={{ color: "#c9cbd4" }}>{inst.name || "Unnamed"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!!scripts.length && (
              <div style={{ marginBottom: 14, animation: "fadeSlideUp .3s .10s cubic-bezier(.16,1,.3,1) both" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 9 }}>Scripts ({scripts.length})</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {scripts.map((s, i) => (
                    <button key={i} type="button" onClick={() => setPreviewScript(s)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px", ...glassPill, borderRadius: 9, fontSize: 12, cursor: "pointer", border: "1px solid rgba(255,255,255,0.09)", animation: `chipPop .32s ${i * 0.06}s cubic-bezier(.34,1.56,.64,1) both` }} className="script-chip">
                      <img src={getStudioIcon(s.type)} width={14} height={14} alt="" style={{ imageRendering: "pixelated", flexShrink: 0 }} />
                      <span style={{ color: "#c9cbd4" }}>{s.name || "Unnamed"}</span>
                      <span style={{ color: "rgba(255,255,255,0.28)", fontSize: 11 }}>{prettyScriptType(s.type)}</span>
                      <i className="bi bi-code-slash" style={{ fontSize: 11, opacity: 0.35 }} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!!displayedNotes.length && (
              <div style={{ marginBottom: 14, animation: "fadeSlideUp .3s .12s cubic-bezier(.16,1,.3,1) both" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 9 }}>What changed:</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {displayedNotes.map((n, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13.5, color: "rgba(255,255,255,0.82)", lineHeight: 1.6, animation: `fadeSlideUp .28s ${i * 0.07}s cubic-bezier(.16,1,.3,1) both` }}>
                      <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#4ade80", flexShrink: 0, marginTop: 6, boxShadow: "0 0 8px rgba(74,222,128,0.6)" }} />
                      <span>{stripTicks(n)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!!displayedSuggestions.length && (
              <div style={{ marginBottom: 14, animation: "fadeSlideUp .3s .15s cubic-bezier(.16,1,.3,1) both" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 9 }}>
                  <i className="bi bi-stars" style={{ fontSize: 14, color: "#fcd846" }} />Smart Suggestions
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {displayedSuggestions.map((s, i) => (
                    <button key={i} type="button" onClick={() => onSuggestionClick?.(s)} className="lm-quest-row" style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", background: i === 0 ? "rgba(125,211,252,0.06)" : "rgba(255,255,255,0.03)", border: i === 0 ? "1px solid rgba(125,211,252,0.35)" : "1px solid rgba(255,255,255,0.10)", borderRadius: 13, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "rgba(255,255,255,0.85)", fontFamily: "inherit", textAlign: "left", transition: "all .18s ease", animation: `chipPop .3s ${i * 0.06}s cubic-bezier(.34,1.56,.64,1) both` }}>
                      <span style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <i className="bi bi-lightning-charge-fill" style={{ fontSize: 14, color: "rgba(255,255,255,0.75)" }} />
                      </span>
                      <span style={{ flex: 1, lineHeight: 1.45, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{stripTicks(s)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {hasQA && <div style={{ height: 14 }} />}
          </div>
          <ReactionBar thumbsUp={thumbsUp} thumbsDown={thumbsDown} onThumbsUp={handleThumbsUp} onThumbsDown={handleThumbsDown} onRetry={() => onRetry?.()} />
        </div>
      </div>

    </>
  )
}

/* ──────────────── FEEDBACK MODAL ──────────────── */

function FeedbackModal({ open, onClose, onSubmit, sending, isMobile }: { open: boolean; onClose: () => void; onSubmit: (text: string) => Promise<boolean>; sending: boolean; isMobile: boolean }) {
  const [text, setText] = useState(""); const [submitted, setSubmitted] = useState(false); const [closing, setClosing] = useState(false)
  const [prevOpen, setPrevOpen] = useState(open)
  const close = () => { setClosing(true); setTimeout(() => { setClosing(false); onClose() }, 220) }

  if (open !== prevOpen) {
    setPrevOpen(open)
    if (!open) {
      setText("")
      setSubmitted(false)
      setClosing(false)
    }
  }

  if (!open && !closing) return null
  const submit = async () => { if (!text.trim() || sending) return; const ok = await onSubmit(text.trim()); if (ok) { setSubmitted(true); setTimeout(close, 1800) } }
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: closing ? "fadeOut .22s ease forwards" : "fadeIn .18s ease forwards" }}>
      <button type="button" onClick={close} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.68)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "none", cursor: "default" }} />
      <div style={{ position: "relative", width: isMobile ? "calc(100vw - 24px)" : "min(420px, calc(100vw - 40px))", ...glassModal, borderRadius: 22, overflow: "hidden", animation: closing ? "scaleOut .22s ease forwards" : "scaleIn .28s cubic-bezier(.16,1,.3,1) forwards" }}>
        {submitted ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", ...glassPill, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", animation: "checkPop .4s cubic-bezier(.34,1.56,.64,1) both" }}><i className="bi bi-check-lg" style={{ fontSize: 24 }} /></div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", animation: "fadeSlideUp .3s .1s cubic-bezier(.16,1,.3,1) both" }}>Feedback sent</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", marginTop: 4, animation: "fadeSlideUp .3s .15s cubic-bezier(.16,1,.3,1) both" }}>thanks, we&apos;ll look into it.</div>
          </div>
        ) : (
          <>
            <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div><div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Leave feedback</div><div style={{ fontSize: 13, color: "rgba(255,255,255,0.32)", marginTop: 2 }}>What went wrong?</div></div>
              <button type="button" onClick={close} style={{ width: 28, height: 28, borderRadius: 8, ...glassPill, border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.38)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, transition: "all .18s ease" }}><i className="bi bi-x-lg" /></button>
            </div>
            <div style={{ padding: 20 }}>
              <textarea value={text} onChange={e => setText(e.target.value.slice(0, 500))} placeholder="The response was off because…" rows={4} autoFocus style={{ width: "100%", background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 11, padding: "10px 13px", fontSize: 14, color: "#e8e9ec", outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.55, boxSizing: "border-box" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.28)" }}>{text.length}/500</span>
                <button type="button" onClick={submit} disabled={sending || !text.trim()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: text.trim() && !sending ? "linear-gradient(135deg, #fcd846 0%, #fcd846 50%, #ffe98a 100%)" : "rgba(255,255,255,0.07)", color: text.trim() && !sending ? "#060810" : "rgba(255,255,255,0.25)", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: text.trim() && !sending ? "pointer" : "not-allowed", fontFamily: "inherit", boxShadow: text.trim() && !sending ? "0 4px 16px rgba(252,216,70,0.35)" : "none", transition: "all .18s ease" }}>
                  {sending ? <div style={{ width: 13, height: 13, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.2)", borderTopColor: "#060810", animation: "spin .7s linear infinite" }} /> : <><i className="bi bi-send" style={{ fontSize: 12 }} />Send</>}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "center", paddingTop: 4, animation: "fadeSlideUp .28s cubic-bezier(.16,1,.3,1) both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "9px 13px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(252,216,70,0.18)", borderRadius: 100, boxShadow: "0 0 20px rgba(252,216,70,0.05)" }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i === 1 ? "#a78bfa" : "#fcd846", animation: "typingDot 1.2s ease-in-out infinite", animationDelay: i * 0.18 + "s" }} />)}
      </div>
    </div>
  )
}

/* ──────────────── ROJO CONNECT MODAL ──────────────── */

function ProjectConnectModal({ open, onClose, onConnected }: {
  open: boolean; onClose: () => void; onConnected?: (token: string) => void
}) {
  const [closing, setClosing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(true)
  const [noApi, setNoApi] = useState(false)
  const [status, setStatus] = useState<RojoStatus | null>(null)

  const close = useCallback(() => { setClosing(true); setTimeout(() => { setClosing(false); onClose(); }, 220) }, [onClose])
  useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => { if (e.key === "Escape") close() }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h) }, [close, open])

  const refresh = useCallback(async () => {
    const api = getElectronAPI()?.rojo
    if (!api) { setNoApi(true); setChecking(false); return }
    setNoApi(false); setChecking(true)
    try {
      const s = await api.status()
      setStatus(s || null)
      if (s?.running) onConnected?.("gx-rojo")
    } catch { setStatus(null) }
    finally { setChecking(false) }
  }, [onConnected])

  useEffect(() => { if (!open) return; setClosing(false); setStatus(null); setChecking(true); refresh() }, [open, refresh])
  useEffect(() => { if (!open || !status?.running) return; const iv = setInterval(refresh, 8000); return () => clearInterval(iv) }, [open, status?.running, refresh])

  const start = async () => {
    const api = getElectronAPI()?.rojo
    if (!api) return
    setBusy(true)
    try { const s = await api.start(); setStatus(s || null); if (s?.running) onConnected?.("gx-rojo") }
    catch {}
    finally { setBusy(false) }
  }
  const stop = async () => {
    const api = getElectronAPI()?.rojo
    if (!api) return
    setBusy(true)
    try { setStatus(await api.stop()) }
    catch {}
    finally { setBusy(false) }
  }
  const openFolder = async () => { try { await getElectronAPI()?.rojo?.openWorkspace() } catch {} }

  if (!open && !closing) return null

  const running = !!status?.running
  const installed = !!status?.installed
  const dot = running ? "#4ade80" : installed ? "#f59e0b" : "#3f3f46"
  const heading = noApi ? "Solo nell'app desktop" : running ? "Rojo in esecuzione" : installed ? "Rojo installato · non avviato" : "Rojo non installato"
  const detail = noApi
    ? "Rojo gira sul tuo PC e si avvia dall'app Vexa desktop. Apri Vexa (non il sito) per collegarlo a Studio."
    : running
      ? `Server locale su ${status?.url}. In Studio apri il plugin Rojo, premi Connect e inserisci questo indirizzo: i file generati compaiono nel progetto.`
      : installed
        ? `Rojo ${status?.version ? status.version + " " : ""}rilevato. Premi “Avvia Rojo” per aprire il server locale sulla porta ${status?.port ?? 34872}.`
        : "Installa Rojo con aftman/rokit oppure da rojo.space, poi premi “Re-check”. Vexa lo rileva da solo."

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: closing ? "fadeOut .22s ease forwards" : "fadeIn .18s ease forwards" }}>
      <button type="button" onClick={close} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.62)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "none", cursor: "default" }} />
      <div style={{ position: "relative", width: "min(460px,calc(100vw - 32px))", background: "rgba(14,14,16,0.97)", backdropFilter: "blur(40px) saturate(1.8)", border: "1px solid rgba(255,255,255,0.11)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 16px 64px rgba(0,0,0,0.6)", borderRadius: 22, overflow: "hidden", animation: closing ? "scaleOut .22s ease forwards" : "scaleIn .3s cubic-bezier(.16,1,.3,1) forwards" }}>
        <div style={{ padding: "22px 22px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>Connetti a Rojo</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.35)", marginTop: 3 }}>Sincronizzazione ufficiale con Roblox Studio</div>
          </div>
          <button type="button" onClick={close} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,.4)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div style={{ padding: "22px 22px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
          {checking ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "rgba(255,255,255,.45)", fontSize: 13 }}>
              <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,.1)", borderTopColor: "rgba(255,255,255,.6)", animation: "spin .7s linear infinite" }} />
              Cerco Rojo…
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: dot, flexShrink: 0, boxShadow: running ? "0 0 8px rgba(74,222,128,0.6)" : "none" }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: running ? "#4ade80" : installed ? "#f59e0b" : "rgba(255,255,255,.55)" }}>{heading}</span>
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)", lineHeight: 1.55 }}>{detail}</div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", fontSize: 12.5, color: "rgba(255,255,255,.6)", lineHeight: 1.6 }}>
                <span><b style={{ color: "#fff" }}>1.</b> Premi <b style={{ color: "#fcd846" }}>Avvia Rojo</b>: parte il server locale.</span>
                <span><b style={{ color: "#fff" }}>2.</b> In Studio installa il plugin <b style={{ color: "#fff" }}>Rojo</b> e premi Connect.</span>
                <span><b style={{ color: "#fff" }}>3.</b> Indirizzo <b style={{ color: "#fff" }}>{status?.url ?? "localhost:34872"}</b> — i file generati si sincronizzano.</span>
              </div>

              {status?.workspace && (
                <button type="button" onClick={openFolder} title={status.workspace} style={{ background: "none", border: "none", padding: 0, textAlign: "left", fontFamily: "inherit", fontSize: 11.5, color: "rgba(255,255,255,.32)", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  Cartella progetto: {status.workspace}
                </button>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                {running ? (
                  <button type="button" disabled={busy} onClick={stop} style={{ flex: 1, padding: "12px 20px", background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,.85)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: busy ? "default" : "pointer", fontFamily: "inherit" }}>
                    Ferma Rojo
                  </button>
                ) : (
                  <button type="button" disabled={busy || noApi} onClick={installed ? start : refresh} style={{ flex: 1, padding: "12px 20px", background: installed && !noApi ? "linear-gradient(135deg, #fcd846 0%, #fcd846 50%, #ffe98a 100%)" : "rgba(255,255,255,0.07)", color: installed && !noApi ? "#060810" : "rgba(255,255,255,.75)", border: installed && !noApi ? "none" : "1px solid rgba(255,255,255,0.12)", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: busy || noApi ? "default" : "pointer", fontFamily: "inherit", boxShadow: installed && !noApi ? "0 4px 20px rgba(252,216,70,0.35)" : "none", transition: "all .18s ease" }}>
                    {busy ? "Avvio…" : installed ? "Avvia Rojo" : "Re-check"}
                  </button>
                )}
                <button type="button" onClick={running || busy ? refresh : close} style={{ padding: "12px 20px", background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,.8)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  {running || busy ? "Re-check" : "Chiudi"}
                </button>
              </div>

              {status?.error && (
                <div style={{ fontSize: 12, color: "#fca5a5", lineHeight: 1.5 }}>{status.error}</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ──────────────── MAIN PAGE ──────────────── */

export default function ProjectChatPage() {
  const { locale, setLocale } = useI18n()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const projectId = params?.id

  const [profile,           setProfile]           = useState<Profile | null>(null)
  const [project,           setProject]           = useState<Project | null>(null)
  const [messages,          setMessages]          = useState<Message[]>([])
  const mechStats = useMemo(() => deriveMechanics(messages), [messages])
  const [prompt,            setPrompt]            = useState("")
  const [loading,           setLoading]           = useState(false)
  const [repairing,         setRepairing]         = useState(false)
  const [loadingMsgs,       setLoadingMsgs]       = useState(true)
  const [isMobile,          setIsMobile]          = useState(false)
  const [sideProjects,      setSideProjects]      = useState<LocalProject[]>([])
  const [generationSteps,   setGenerationSteps]   = useState<GenerationStep[]>([])
  const [mode,              setMode]              = useState<ModeId>("generate")
  const [edView,            setEdView]            = useState<"agent" | "explore">("agent")
  const [exploreQuery,      setExploreQuery]      = useState("")
  const [edModel,           setEdModel]           = useState(() => {
    try {
      const s = window.localStorage.getItem("gx_model") || "";
      return s === "hunyuan3d-2.1" || s === "local/qwen3-8b" ? s : "vexa-team";
    } catch { return "vexa-team"; }
  })
  const [edModelOpen,       setEdModelOpen]       = useState(false)
  const [edHunyuanAlive,    setEdHunyuanAlive]    = useState(false)
  const [modeMenuOpen,      setModeMenuOpen]      = useState(false)
  const [projectType,       setProjectType]       = useState<ProjectTypeId>("scripting")
  const [typeMenuOpen,      setTypeMenuOpen]      = useState(false)
  const [feedbackOpen,      setFeedbackOpen]      = useState(false)
  const [feedbackMsgId,     setFeedbackMsgId]     = useState<string | null>(null)
  const [feedbackSending,   setFeedbackSending]   = useState(false)
  const [profileMenuOpen,   setProfileMenuOpen]   = useState(false)
  const [settingsOpen,      setSettingsOpen]      = useState(false)
  const [adminOpen,         setAdminOpen]         = useState(false)
  const [pluginConnected,   setPluginConnected]   = useState<boolean | null>(null)
  const [lastPayload,       setLastPayload]       = useState<Record<string, unknown> | null>(null)
  const [datamodelSnapshot, setDatamodelSnapshot] = useState<Record<string, string[]>>({})
  const [gameModelJson,     setGameModelJson]     = useState<string | null>(null)
  const [stopping,          setStopping]          = useState(false)
  const [lastUserPrompt,    setLastUserPrompt]    = useState("")
  const [sendBtnBounce,     setSendBtnBounce]     = useState(false)
  const [inputFocused,      setInputFocused]      = useState(false)
  const [planHovered,       setPlanHovered]       = useState(false)
  const [promptUsed,        setPromptUsed]        = useState(0)
  const [autoStartPrompt,   setAutoStartPrompt]   = useState("")
  const [projMenuOpen,      setProjMenuOpen]      = useState(false)

  const [reduceMotion, setReduceMotion] = useState(() => typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY_REDUCE_MOTION) === "true" : false)
  const [sendOnEnter,  setSendOnEnter]  = useState(() => { if (typeof window === "undefined") return true; const s = window.localStorage.getItem(STORAGE_KEY_SEND_ON_ENTER); return s !== null ? s === "true" : true })
  const [compactMode,  setCompactMode]  = useState(() => typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY_COMPACT_MODE) === "true" : false)
  const [buildingPrompt] = useState(() => getRandomPrompt())

  const lateHour = useMemo(() => isLateHour(), [])

  const [shakeSend,         setShakeSend]         = useState(false)
  const [attachedImages, setAttachedImages] = useState<{ name: string; data: string; preview: string }[]>([])
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; content: string }[]>([])
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [isLocal, setIsLocal] = useState(false)
  const [accountId, setAccountId] = useState(() => typeof window !== "undefined" ? localStorage.getItem("gx_sb_user_id") || "" : "")
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [autoConnectPrompted, setAutoConnectPrompted] = useState(false)

  const bottomRef      = useRef<HTMLDivElement>(null)
  const scrollRef       = useRef<HTMLDivElement>(null)
  const textareaRef    = useRef<HTMLTextAreaElement>(null)
  const abortRef       = useRef<AbortController | null>(null)
  const modeMenuRef    = useRef<HTMLDivElement>(null)
  const typeMenuRef    = useRef<HTMLDivElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const attachMenuRef = useRef<HTMLDivElement>(null)
  const projMenuRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileOnlyRef = useRef<HTMLInputElement>(null)
  const prevMsgCountRef = useRef(0)
  const autoStartedRef = useRef(false)

  // Derived: is this user over the free prompt limit?
  const isOverLimit = pluginConnected === false && promptUsed >= PROMPT_LIMIT_UNCONNECTED
  const showLimitBanner = pluginConnected === false && promptUsed > 0

  // Local mode helpers: localStorage for messages when no Supabase auth
  const getLocalMessages = (pid: string): Message[] => {
    try { return JSON.parse(localStorage.getItem(`gx_msgs_${pid}`) || "[]") } catch { return [] }
  }
  const saveLocalMessages = (pid: string, msgs: Message[]) => {
    localStorage.setItem(`gx_msgs_${pid}`, JSON.stringify(msgs))
  }
  const getLocalProjectsKey = () => {
    const uid = localStorage.getItem("gx_sb_user_id")
    return uid ? `gx_projects_${uid}` : ""
  }

  useEffect(() => {
    if (!projectId) return
    setLoadingMsgs(true)
    setMessages([])
    setAutoStartPrompt("")
    autoStartedRef.current = false

    const load = async () => {
      // Check if this is a local project (stored in localStorage from /local dashboard)
      try {
        const localProjects = JSON.parse(localStorage.getItem(getLocalProjectsKey()) || "[]") as LocalProject[]
        const localProject = localProjects.find((p) => p.id === projectId)
        if (localProject) {
          setIsLocal(true)
          let localAdmin = false;
          try {
            const users = JSON.parse(localStorage.getItem("gx_local_users") || "[]") as { id: string; is_admin?: boolean }[];
            localAdmin = !!users.find((x) => x.id === localStorage.getItem("gx_sb_user_id") && x.is_admin);
          } catch {}
          const mockProfile: Profile = { id: "local-user", username: "local", display_name: localProject.name || "User", avatar_url: null, roblox_user_id: null, open_cloud_api_key: null, discord_id: null, discord_username: null, discord_avatar: null, is_admin: localAdmin, created_at: localProject.created_at || new Date().toISOString() }
          setProfile(mockProfile)
          setProject({ id: localProject.id, user_id: "local-user", name: localProject.name, description: localProject.description || null, created_at: localProject.created_at || new Date().toISOString(), updated_at: localProject.updated_at || new Date().toISOString(), place_id: localProject.place_id ? Number(localProject.place_id) : null })
          setMessages(getLocalMessages(projectId))
          try {
            const flag = `gx_autostart_${projectId}`
            if (localStorage.getItem(flag)) {
              localStorage.removeItem(flag)
              if (localProject.description) setAutoStartPrompt(localProject.description)
            }
          } catch {}
          setLoadingMsgs(false)
          if (typeof window !== "undefined" && getElectronAPI()?.openRobloxStudio) {
            getElectronAPI()?.openRobloxStudio?.()
          }
          return
        }
      } catch {}

      // Local accounts never see projects from another account
      if (localStorage.getItem("gx_sb_user_id")) { router.replace("/local"); return }

      // Supabase auth mode
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace("/auth/login"); return }
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).single()
      if (!prof) { router.replace("/auth/login"); return }
      setProfile(prof as Profile)
      const { data: proj } = await supabase.from("projects").select("*").eq("id", projectId).eq("user_id", session.user.id).single()
      if (!proj) { router.replace("/"); return }
      setProject(proj as Project)
      const { data: msgs } = await supabase.from("messages").select("*").eq("project_id", projectId).order("created_at", { ascending: true })
      setMessages((msgs || []) as Message[])
      setLoadingMsgs(false)

      const { data: usage } = await supabase
        .from("prompt_usage")
        .select("used_count")
        .eq("user_id", session.user.id)
        .single()
      if (usage) setPromptUsed(usage.used_count || 0)
    }
    load()
  }, [projectId, router, accountId])

  useEffect(() => {
    const sync = () => {
      const uid = localStorage.getItem("gx_sb_user_id") || ""
      setAccountId((prev) => (prev === uid ? prev : uid))
    }
    window.addEventListener("storage", sync)
    window.addEventListener("focus", sync)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("focus", sync)
    }
  }, [])

  const greetingText = useMemo(() => profile ? getGreeting(safeDisplayName(profile)) : getGreeting("there"), [profile])
  useEffect(() => {
    if (!isLocal) return
    try {
      const list = JSON.parse(localStorage.getItem(getLocalProjectsKey()) || "[]") as LocalProject[]
      setSideProjects(Array.isArray(list) ? list : [])
    } catch {}
  }, [isLocal, projectId, messages.length, accountId])

  const sideName = useMemo(() => {
    try {
      const em = localStorage.getItem("gx_sb_email") || ""
      const n = em.split("@")[0]
      if (n) return n
    } catch {}
    return profile ? safeDisplayName(profile) : "User"
  }, [profile, accountId])

  const startNewChat = () => {
    if (!isLocal) { router.push("/"); return }
    try {
      const key = getLocalProjectsKey()
      const list = key ? JSON.parse(localStorage.getItem(key) || "[]") as LocalProject[] : []
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
      const now = new Date().toISOString()
      const proj: LocalProject = { id, name: "Nuova chat", description: "", created_at: now, updated_at: now } as LocalProject
      if (key) localStorage.setItem(key, JSON.stringify([proj, ...list]))
      setSideProjects([proj, ...list])
      router.push(`/project/${id}`)
    } catch { router.push("/local") }
  }
  const isAdmin = !!(profile as FullProfile | null)?.is_admin

  const applyQuickStart = (qs: typeof QUICK_STARTS[number]) => {
    setProjectType(qs.type)
    setPrompt(qs.prompt)
    setEdView("agent")
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  useEffect(() => {
    let dead = false
    fetch("/models", { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        if (dead) return
        const alive = Array.isArray(d.models) && d.models.some((m: { id: string }) => m.id === "hunyuan3d-2.1")
        setEdHunyuanAlive(!!alive || !!d?.backends?.hunyuan3d)
      })
      .catch(() => {})
    return () => { dead = true }
  }, [])

  const pickEdModel = (id: string) => {
    setEdModel(id)
    try { window.localStorage.setItem("gx_model", id) } catch {}
    setEdModelOpen(false)
  }

  const scrollToMsg = (idx: number) => {
    setEdView("agent")
    requestAnimationFrame(() => {
      document.getElementById(`vxm-${idx}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
    })
  }

  useEffect(() => { const sync = () => setIsMobile(window.innerWidth < 768); sync(); window.addEventListener("resize", sync); return () => window.removeEventListener("resize", sync) }, [])
  useEffect(() => { if (typeof window === "undefined") return; window.localStorage.setItem(STORAGE_KEY_REDUCE_MOTION, String(reduceMotion)); document.documentElement.style.setProperty("--motion-duration", reduceMotion ? "0ms" : "200ms") }, [reduceMotion])
  useEffect(() => { if (typeof window === "undefined") return; window.localStorage.setItem(STORAGE_KEY_SEND_ON_ENTER, String(sendOnEnter)) }, [sendOnEnter])
  useEffect(() => { if (typeof window === "undefined") return; window.localStorage.setItem(STORAGE_KEY_COMPACT_MODE, String(compactMode)); document.documentElement.style.setProperty("--compact-gap", compactMode ? "14px" : "28px") }, [compactMode])
  const isNearBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }, [])

  useEffect(() => {
    const grew = messages.length > prevMsgCountRef.current
    prevMsgCountRef.current = messages.length
    if (isNearBottom() || !grew) {
      bottomRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" })
    }
  }, [messages, loading, generationSteps, isNearBottom, reduceMotion])

  useEffect(() => { const el = textareaRef.current; if (!el) return; el.style.height = "0px"; el.style.height = Math.min(Math.max(el.scrollHeight, isMobile ? 40 : 44), isMobile ? 110 : 160) + "px" }, [prompt, isMobile])

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      const api = getElectronAPI()?.rojo
      if (!api) { if (!cancelled) setPluginConnected(false); return }
      try {
        const s = await api.status()
        if (!cancelled) setPluginConnected(!!s?.running)
      } catch { if (!cancelled) setPluginConnected(prev => prev === null ? false : prev) }
    }
    check(); const iv = setInterval(check, 15000); return () => { cancelled = true; clearInterval(iv) }
  }, [])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (modeMenuRef.current    && !modeMenuRef.current.contains(e.target as Node))    setModeMenuOpen(false)
      if (typeMenuRef.current    && !typeMenuRef.current.contains(e.target as Node))    setTypeMenuOpen(false)
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) setProfileMenuOpen(false)
      if (attachMenuRef.current  && !attachMenuRef.current.contains(e.target as Node))  setShowAttachMenu(false)
      if (projMenuRef.current    && !projMenuRef.current.contains(e.target as Node))    setProjMenuOpen(false)
    }
    if (modeMenuOpen || typeMenuOpen || profileMenuOpen || showAttachMenu || projMenuOpen) document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [modeMenuOpen, typeMenuOpen, profileMenuOpen, showAttachMenu, projMenuOpen])

  const hiddenIndices = useMemo(() => {
    const hidden = new Set<number>()
    messages.forEach((msg, idx) => {
      if (msg.role !== "assistant") return
      try {
        const d = JSON.parse(msg.content)
        if (d.type && d.type !== "generation") return
        let i = idx - 1
        while (i >= 0) {
          const prev = messages[i]
          if (prev.role === "user" && parseQA(prev.content)) { hidden.add(i); i--; continue }
          if (prev.role === "assistant") {
            try { const pd = JSON.parse(prev.content); if (pd.type === "clarification") { hidden.add(i); i--; continue } } catch {}
          }
          break
        }
      } catch {}
    })
    return hidden
  }, [messages])

  const animateSteps = (steps: GenerationStep[]): { finish: () => void } => {
    const stepMs = Math.max(600, Math.min(1600, 4000 / steps.length))
    let i = 0; let finished = false
    const tick = () => {
      if (finished || i >= steps.length) return
      setGenerationSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: "running" } : s))
      if (i < steps.length - 1) setTimeout(() => {
        if (finished) return
        setGenerationSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: "done" } : s))
        i++; tick()
      }, stepMs)
    }
    tick()
    return { finish: () => { finished = true; setGenerationSteps(prev => prev.map(s => ({ ...s, status: "done" as const }))) } }
  }

  // Increment prompt_usage in Supabase
  const incrementPromptUsage = async () => {
    if (!profile) return
    const newCount = promptUsed + 1
    setPromptUsed(newCount)
    if (isLocal) return
    await supabase.from("prompt_usage").upsert(
      { user_id: profile.id, used_count: newCount, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    for (const file of files) {
      if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) continue
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        setAttachedImages(prev => [...prev, { name: file.name, data: dataUrl.split(",")[1], preview: dataUrl }])
      }
      reader.readAsDataURL(file)
    }
    e.target.value = ""
    setShowAttachMenu(false)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    for (const file of files) {
      if (file.size > 512 * 1024) continue
      const reader = new FileReader()
      reader.onload = () => setAttachedFiles(prev => [...prev, { name: file.name, content: reader.result as string }])
      reader.readAsText(file)
    }
    e.target.value = ""
    setShowAttachMenu(false)
  }

  const addSystemMsg = useCallback((msg: string, kind: "info" | "warn" | "error" = "info") => {
    const sysMsg: Message = {
      id: "sys-" + Date.now(),
      project_id: projectId || "",
      user_id: "local",
      role: "assistant",
      content: JSON.stringify({ type: "chat", message: `[Plugin] ${msg}`, __model: "" }),
      created_at: new Date().toISOString(),
    }
    if (isLocal) {
      setMessages(prev => [...prev, sysMsg])
    }
  }, [projectId, isLocal])

  // Send the generated payload to Roblox Studio via the local MCP bridge
  // (Vexa Bridge.bat → Studio built-in MCP server). No plugin is involved.
  // If the bridge is offline, show a message telling the user to start it.
  // Write the generated payload into the local Rojo project. Rojo syncs the
  // files into Studio through the official plugin — no bridge, no MCP.
  const applyToStudio = async (output: Record<string, unknown>, projectId: string) => {
    const rojo = getElectronAPI()?.rojo
    if (!rojo) {
      addSystemMsg("Rojo è disponibile solo nell'app desktop Vexa.", "warn")
      return
    }
    let status: RojoStatus | null = null
    try { status = await rojo.status() } catch {}
    if (!status?.running) {
      addSystemMsg("Rojo non è avviato. Apri “Connetti a Rojo” in alto e premi Avvia Rojo.", "warn")
      return
    }
    try {
      const res = await rojo.apply(output)
      if (!res.ok) {
        addSystemMsg(`Sync Rojo non riuscito: ${res.error || "errore sconosciuto"}.`, "error")
        return
      }
      const names = res.written.map((p) => p.split(/[\\/]/).pop() || p)
      const lines = [
        res.written.length > 0 ? `${res.written.length} file scritti nel progetto Rojo: ${names.slice(0, 8).join(", ")}${names.length > 8 ? "…" : ""}` : "Nessun file da scrivere.",
        res.deleted.length > 0 ? `${res.deleted.length} file rimossi` : null,
        res.skipped > 0 ? `${res.skipped} elementi saltati` : null,
      ].filter(Boolean)
      const confMsg: Message = {
        id: "apply-" + Date.now(),
        project_id: projectId,
        user_id: profile!.id,
        role: "assistant",
        content: JSON.stringify({ type: "chat", message: lines.join(". ") + ". Rojo li sincronizza in Studio.", __model: "" }),
        created_at: new Date().toISOString(),
      }
      if (isLocal) saveLocalMessages(projectId, [...getLocalMessages(projectId), confMsg])
      setMessages(prev => [...prev, confMsg])
    } catch (err) {
      addSystemMsg(`Sync Rojo non riuscito: ${(err as Error).message}`, "error")
    }
  }

  interface QaCourse { chain?: number; total?: number; reachable?: boolean }
  interface QaChecks { errors?: unknown[]; spawnlocation?: boolean; leaderstats?: boolean; course?: QaCourse | null; progression?: boolean; humanoid?: boolean; combat?: boolean; remotesDead?: unknown[] }
  interface QaReport { checks?: QaChecks }
  interface RepairMeta { replaced?: number; added?: number }

  const autoRepair = async () => {
    if (repairing || !lastPayload || !projectId) return

    const rojo = getElectronAPI()?.rojo
    if (!rojo) { addSystemMsg("L'auto-riparazione richiede l'app desktop con Rojo.", "warn"); return }
    let rojoRunning = false
    try { rojoRunning = !!(await rojo.status())?.running } catch {}
    if (!rojoRunning) { addSystemMsg("Rojo non è avviato: avvialo da “Connetti a Rojo”.", "warn"); return }

    let report: Record<string, unknown> | null = null
    try {
      const col = await fetch("/api/actions/qa-report", { cache: "no-store", signal: AbortSignal.timeout(3000) })
      const data = await col.json().catch(() => null)
      report = (data && Array.isArray(data.reports) && data.reports[0]) || null
    } catch {}
    const checks = report && typeof report === "object" ? (report as QaReport).checks ?? null : null
    if (!checks) {
      addSystemMsg("Nessun report QA ancora: premi Play in Studio, il probe VexaQA deve generare il report.", "warn")
      return
    }
    const course = checks.course && typeof checks.course === "object" ? checks.course : null
    const findingsCount =
      (Array.isArray(checks.errors) ? checks.errors.length : 0)
      + (checks.spawnlocation === false ? 1 : 0)
      + ((course && course.reachable === false) ? 1 : 0)
      + (checks.leaderstats === false ? 1 : 0)
      + (checks.progression === false ? 1 : 0)
      + (checks.humanoid === false ? 1 : 0)
      + (Array.isArray(checks.remotesDead) && checks.remotesDead.length > 0 ? 1 : 0)
    if (findingsCount === 0) {
      addSystemMsg("Il test runtime non ha riscontrato problemi critici: non serve riparare.", "info")
      return
    }

    setRepairing(true)
    addSystemMsg("Auto-riparazione: correggo script e/o struttura segnalati dal test runtime...", "info")
    try {
      const res = await fetch("/api/actions/repair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: lastUserPrompt, generation: lastPayload, report, model: "", projectName: project?.name ?? "" }),
      })
      const data = (await res.json().catch(() => null)) as (Record<string, unknown> & { scripts?: unknown[]; message?: string; error?: string; __repair?: RepairMeta }) | null
      if (!res.ok || !data || !Array.isArray(data.scripts)) {
        throw new Error(data?.message ?? data?.error ?? "repair endpoint returned an error")
      }
      const rep: RepairMeta = data.__repair ?? {}
      setLastPayload(data)
      addSystemMsg(`Auto-riparazione completata: ${typeof rep.replaced === "number" ? rep.replaced : 0} script corretti, ${typeof rep.added === "number" ? rep.added : 0} istanze aggiunte. Riapplico in Studio...`, "info")
      await applyToStudio(data, projectId)
    } catch (e) {
      addSystemMsg(`Auto-riparazione fallita: ${e instanceof Error ? e.message : "errore sconosciuto"}`, "error")
    } finally {
      setRepairing(false)
    }
  }

  const generate = async (overridePrompt?: string) => {
    if (!profile || !project) return
    const userPrompt = (overridePrompt ?? prompt).trim()
    if ((!userPrompt && attachedImages.length === 0 && attachedFiles.length === 0) || loading) {
      if (!userPrompt && attachedImages.length === 0 && attachedFiles.length === 0 && !overridePrompt) { setShakeSend(true); setTimeout(() => setShakeSend(false), 420); textareaRef.current?.focus() }
      return
    }

    // Enforce prompt limit when plugin is not connected
    if (pluginConnected === false && promptUsed >= PROMPT_LIMIT_UNCONNECTED) {
      return
    }

    const currentProjectId   = projectId   ?? ""
    const currentProjectName = project.name ?? ""

    if (isLocal && userPrompt && (!project.name || project.name === "Nuova chat")) {
      const nm = userPrompt.slice(0, 48)
      setProject({ ...project, name: nm })
      try {
        const key = getLocalProjectsKey()
        const list = JSON.parse(localStorage.getItem(key) || "[]") as LocalProject[]
        const idx = list.findIndex(p => p.id === project.id)
        if (idx >= 0) {
          list[idx] = { ...list[idx], name: nm, updated_at: new Date().toISOString() }
          localStorage.setItem(key, JSON.stringify(list))
          setSideProjects(list)
        }
      } catch {}
    }

    setModeMenuOpen(false); setTypeMenuOpen(false); setShowAttachMenu(false)
    setLastUserPrompt(userPrompt); setPrompt("")
    const imagesToSend = [...attachedImages]; const filesToSend = [...attachedFiles]
    setAttachedImages([]); setAttachedFiles([])
    setLoading(true); setSendBtnBounce(true); setTimeout(() => setSendBtnBounce(false), 500)
    setGenerationSteps([{ id: "init", label: "Thinking…", status: "running" }])

    const tempMsg: Message = { id: "temp-" + Date.now(), project_id: project.id, user_id: profile.id, role: "user", content: userPrompt, created_at: new Date().toString() }
    setMessages(prev => [...prev, tempMsg])

    let stepControl = { finish: () => {} }
    let stepsSettled = false

    const historyForBackend = messages
      .filter(m => !m.id.startsWith("temp-") && !m.id.startsWith("err-"))
      .slice(-10)
      .map(m => {
        if (m.role === "user") return { role: "user" as const, content: m.content }
        try {
          const d = JSON.parse(m.content)
          if (d.type === "clarification") return { role: "assistant" as const, content: d.question || "" }
          if (d.type === "chat")          return { role: "assistant" as const, content: d.message  || "" }
          return { role: "assistant" as const, content: [d.title, d.summary].filter(Boolean).join(". ") }
        } catch { return { role: "assistant" as const, content: m.content.slice(0, 200) } }
      })
      .filter(m => m.content.trim())

    try {
      // Save user message (Supabase or localStorage)
      if (isLocal) {
        const realUserMsg: Message = { ...tempMsg, id: "local-" + Date.now(), created_at: new Date().toISOString() }
        const prev = getLocalMessages(project.id)
        saveLocalMessages(project.id, [...prev, realUserMsg])
        setMessages(prev => [...prev.filter(m => m.id !== tempMsg.id), realUserMsg])
      } else {
        await supabase.from("messages").insert({ project_id: project.id, user_id: profile.id, role: "user", content: userPrompt })
      }

      // Increment usage only when plugin is not connected
      if (pluginConnected === false) {
        await incrementPromptUsage()
      }

      const endpoint = mode === "thinking"
        ? "/api/actions/generate/thinking"
        : "/api/actions/generate"

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setStopping(false)

      // Step labels are cosmetic: never let a slow steps pass block the reply.
      const fetchStepsEarly = async (): Promise<string[]> => {
        const stepsCtrl = new AbortController()
        const onAbort = () => stepsCtrl.abort()
        controller.signal.addEventListener("abort", onAbort, { once: true })
        const stepTimer = setTimeout(() => stepsCtrl.abort(), 12000)
        try {
          const res = await fetch("/api/actions/thinking-steps", {
            method: "POST", headers: { "Content-Type": "application/json" }, signal: stepsCtrl.signal,
            body: JSON.stringify({ prompt: userPrompt, projectId: currentProjectId, projectName: currentProjectName, locale, language: LOCALES.find(l => l.code === locale)?.label || "English" }),
          })
          if (!res.ok) return []
          const data = await res.json()
          return data.steps || []
        } catch { return [] }
        finally {
          clearTimeout(stepTimer)
          controller.signal.removeEventListener("abort", onAbort)
        }
      }

      const makeReq = async () => {
        const heavyType = projectType === "vfx" || projectType === "model3d" || projectType === "animation" || projectType === "sound" || projectType === "cinematic" || isGamePrompt(userPrompt)
        const timeout = setTimeout(() => controller.abort(), heavyType ? 265000 : 150000)
        let storedModel = "vexa-team"
        try {
          const s = localStorage.getItem("gx_model") || "";
          storedModel = s === "hunyuan3d-2.1" || s === "local/qwen3-8b" ? s : "vexa-team";
        } catch {}
        try {
          const res = await fetch(endpoint, {
            method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
            body: JSON.stringify({
              prompt: userPrompt,
              locale, language: LOCALES.find(l => l.code === locale)?.label || "English",
              mode: mode === "thinking" ? "generate" : mode,
              type: projectType,
              projectId: currentProjectId, projectName: currentProjectName,
              model: storedModel || undefined,
              history: historyForBackend.length > 0 ? historyForBackend : undefined,
              datamodel: Object.keys(datamodelSnapshot).length > 0 ? datamodelSnapshot : undefined,
              gameModel: gameModelJson || undefined,
              images: imagesToSend.length > 0 ? imagesToSend.map(i => i.data) : undefined,
              files: filesToSend.length > 0 ? filesToSend : undefined,
            }),
          })
          if (!res.ok) throw new Error("server error")
          return await res.json()
        } finally { clearTimeout(timeout) }
      }

      const stepsPromise = fetchStepsEarly().then(earlySteps => {
        if (earlySteps.length > 0 && !stepsSettled) {
          const realSteps: GenerationStep[] = earlySteps.map((label, i) => ({ id: "step-" + i, label, status: "pending" as const }))
          setGenerationSteps(realSteps)
          stepControl = animateSteps(realSteps)
        }
        return earlySteps
      })

      const payloadPromise = makeReq()
      // The reply must never wait for the cosmetic steps pass (it used to hang
      // the whole UI on "Thinking…" when the steps model was slow).
      const payload = await payloadPromise
      const earlySteps = await Promise.race([
        stepsPromise,
        new Promise<string[]>(resolve => setTimeout(() => resolve([]), 6000)),
      ])
      stepsSettled = true

      if (earlySteps.length === 0) {
        const fallbackSteps = payload.thinking_steps || []
        if (fallbackSteps.length > 0) {
          const realSteps: GenerationStep[] = fallbackSteps.map((label: string, i: number) => ({ id: "step-" + i, label, status: "pending" as const }))
          setGenerationSteps(realSteps)
          stepControl = animateSteps(realSteps)
        }
      }

      stepControl.finish()

      const assistantContent = JSON.stringify({ ...payload, __model: payload.__model || "", __reqType: projectType })

      // Save assistant message (Supabase or localStorage)
      if (isLocal) {
        const assistantMsg: Message = { id: "local-" + Date.now(), project_id: project.id, user_id: "local-user", role: "assistant", content: assistantContent, created_at: new Date().toISOString() }
        const allLocal = getLocalMessages(project.id)
        saveLocalMessages(project.id, [...allLocal, assistantMsg])
        setMessages(prev => [...prev.filter(m => !m.id.startsWith("temp-")), assistantMsg])
        // Update project's updated_at
        try {
          const localProjects = JSON.parse(localStorage.getItem(getLocalProjectsKey()) || "[]") as LocalProject[]
          const updated = localProjects.map((p) => p.id === project.id ? { ...p, updated_at: new Date().toISOString() } : p)
          localStorage.setItem(getLocalProjectsKey(), JSON.stringify(updated))
        } catch {}
      } else {
        await supabase.from("messages").insert({
          project_id: project.id, user_id: profile.id, role: "assistant",
          content: assistantContent,
        })
        await supabase.from("projects").update({ updated_at: new Date().toISOString() }).eq("id", project.id)

        const { data: allMsgs } = await supabase.from("messages").select("*").eq("project_id", project.id).order("created_at", { ascending: true })
        setMessages((allMsgs as Message[]) || [])
      }

      // Automatically apply the generated output in Studio (no manual copy).
      setLastPayload(payload)
      // 3D assets (type "asset3d") are local mesh files, not a Studio build:
      // they are not sent to the plugin.
      if (payload?.type === "generation") void applyToStudio(payload, currentProjectId)

    } catch {
      stepControl.finish()
      setGenerationSteps(prev => prev.map(s => ({ ...s, status: "error" as const })))
      setMessages(prev => [
        ...prev.filter(m => m.id !== tempMsg.id),
        {
          id: "err-" + Date.now(), project_id: project.id, user_id: profile.id, role: "assistant",
          content: JSON.stringify({ type: "chat", message: "Something went wrong. Check your connection and try again.", __model: "" }),
          created_at: new Date().toString(),
        },
      ])
    } finally {
      setLoading(false); abortRef.current = null; setStopping(false)
      setTimeout(() => setGenerationSteps([]), 2400)
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
  }

  const generateRef = useRef(generate)

  useEffect(() => {
    if (!autoStartPrompt || autoStartedRef.current) return
    if (!profile || !project || loading || loadingMsgs) return
    autoStartedRef.current = true
    const text = autoStartPrompt
    setAutoStartPrompt("")
    generate(text)
  }, [autoStartPrompt, profile, project, loading, loadingMsgs])
  useEffect(() => { generateRef.current = generate })

  const handleClarificationAnswer = useCallback((question: string, answer: string) => {
    if (loading) return
    generateRef.current(`Q: ${question}\nA: ${answer}`)
  }, [loading])

  const submitFeedback = async (text: string): Promise<boolean> => {
    if (isLocal) return true
    setFeedbackSending(true)
    try {
      const payload: { user_id: string; project_id: string; comment: string } = { user_id: profile!.id, project_id: project!.id, comment: text }
      const { error } = await supabase.from("feedback").insert([payload])
      return !error
    } catch { return false } finally { setFeedbackSending(false) }
  }

  // Static dot color — no animation
  const pluginDot = pluginConnected === true ? "#fcd846" : pluginConnected === null ? "#f59e0b" : "#3f3f46"
  const currentMode = MODES.find(m => m.id === mode) || MODES[0]
  const currentType = PROJECT_TYPES.find(t => t.id === projectType) || PROJECT_TYPES[0]

  if (!profile || !project) {
    return (
      <div style={{ minHeight: "100vh", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid rgba(252,216,70,0.12)", borderTopColor: "#fcd846", animation: "spin .7s linear infinite" }} />
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>Loading…</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  const sidebar = (
        <aside style={{ width: 248, flexShrink: 0, background: "#212120", borderRight: "1px solid #2c2b28", display: isMobile ? "none" : "flex", flexDirection: "column", padding: "10px 8px 8px", minHeight: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 1, padding: "0 2px 6px" }}>
            <button type="button" className="vx-side-icon" title="Dashboard" onClick={() => router.push("/local")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" /></svg>
            </button>
            <button type="button" className="vx-side-icon" title="Indietro" onClick={() => router.back()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 5 5 12 12 19" /></svg>
            </button>
            <button type="button" className="vx-side-icon" title="Nuova chat" onClick={startNewChat}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z" /></svg>
            </button>
          </div>

          <button type="button" className="vx-side-item" onClick={startNewChat}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Nuovo
          </button>
          <button type="button" className="vx-side-item" onClick={() => router.push("/local")}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
            Progetti
          </button>
          <button type="button" className="vx-side-item" onClick={() => setSettingsOpen(true)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M20 19.5v-2a5 5 0 0 0-5-5H8a5 5 0 0 0-5 5v2" /><circle cx="11.5" cy="6.5" r="3.5" /></svg>
            Profilo
          </button>
          <button type="button" className="vx-side-item" onClick={() => setSettingsOpen(true)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
            Personalizzazione
          </button>

          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 1, padding: "10px 0 8px" }}>
            {sideProjects.map(p => (
              <button key={p.id} type="button" className={"vx-side-item" + (p.id === projectId ? " active" : "")} onClick={() => router.push(`/project/${p.id}`)} title={p.name}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
              </button>
            ))}
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "8px 4px 0", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}><UserAvatar profile={profile} size={22} /></div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#ecebe4", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sideName}</div>
              <div style={{ fontSize: 10.5, color: "#8f8e87" }}>Free</div>
            </div>
            <button type="button" className="vx-side-icon" style={{ width: 26, height: 26 }} title="Impostazioni" onClick={() => setSettingsOpen(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
            </button>
          </div>
        </aside>
  )

  const showLanding = !loadingMsgs && messages.length === 0 && !loading
  if (showLanding) {
    const name = landingName(profile)
    const hasAttach = attachedImages.length > 0 || attachedFiles.length > 0
    const canSend = (!!prompt.trim() || hasAttach) && !isOverLimit && !loading
    const edModelLabel = edModel === "hunyuan3d-2.1" ? "Hunyuan3D 2.1" : edModel === "local/qwen3-8b" ? "Qwen 3" : "Vexa Team"
    const linkBtn: Properties = { background: "none", border: "none", padding: 0, fontFamily: "inherit", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.55)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }
    return (
      <>
        <style>{`
          @keyframes vxFadeUp { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: translateY(0) } }
          @keyframes vxStarIn { from { opacity: 0; transform: rotate(-24deg) scale(0.6) } to { opacity: 1; transform: rotate(0deg) scale(1) } }
          .vx-landing-input::placeholder { color: #8f8e87; }
          .vx-l-btn:hover { color: #fff !important; }
          .vx-l-menu-item:hover { background: rgba(255,255,255,0.06) !important; }
          .vx-l-icon:hover { color: #fff !important; background: rgba(255,255,255,0.06) !important; }
          .vx-l-plus:hover { color: #fff !important; background: rgba(255,255,255,0.08) !important; }
          .vx-l-send:hover { opacity: .86; }
          .vx-side-item { display: flex; align-items: center; gap: 9px; width: 100%; padding: 6px 8px; border: none; background: transparent; color: #c9c7c0; font-size: 13.5px; font-family: inherit; border-radius: 7px; cursor: pointer; text-align: left; line-height: 1.35; }
          .vx-side-item:hover { background: rgba(255,255,255,0.05); }
          .vx-side-item.active { background: rgba(255,255,255,0.08); color: #f0efea; }
          .vx-side-icon { width: 30px; height: 30px; border-radius: 6px; border: none; background: transparent; color: #a8a69f; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
          .vx-side-icon:hover { background: rgba(255,255,255,0.06); color: #f0efea; }
        `}</style>
        <div style={{ display: "flex", height: "100vh", background: "#1b1a18", color: "#f0efea", fontFamily: "'Space Grotesk', 'Inter', sans-serif", overflow: "hidden" }}>
          {sidebar}
          <div style={{ flex: 1, minWidth: 0, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? "80px 16px 32px" : "80px 24px 40px", overflowY: "auto" }}>
          <div style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 60 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "rgba(255,255,255,0.62)", whiteSpace: "nowrap", animation: "vxFadeUp .5s .05s cubic-bezier(.16,1,.3,1) both" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: pluginConnected === true ? "#4ade80" : pluginConnected === null ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.28)", boxShadow: pluginConnected === true ? "0 0 8px rgba(74,222,128,0.7)" : "none", flexShrink: 0 }} />
              <span>{pluginConnected === true ? "Rojo connesso" : pluginConnected === null ? "Cerco Rojo…" : "Rojo non connesso"}</span>
              <span style={{ color: "rgba(255,255,255,0.28)" }}>·</span>
              <button type="button" onClick={() => setShowConnectModal(true)} className="vx-l-btn" style={{ ...linkBtn, color: "#f0efea", textDecoration: "underline", textUnderlineOffset: 3, textDecorationColor: "rgba(255,255,255,0.45)" }}>{pluginConnected === true ? "Riconnetti" : "Connetti a Rojo"}</button>
            </div>
          </div>

          <div style={{ width: "100%", maxWidth: 760, display: "flex", flexDirection: "column", alignItems: "center", animation: "vxFadeUp .55s .06s cubic-bezier(.16,1,.3,1) both" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 13, marginBottom: 26, textAlign: "center", animation: "vxFadeUp .55s .1s cubic-bezier(.16,1,.3,1) both" }}>
              <span style={{ display: "flex", animation: "vxStarIn .6s .16s cubic-bezier(.34,1.56,.64,1) both" }}><LandingStar size={isMobile ? 26 : 32} /></span>
              <h1 style={{ margin: 0, fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 400, fontSize: isMobile ? 26 : "clamp(26px, 2.7vw, 37px)", letterSpacing: "-0.012em", lineHeight: 1.15, color: "#f6f5f0" }}>{name ? `${name} è di ritorno!` : "Bentornato!"}</h1>
            </div>

            <div style={{ width: "100%", maxWidth: 720, background: "#262624", border: "1px solid #3a3936", borderRadius: 16, padding: isMobile ? "13px 14px 10px" : "16px 18px 12px", boxShadow: "0 20px 60px rgba(0,0,0,0.30)" }}>
              {hasAttach && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  {attachedImages.map((img, i) => (
                    <div key={`li-${i}`} style={{ position: "relative" }}>
                      <img src={img.preview} alt={img.name} style={{ width: 42, height: 42, borderRadius: 8, objectFit: "cover", border: "1px solid rgba(255,255,255,0.12)" }} />
                      <button type="button" onClick={() => setAttachedImages(prev => prev.filter((_, j) => j !== i))} style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.18)", color: "#fff", fontSize: 9, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                    </div>
                  ))}
                  {attachedFiles.map((f, i) => (
                    <div key={`lf-${i}`} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <span style={{ maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                      <button type="button" onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))} style={{ marginLeft: 2, width: 14, height: 14, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "none", color: "rgba(255,255,255,0.45)", fontSize: 9, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                    </div>
                  ))}
                </div>
              )}

              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: "none" }} />
              <input ref={fileOnlyRef} type="file" accept=".lua,.luau,.txt,.json,.xml" multiple onChange={handleFileUpload} style={{ display: "none" }} />

              <textarea
                ref={textareaRef}
                className="vx-landing-input"
                value={prompt}
                autoFocus
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (canSend) generate() } }}
                placeholder={isOverLimit ? "Connetti Studio per continuare…" : "Come posso aiutarti oggi?"}
                disabled={isOverLimit}
                rows={1}
                style={{ width: "100%", background: "transparent", border: "none", boxShadow: "none", outline: "none", resize: "none", color: "#f0efea", fontSize: 15.5, lineHeight: 1.55, fontFamily: "inherit", minHeight: 54, maxHeight: 220, overflowY: "auto", padding: 0 }}
              />

              <div style={{ display: "flex", alignItems: "center", marginTop: 4 }}>
                <div ref={attachMenuRef} style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => setShowAttachMenu(v => !v)}
                    className="vx-l-plus"
                    title="Allega"
                    style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", color: "rgba(255,255,255,0.72)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all .15s ease" }}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      {showAttachMenu ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></> : <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>}
                    </svg>
                  </button>
                  {showAttachMenu && (
                    <div style={{ position: "absolute", bottom: "calc(100% + 9px)", left: 0, width: 210, background: "#2a2a27", border: "1px solid #3b3a37", borderRadius: 14, padding: 6, zIndex: 120, boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "5px 10px" }}>Allega</div>
                      <button type="button" className="vx-l-menu-item" onClick={() => fileInputRef.current?.click()} style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 10, border: "none", background: "transparent", color: "#e8e9ec", cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontSize: 13 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                        Immagine
                      </button>
                      <button type="button" className="vx-l-menu-item" onClick={() => fileOnlyRef.current?.click()} style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 10, border: "none", background: "transparent", color: "#e8e9ec", cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontSize: 13 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fcd846" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                        File (.lua, .txt)
                      </button>
                    </div>
                  )}
                </div>


                <button type="button" className="vx-l-icon" title="Voce — presto disponibile" style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", color: "rgba(255,255,255,0.72)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "default", transition: "all .15s ease" }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><line x1="12" y1="18" x2="12" y2="22" /></svg>
                </button>
                <button type="button" className="vx-l-icon" title="Modalità voce — presto disponibile" style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", color: "rgba(255,255,255,0.72)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "default", transition: "all .15s ease" }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="10" x2="4" y2="14" /><line x1="8" y1="7" x2="8" y2="17" /><line x1="12" y1="4" x2="12" y2="20" /><line x1="16" y1="8" x2="16" y2="16" /><line x1="20" y1="10" x2="20" y2="14" /></svg>
                </button>
                <button
                  type="button"
                  onClick={() => { if (canSend) generate() }}
                  className="vx-l-send"
                  title="Invia (Invio)"
                  style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: canSend ? "#fcd846" : "transparent", color: canSend ? "#141310" : "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", cursor: canSend ? "pointer" : "not-allowed", transition: "all .18s ease", marginLeft: 4 }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="13 6 19 12 13 18" /></svg>
                </button>
              </div>
            </div>

            <div style={{ width: "100%", maxWidth: 720, marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, position: "relative" }}>
              <div ref={projMenuRef} style={{ position: "relative" }}>
                <button type="button" className="vx-l-btn" onClick={() => setProjMenuOpen(v => !v)} style={linkBtn}>
                  Progetto
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ opacity: 0.55, transform: projMenuOpen ? "rotate(180deg)" : "none", transition: "transform .18s ease" }}><path d="M1.5 3.5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                {projMenuOpen && (
                  <div style={{ position: "absolute", bottom: "calc(100% + 10px)", left: 0, width: 240, background: "#2a2a27", border: "1px solid #3b3a37", borderRadius: 14, padding: 6, zIndex: 120, boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "9px 11px", fontSize: 13, color: "#f0efea" }}>
                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{project.name}</span>
                      <i className="bi bi-check-lg" style={{ fontSize: 13, color: "#fcd846" }} />
                    </div>
                    <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "4px 0" }} />
                    <button type="button" className="vx-l-menu-item" onClick={() => router.push(isLocal ? "/local" : "/")} style={{ width: "100%", padding: "9px 11px", borderRadius: 10, border: "none", background: "transparent", color: "rgba(255,255,255,0.65)", cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontSize: 13 }}>Tutti i progetti</button>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ position: "relative" }}>
                  <button type="button" className="vx-l-btn" onClick={() => setEdModelOpen(v => !v)} style={{ ...linkBtn, color: "#f0efea" }}>
                    {edModelLabel}
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ opacity: 0.55, transform: edModelOpen ? "rotate(180deg)" : "none", transition: "transform .18s ease" }}><path d="M1.5 3.5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                  {edModelOpen && (
                    <div style={{ position: "absolute", bottom: "calc(100% + 10px)", right: 0, width: 218, background: "#2a2a27", border: "1px solid #3b3a37", borderRadius: 14, padding: 6, zIndex: 120, boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "5px 10px" }}>Modello</div>
                      {([
                        { id: "vexa-team", label: "Vexa Team", sub: "qwen · hunyuan · team", icon: "bi-diagram-3", disabled: false },
                        { id: "local/qwen3-8b", label: "Qwen 3", sub: "locale · gratis", icon: "bi-cpu", disabled: false },
                        { id: "hunyuan3d-2.1", label: "Hunyuan3D 2.1", sub: edHunyuanAlive ? "3D locale · online" : "3D locale · offline", icon: "bi-box-seam", disabled: !edHunyuanAlive },
                      ] as const).map(m => (
                        <button key={m.id} type="button" disabled={m.disabled} onClick={() => pickEdModel(m.id)} className="vx-l-menu-item" style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 10, border: "none", background: edModel === m.id ? "rgba(255,255,255,0.07)" : "transparent", color: "#e8e9ec", cursor: m.disabled ? "default" : "pointer", textAlign: "left", fontFamily: "inherit", opacity: m.disabled ? 0.45 : 1 }}>
                          <i className={"bi " + m.icon} style={{ fontSize: 14, color: "#fcd846" }} />
                          <span style={{ flex: 1 }}>
                            <span style={{ display: "block", fontSize: 13, fontWeight: 500 }}>{m.label}</span>
                            <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.38)", marginTop: 1 }}>{m.sub}</span>
                          </span>
                          {edModel === m.id && <i className="bi bi-check-lg" style={{ fontSize: 13 }} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.38)" }}>Medio</span>
                <button type="button" className="vx-l-btn" title={mode === "generate" ? "Passa a Thinking" : "Passa a Generate"} onClick={() => setMode(m => m === "generate" ? "thinking" : "generate")} style={{ ...linkBtn, color: "rgba(255,255,255,0.55)" }}>{currentMode.label}</button>
              </div>
            </div>
          </div>
          </div>
        </div>

        <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} profile={profile} locale={locale} setLocale={setLocale}
          reduceMotion={reduceMotion} setReduceMotion={setReduceMotion}
          sendOnEnter={sendOnEnter} setSendOnEnter={setSendOnEnter}
          compactMode={compactMode} setCompactMode={setCompactMode} />
        {isAdmin && <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} />}
        {isLocal && <ProjectConnectModal open={showConnectModal} onClose={() => setShowConnectModal(false)} onConnected={() => { setPluginConnected(true) }} />}
      </>
    )
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: transparent; font-family: 'Space Grotesk', 'Inter', sans-serif; }
        ::placeholder { color: rgba(255,255,255,0.20); }
        input:focus, textarea:focus { outline: none; box-shadow: none; }

        @keyframes spin            { to { transform: rotate(360deg) } }
        @keyframes fadeIn          { from { opacity: 0 } to { opacity: 1 } }
        @keyframes fadeOut         { from { opacity: 1 } to { opacity: 0 } }
        @keyframes scaleIn         { from { opacity: 0; transform: scale(0.94) translateY(10px) } to { opacity: 1; transform: scale(1) translateY(0) } }
        @keyframes scaleOut        { from { opacity: 1; transform: scale(1) translateY(0) } to { opacity: 0; transform: scale(0.94) translateY(8px) } }
        @keyframes menuIn          { from { opacity: 0; transform: translateY(-8px) scale(0.96) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes menuUp          { from { opacity: 0; transform: translateY(8px) scale(0.96) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes msgInLeft       { from { opacity: 0; transform: translateX(-16px) translateY(10px) } to { opacity: 1; transform: translateX(0) translateY(0) } }
        @keyframes msgInRight      { from { opacity: 0; transform: translateX(16px) translateY(10px) } to { opacity: 1; transform: translateX(0) translateY(0) } }
        @keyframes pillAppear      { from { opacity: 0; transform: translateY(8px) scale(0.93) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes inputAreaIn     { from { opacity: 0; transform: translateY(24px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes headerSlide     { from { opacity: 0; transform: translateY(-12px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes typingDot       { 0%,60%,100%{transform:translateY(0);opacity:.32} 30%{transform:translateY(-6px);opacity:1} }
        @keyframes lateGreetIn     { from { opacity: 0; transform: translateY(26px) scale(0.96) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes fadeSlideUp     { from { opacity: 0; transform: translateY(9px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes chipPop         { from { opacity: 0; transform: scale(0.80) } to { opacity: 1; transform: scale(1) } }
        @keyframes checkPop        { from { opacity: 0; transform: scale(0.50) rotate(-18deg) } to { opacity: 1; transform: scale(1) rotate(0deg) } }
        @keyframes expandDown      { from { opacity: 0; max-height: 0; transform: scaleY(0.88); transform-origin: top } to { opacity: 1; max-height: 600px; transform: scaleY(1) } }
        @keyframes logoFloat       { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-8px) rotate(1deg)} }
        @keyframes pulse           { 0%,100%{opacity:1} 50%{opacity:0.42} }
        @keyframes sendPop         { 0%{transform:scale(1)} 40%{transform:scale(0.83) translateY(2px)} 70%{transform:scale(1.10) translateY(-2px)} 100%{transform:scale(1)} }
@keyframes shake           { 0%,100%{transform:translateX(0)} 15%{transform:translateX(-7px)} 30%{transform:translateX(6px)} 45%{transform:translateX(-5px)} 60%{transform:translateX(4px)} 75%{transform:translateX(-2px)} 90%{transform:translateX(1px)} }
        @keyframes headerFadeIn    { from{opacity:0;transform:translateX(-4px)} to{opacity:1;transform:translateX(0)} }
        @keyframes tooltipDown     { from { opacity: 0; transform: translateX(-50%) translateY(-4px) scale(0.92) } to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1) } }

        .script-chip:hover       { background: rgba(255,255,255,0.08) !important; transform: translateY(-2px) !important; box-shadow: 0 6px 18px rgba(0,0,0,0.35) !important; transition: all .24s cubic-bezier(.34,1.56,.64,1) !important; }
        .suggestion-chip:hover   { background: rgba(255,255,255,0.08) !important; color: #e8e9ec !important; transform: translateY(-1px) !important; transition: all .18s ease !important; }
        .reaction-btn:hover      { background: rgba(255,255,255,0.055) !important; color: rgba(255,255,255,0.62) !important; transform: translateY(-1px) !important; transition: all .15s ease !important; }
        .clarif-opt:hover        { background: rgba(255,255,255,0.09) !important; color: #e8e9ec !important; border-color: rgba(255,255,255,0.18) !important; transform: translateY(-1px) !important; transition: all .2s cubic-bezier(.34,1.56,.64,1) !important; }
        .g-menu-item:hover       { background: rgba(255,255,255,0.07) !important; color: #fff !important; }
        .g-signout:hover         { color: #fc8181 !important; }
        .nav-btn:hover           { background: rgba(255,255,255,0.06) !important; transition: all .15s ease !important; }
        .send-btn:hover:not(:disabled) { transform: scale(1.10) !important; box-shadow: 0 4px 22px rgba(255,255,255,0.18) !important; transition: all .2s cubic-bezier(.34,1.56,.64,1) !important; }
        .send-btn:active:not(:disabled) { animation: sendPop .3s ease !important; }
        .mode-pill:hover         { background: rgba(255,255,255,0.08) !important; border-color: rgba(255,255,255,0.15) !important; transition: all .15s ease !important; }
        .type-pill:hover         { background: rgba(255,255,255,0.08) !important; border-color: rgba(255,255,255,0.15) !important; transition: all .15s ease !important; }
        .type-pill:hover .type-pill-icon { transform: rotate(-18deg) scale(1.18) !important; }
        .plan-menu-item:hover .plan-icon  { transform: rotate(-18deg) scale(1.18) !important; }
        .plan-menu-item:hover .plan-coming-soon { opacity: 1 !important; pointer-events: none; animation: tooltipDown .22s cubic-bezier(.34,1.56,.64,1) both !important; }
        .reasoning-toggle:hover  { opacity: 0.75; }
        .reasoning-row:hover     { background: rgba(255,255,255,0.018) !important; }
        .lm-rail-btn:hover       { background: rgba(255,255,255,0.07) !important; color: rgba(255,255,255,0.85) !important; }
        .lm-quest-row:hover      { background: rgba(255,255,255,0.055) !important; border-color: rgba(255,255,255,0.16) !important; transform: translateY(-1px); }
        .lm-quest-row:active     { transform: translateY(0) scale(0.99); }
        .lm-explore-card:hover   { filter: brightness(1.08); transform: translateY(-2px); }
        .lm-explore-card:active  { transform: translateY(0) scale(0.98); }
        .lm-import-btn:hover     { background: rgba(255,255,255,0.92) !important; transform: translateY(-1px); }
        .lm-import-btn:active    { transform: translateY(0) scale(0.98); }
        .vx-sky .aur { display: none !important; }
        .vx-dots {
          position: absolute; inset: 0; pointer-events: none;
          background-image: radial-gradient(rgba(255,255,255,0.075) 1.1px, transparent 1.5px);
          background-size: 26px 26px; background-position: center center;
          -webkit-mask-image: radial-gradient(85% 80% at 50% 40%, #000 30%, transparent 100%);
          mask-image: radial-gradient(85% 80% at 50% 40%, #000 30%, transparent 100%);
        }
      `}</style>

      <FeedbackModal open={feedbackOpen} onClose={() => { setFeedbackOpen(false); setFeedbackMsgId(null) }} onSubmit={submitFeedback} sending={feedbackSending} isMobile={isMobile} />
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} profile={profile} locale={locale} setLocale={setLocale}
        reduceMotion={reduceMotion} setReduceMotion={setReduceMotion}
        sendOnEnter={sendOnEnter} setSendOnEnter={setSendOnEnter}
        compactMode={compactMode} setCompactMode={setCompactMode} />
      {isAdmin && <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} />}
      {isLocal && <ProjectConnectModal open={showConnectModal} onClose={() => setShowConnectModal(false)} onConnected={() => { setPluginConnected(true) }} />}


      <div className="vx-sky" style={{ zIndex: 0 }}>
        <div className="aur aur-a" /><div className="aur aur-b" /><div className="aur aur-c" /><div className="aur aur-d" />
        <div className="vx-dots" />
        <div className="grain" />
      </div>

      <div className="vx-app" style={{ display: "flex", height: "100vh", background: "#1b1a18", fontFamily: "'Space Grotesk', 'Inter', sans-serif", color: "#f0efea", overflow: "hidden" }}>
        <style>{`
          .vx-side-item { display: flex; align-items: center; gap: 9px; width: 100%; padding: 6px 8px; border: none; background: transparent; color: #c9c7c0; font-size: 13.5px; font-family: inherit; border-radius: 7px; cursor: pointer; text-align: left; line-height: 1.35; }
          .vx-side-item:hover { background: rgba(255,255,255,0.05); }
          .vx-side-item.active { background: rgba(255,255,255,0.08); color: #f0efea; }
          .vx-side-icon { width: 30px; height: 30px; border-radius: 6px; border: none; background: transparent; color: #a8a69f; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
          .vx-side-icon:hover { background: rgba(255,255,255,0.06); color: #f0efea; }
          .vx-composer textarea::placeholder { color: #8f8e87; }
        `}</style>

{sidebar}

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0, position: "relative", zIndex: 1 }}>
          <div style={{ height: 52, flexShrink: 0, display: "flex", alignItems: "center", gap: 7, padding: "0 16px" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#ecebe4", maxWidth: isMobile ? 160 : 380, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project.name}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#8f8e87" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
            <div style={{ flex: 1 }} />
            <button type="button" onClick={() => setShowConnectModal(true)} style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999, padding: "5px 11px", fontFamily: "inherit", fontSize: 12, color: "rgba(255,255,255,0.7)", cursor: "pointer", whiteSpace: "nowrap" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: pluginConnected === true ? "#4ade80" : pluginConnected === null ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.28)", flexShrink: 0 }} />
              {pluginConnected === true ? "Rojo connesso" : pluginConnected === null ? "Cerco Rojo…" : "Connetti a Rojo"}
            </button>
          </div>

          <div style={{ width: "100%", flexShrink: 0, background: "transparent", display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
            {edView === "explore" ? (
              <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingTop: 14 }}>
                <ExploreGallery query={exploreQuery} onUse={(p, t) => { setProjectType(t); setPrompt(p); setEdView("agent"); requestAnimationFrame(() => textareaRef.current?.focus()); }} />
              </div>
            ) : (
            <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", position: "relative" }}>
          <div style={{ width: "100%", maxWidth: 720, margin: "0 auto", padding: isMobile ? "18px 16px 24px" : "18px 24px 26px", display: "flex", flexDirection: "column", gap: "var(--compact-gap, 28px)" }}>
            {loadingMsgs ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 70 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid rgba(252,216,70,0.12)", borderTopColor: "#fcd846", animation: "spin .7s linear infinite" }} />
              </div>
            ) : messages.length === 0 && !loading ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px 0", textAlign: "center", gap: 12 }}>
                  <p style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, letterSpacing: "-0.032em", color: "#e8e9ec", margin: 0, animation: "fadeSlideUp .5s .1s cubic-bezier(.16,1,.3,1) both" }}>{greetingText}</p>
                  <p style={{ fontSize: 14, color: "rgba(255,255,255,0.30)", margin: 0, animation: "fadeSlideUp .5s .18s cubic-bezier(.16,1,.3,1) both" }}>{buildingPrompt}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16, width: "100%", maxWidth: 520 }}>
                    {QUICK_STARTS.slice(0, 5).map((qs, i) => (
                      <button
                        key={qs.label}
                        type="button"
                        onClick={() => applyQuickStart(qs)}
                        className="lm-quest-row"
                        style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", background: i === 0 ? "rgba(125,211,252,0.06)" : "rgba(255,255,255,0.03)", border: i === 0 ? "1px solid rgba(125,211,252,0.35)" : "1px solid rgba(255,255,255,0.10)", borderRadius: 13, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "rgba(255,255,255,0.85)", fontFamily: "'Space Grotesk', 'Inter', sans-serif", animation: `chipPop .4s ${0.22 + i * 0.06}s cubic-bezier(.34,1.56,.64,1) both`, transition: "all .18s ease", textAlign: "left" }}
                      >
                        <span style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <i className={"bi " + qs.icon} style={{ fontSize: 14, color: "rgba(255,255,255,0.75)" }} />
                        </span>
                        <span style={{ flex: 1, lineHeight: 1.45, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{qs.prompt}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <KeySetupNim />
              </>
            ) : (
              <>
                {messages.map((msg, idx) => {
                  if (hiddenIndices.has(idx)) return null
                  return (
                    <div key={msg.id} id={`vxm-${idx}`}>
                    <MessageBubble
                      msg={msg} isMobile={isMobile} pluginConnected={pluginConnected}
                      index={idx}
                      qaHistory={buildQAChain(messages, idx)}
                      onSuggestionClick={s => { setPrompt(s); requestAnimationFrame(() => textareaRef.current?.focus()) }}
                      onClarificationAnswer={handleClarificationAnswer}
                      onRetry={() => { if (lastUserPrompt) generate(lastUserPrompt) }}
                      onFeedback={msgId => { setFeedbackMsgId(msgId); setFeedbackOpen(true) }}
                    />
                    </div>
                  )
                })}
                {loading && generationSteps.length > 0 && <div style={{ animation: "msgInLeft .32s cubic-bezier(.16,1,.3,1) both" }}><ThinkingPill steps={generationSteps} /></div>}
                {loading && generationSteps.length === 0 && <TypingIndicator />}
              </>
            )}
            <div ref={bottomRef} style={{ height: 1, flexShrink: 0 }} />
          </div>
        </div>
        )}

        {/* ── INPUT FOOTER ── */}
        <div style={{
          position: "relative", zIndex: 30, flexShrink: 0,
          padding: isMobile ? "4px 12px 14px" : "4px 24px 18px",
          background: "transparent",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, position: "relative", width: "100%", maxWidth: 720, margin: "0 auto" }}>

            {/* prompt limit banner */}
            {showLimitBanner && (
              <PromptLimitBanner used={promptUsed} limit={PROMPT_LIMIT_UNCONNECTED} />
            )}

            {/* toolbar row */}
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>

              {/* mode picker */}
              <div ref={modeMenuRef} style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setModeMenuOpen(v => !v)}
                  className="mode-pill"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 2px",
                    background: "transparent", fontSize: 12, fontWeight: 500,
                    cursor: "pointer", color: "#a8a69f", border: "none",
                    fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                  }}
                >
                  <i className={"bi " + currentMode.icon} style={{ fontSize: 12, transition: "transform .25s cubic-bezier(.34,1.56,.64,1)", transform: modeMenuOpen ? "rotate(-18deg) scale(1.18)" : "scale(1)" }} />
                  <span>{currentMode.label}</span>
                  <i className="bi bi-chevron-up" style={{ fontSize: 10, opacity: 0.36, transition: "transform .22s ease", transform: modeMenuOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
                </button>
                {modeMenuOpen && (
                  <div style={{ position: "absolute", bottom: "calc(100% + 9px)", left: 0, width: 185, ...glassModal, borderRadius: 15, padding: 6, zIndex: 100, animation: "menuUp .22s cubic-bezier(.16,1,.3,1)", fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "5px 10px 5px", marginBottom: 2 }}>Mode</div>
                    {MODES.map((m, i) => (
                      <button key={m.id} type="button" onClick={() => { setMode(m.id); setModeMenuOpen(false) }}
                        style={{ width: "100%", padding: "9px 11px", borderRadius: 10, border: "none", background: mode === m.id ? "rgba(255,255,255,0.07)" : "transparent", cursor: "pointer", textAlign: "left", fontFamily: "'Space Grotesk', 'Inter', sans-serif", animation: `fadeSlideUp .18s ${i * 0.04}s cubic-bezier(.16,1,.3,1) both` }} className="g-menu-item">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "#e8e9ec" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, fontWeight: 500 }}><i className={"bi " + m.icon} style={{ fontSize: 14 }} />{m.label}</div>
                          {mode === m.id && <i className="bi bi-check-lg" style={{ fontSize: 13, animation: "checkPop .2s cubic-bezier(.34,1.56,.64,1) both" }} />}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* type picker */}
              <div ref={typeMenuRef} style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setTypeMenuOpen(v => !v)}
                  className="type-pill"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 2px",
                    background: "transparent", fontSize: 12, fontWeight: 500,
                    cursor: "pointer", color: "#a8a69f", border: "none",
                    fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                  }}
                >
                  <i
                    className={"bi " + currentType.icon + " type-pill-icon"}
                    style={{
                      fontSize: 12,
                      transition: "transform .25s cubic-bezier(.34,1.56,.64,1)",
                      transform: typeMenuOpen ? "rotate(-18deg) scale(1.18)" : "scale(1)",
                    }}
                  />
                  <span>{currentType.label}</span>
                  <i className="bi bi-chevron-up" style={{ fontSize: 10, opacity: 0.36, transition: "transform .22s ease", transform: typeMenuOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
                </button>

                {typeMenuOpen && (
                  <div style={{ position: "absolute", bottom: "calc(100% + 9px)", left: 0, width: 165, ...glassModal, borderRadius: 15, padding: 6, zIndex: 100, animation: "menuUp .22s cubic-bezier(.16,1,.3,1)", fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "5px 10px 5px", marginBottom: 2 }}>Type</div>

                    {PROJECT_TYPES.map((t, i) => {
                      const isPlan = t.id === "plan"
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            if (isPlan) return
                            setProjectType(t.id)
                            setTypeMenuOpen(false)
                          }}
                          onMouseEnter={() => { if (isPlan) setPlanHovered(true) }}
                          onMouseLeave={() => { if (isPlan) setPlanHovered(false) }}
                          style={{
                            width: "100%", padding: "9px 11px", borderRadius: 10, border: "none",
                            background: projectType === t.id ? "rgba(255,255,255,0.07)" : "transparent",
                            cursor: isPlan ? "default" : "pointer",
                            textAlign: "left", fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                            animation: `fadeSlideUp .18s ${i * 0.04}s cubic-bezier(.16,1,.3,1) both`,
                            position: "relative",
                            overflow: "visible",
                          }}
                          className={isPlan ? "plan-menu-item" : "g-menu-item"}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: isPlan ? "rgba(255,255,255,0.38)" : "#e8e9ec" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, fontWeight: 500 }}>
                              <i
                                className={"bi " + t.icon + (isPlan ? " plan-icon" : "")}
                                style={{
                                  fontSize: 14,
                                  transition: "transform .25s cubic-bezier(.34,1.56,.64,1)",
                                  transform: isPlan && planHovered ? "rotate(-18deg) scale(1.18)" : "scale(1)",
                                }}
                              />
                              {t.label}
                            </div>
                            {projectType === t.id && !isPlan && <i className="bi bi-check-lg" style={{ fontSize: 13, animation: "checkPop .2s cubic-bezier(.34,1.56,.64,1) both" }} />}
                          </div>

                          {/* tooltip drops DOWN below the button */}
                          {isPlan && (
                            <div
                              className="plan-coming-soon"
                              style={{
                                position: "absolute",
                                top: "calc(100% + 8px)",
                                left: "50%",
                                transform: "translateX(-50%)",
                                background: "#000",
                                color: "#fff",
                                fontSize: 12,
                                fontWeight: 600,
                                padding: "6px 12px",
                                borderRadius: 9,
                                whiteSpace: "nowrap",
                                pointerEvents: "none",
                                opacity: planHovered ? 1 : 0,
                                transition: "opacity .18s ease",
                                animation: planHovered ? "tooltipDown .22s cubic-bezier(.34,1.56,.64,1) both" : "none",
                                boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
                                zIndex: 200,
                              }}
                            >
                              Coming soon
                              {/* arrow points UP */}
                              <div style={{
                                position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)",
                                width: 0, height: 0,
                                borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderBottom: "5px solid #000",
                              }} />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {(Object.keys(datamodelSnapshot).length > 0 || gameModelJson) && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", ...glassPill, borderRadius: 100, border: "1px solid rgba(252,216,70,0.16)", animation: "chipPop .38s cubic-bezier(.34,1.56,.64,1) both" }}>
                  <i className="bi bi-diagram-3" style={{ fontSize: 11, color: "rgba(252,216,70,0.65)" }} />
                  <span style={{ fontSize: 11, color: "rgba(252,216,70,0.65)", fontWeight: 600 }}>Game scanned</span>
                </div>
              )}
            </div>

            {/* text input row */}
            {(attachedImages.length > 0 || attachedFiles.length > 0) && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "0 4px" }}>
                {attachedImages.map((img, i) => (
                  <div key={`img-${i}`} style={{ position: "relative" }}>
                    <img src={img.preview} alt={img.name} style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)" }} />
                    <button type="button" onClick={() => setAttachedImages(prev => prev.filter((_, j) => j !== i))} style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontSize: 9, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                  </div>
                ))}
                {attachedFiles.map((f, i) => (
                  <div key={`file-${i}`} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 8, ...glassPill, fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: "'JetBrains Mono', monospace" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span style={{ maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                    <button type="button" onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))} style={{ marginLeft: 2, width: 14, height: 14, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 9, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{
              display: "flex", alignItems: "flex-end", gap: 9,
              background: "#262624",
              border: isOverLimit
                ? "1px solid rgba(252,100,100,0.35)"
                : inputFocused ? "1px solid #55534d" : "1px solid #3a3936",
              borderRadius: 16,
              padding: isMobile ? "10px 10px 10px 14px" : "12px 12px 12px 16px",
              boxShadow: "0 18px 50px rgba(0,0,0,0.28)",
              opacity: loading ? 0.60 : isOverLimit ? 0.55 : 1,
              pointerEvents: loading || isOverLimit ? "none" : "auto",
              transition: "border-color .2s ease, opacity .2s ease",
            }}>
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: "none" }} />
              <input ref={fileOnlyRef} type="file" accept=".lua,.luau,.txt,.json,.xml" multiple onChange={handleFileUpload} style={{ display: "none" }} />

              {/* + Attach button */}
              <div ref={attachMenuRef} style={{ position: "relative", flexShrink: 0, alignSelf: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setShowAttachMenu(v => !v)}
                  style={{
                    width: isMobile ? 34 : 36, height: isMobile ? 34 : 36, borderRadius: "50%",
                    border: "none", flexShrink: 0, cursor: "pointer",
                    background: showAttachMenu ? "rgba(255,255,255,0.1)" : "transparent",
                    color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all .2s ease",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {showAttachMenu
                      ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                      : <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>
                    }
                  </svg>
                </button>

                {showAttachMenu && (
                  <div style={{
                    position: "absolute", bottom: "calc(100% + 9px)", left: 0, width: 210,
                    ...glassModal, borderRadius: 15, padding: 6, zIndex: 100,
                    animation: "menuUp .22s cubic-bezier(.16,1,.3,1)",
                    fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "5px 10px 5px", marginBottom: 2 }}>Attach</div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 10, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: "'Space Grotesk', 'Inter', sans-serif", color: "#e8e9ec" }}
                      className="g-menu-item"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                      </svg>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>Image</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileOnlyRef.current?.click()}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 10, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: "'Space Grotesk', 'Inter', sans-serif", color: "#e8e9ec" }}
                      className="g-menu-item"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fcd846" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                      </svg>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>File (.lua, .txt)</span>
                    </button>
                  </div>
                )}
              </div>

              <div style={{ position: "relative", flexShrink: 0, alignSelf: "flex-end" }}>
                {edModelOpen && <button type="button" aria-label="close" onClick={() => setEdModelOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "transparent", border: "none", cursor: "default" }} />}
                <button
                  type="button"
                  onClick={() => setEdModelOpen(v => !v)}
                  title="Choose model"
                  style={{
                    display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 6px",
                    background: "transparent", border: "none", borderRadius: 8,
                    fontSize: 12.5, fontWeight: 500, cursor: "pointer", color: "#a8a69f",
                    fontFamily: "inherit", whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis" }}>{edModel === "hunyuan3d-2.1" ? "Hunyuan3D 2.1" : edModel === "local/qwen3-8b" ? "Qwen 3" : "Vexa Team"}</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ opacity: 0.55, transition: "transform .22s ease", transform: edModelOpen ? "rotate(180deg)" : "rotate(0deg)" }}><polyline points="6 9 12 15 18 9" /></svg>
                </button>
                {edModelOpen && (
                  <div style={{ position: "absolute", bottom: "calc(100% + 9px)", left: 0, width: 230, ...glassModal, borderRadius: 15, padding: 6, zIndex: 100, animation: "menuUp .22s cubic-bezier(.16,1,.3,1)", fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "5px 10px 5px", marginBottom: 2 }}>Model</div>
                    <button type="button" onClick={() => pickEdModel("vexa-team")} className="g-menu-item" style={{ width: "100%", padding: "9px 11px", borderRadius: 10, border: "none", background: edModel !== "local/qwen3-8b" && edModel !== "hunyuan3d-2.1" ? "rgba(255,255,255,0.07)" : "transparent", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "#e8e9ec" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, fontWeight: 500 }}><i className="bi bi-diagram-3" style={{ fontSize: 14, color: "#fcd846" }} />Vexa Team</div>
                        {edModel !== "local/qwen3-8b" && edModel !== "hunyuan3d-2.1" && <i className="bi bi-check-lg" style={{ fontSize: 13 }} />}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2, paddingLeft: 23 }}>qwen · hunyuan · team</div>
                    </button>
                    <button type="button" onClick={() => pickEdModel("local/qwen3-8b")} className="g-menu-item" style={{ width: "100%", padding: "9px 11px", borderRadius: 10, border: "none", background: edModel === "local/qwen3-8b" ? "rgba(255,255,255,0.07)" : "transparent", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "#e8e9ec" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, fontWeight: 500 }}><i className="bi bi-cpu" style={{ fontSize: 14, color: "#fcd846" }} />Qwen 3</div>
                        {edModel === "local/qwen3-8b" && <i className="bi bi-check-lg" style={{ fontSize: 13 }} />}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2, paddingLeft: 23 }}>local · free</div>
                    </button>
                    <button type="button" disabled={!edHunyuanAlive} onClick={() => pickEdModel("hunyuan3d-2.1")} className="g-menu-item" style={{ width: "100%", padding: "9px 11px", borderRadius: 10, border: "none", background: edModel === "hunyuan3d-2.1" ? "rgba(255,255,255,0.07)" : "transparent", cursor: edHunyuanAlive ? "pointer" : "default", textAlign: "left", fontFamily: "inherit", opacity: edHunyuanAlive ? 1 : 0.45 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "#e8e9ec" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, fontWeight: 500 }}><i className="bi bi-box-seam" style={{ fontSize: 14, color: "#fcd846" }} />Hunyuan3D 2.1</div>
                        {edModel === "hunyuan3d-2.1" && <i className="bi bi-check-lg" style={{ fontSize: 13 }} />}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2, paddingLeft: 23 }}>{edHunyuanAlive ? "local 3D · online" : "local 3D · offline"}</div>
                    </button>
                  </div>
                )}
              </div>
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && sendOnEnter && !isMobile) { e.preventDefault(); generate() } }}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder={isOverLimit ? "Connect Studio to keep generating…" : "Rispondi"}
                disabled={loading || isOverLimit}
                rows={1}
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none", boxShadow: "none",
                  resize: "none", fontSize: 14, color: "#e8e9ec", lineHeight: 1.65,
                  fontFamily: "inherit", minHeight: 22, maxHeight: isMobile ? 110 : 160, overflowY: "auto",
                }}
              />
              {loading ? (
                <button
                  type="button"
                  onClick={() => { setStopping(true); abortRef.current?.abort() }}
                  style={{
                    width: isMobile ? 36 : 38, height: isMobile ? 36 : 38, borderRadius: "50%",
                    border: "none", flexShrink: 0,
                    background: stopping ? "rgba(252,129,129,0.04)" : "rgba(252,129,129,0.09)",
                    color: "#fc8181", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all .2s ease",
                  }}
                >
                  {stopping
                    ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(252,129,129,0.25)", borderTopColor: "#fc8181", animation: "spin .7s linear infinite" }} />
                    : <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => generate()}
                  disabled={(!prompt.trim() && attachedImages.length === 0 && attachedFiles.length === 0) || isOverLimit}
                  className="send-btn"
                  style={{
                    width: isMobile ? 36 : 38, height: isMobile ? 36 : 38, borderRadius: "50%",
                    border: "none", flexShrink: 0,
                    background: (prompt.trim() || attachedImages.length > 0 || attachedFiles.length > 0) && !isOverLimit ? "linear-gradient(135deg, #fcd846 0%, #fcd846 50%, #ffe98a 100%)" : "rgba(255,255,255,0.06)",
                    color: (prompt.trim() || attachedImages.length > 0 || attachedFiles.length > 0) && !isOverLimit ? "#060810" : "rgba(255,255,255,0.20)",
                    boxShadow: (prompt.trim() || attachedImages.length > 0 || attachedFiles.length > 0) && !isOverLimit ? "0 4px 20px rgba(252,216,70,0.5), inset 0 1px 0 rgba(255,255,255,0.3)" : "none",
                    cursor: (prompt.trim() || attachedImages.length > 0 || attachedFiles.length > 0) && !isOverLimit ? "pointer" : "not-allowed",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all .2s cubic-bezier(.34,1.56,.64,1)",
                    animation: shakeSend ? "shake .42s cubic-bezier(.36,.07,.19,.97) both" : undefined,
                  }}
                >
                  <span style={{ display: "flex", transition: "transform .22s cubic-bezier(.34,1.56,.64,1)", transform: sendBtnBounce ? "translateY(-2px)" : "none" }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
                  </span>
                </button>
              )}
              {lastPayload && pluginConnected !== false && !loading && (
                <button
                  type="button"
                  onClick={() => applyToStudio(lastPayload, projectId || "")}
                  title="Apply last generation to Studio"
                  style={{
                    width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(99,179,237,0.25)",
                    background: "rgba(99,179,237,0.08)", color: "#63b3ed", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    transition: "all .15s ease", fontSize: 14,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(99,179,237,0.18)" }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(99,179,237,0.08)" }}
                >
                  <i className="bi bi-box-arrow-in-down" />
                </button>
              )}
              {lastPayload && pluginConnected !== false && !loading && (
                <button
                  type="button"
                  onClick={autoRepair}
                  disabled={repairing}
                  title="Auto-ripara: usa il report QA runtime per correggere script errati e riapplicare in Studio"
                  style={{
                    width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(252,216,70,0.30)",
                    background: repairing ? "rgba(252,216,70,0.16)" : "rgba(252,216,70,0.08)",
                    color: repairing ? "rgba(252,216,70,0.7)" : "#fcd846", cursor: repairing ? "wait" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    transition: "all .15s ease", fontSize: 14,
                  }}
                  onMouseEnter={e => { if (!repairing) (e.currentTarget as HTMLButtonElement).style.background = "rgba(252,216,70,0.18)" }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = repairing ? "rgba(252,216,70,0.16)" : "rgba(252,216,70,0.08)" }}
                >
                  <i className="bi bi-bandaid" />
                </button>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "1px 6px 0", fontSize: 11.5, color: "#8f8e87" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Vexa è un'IA e può commettere errori.</span>
              <div style={{ flex: 1 }} />
              <span style={{ flexShrink: 0 }}>{edModel === "hunyuan3d-2.1" ? "Hunyuan3D 2.1" : edModel === "local/qwen3-8b" ? "Qwen 3" : "Vexa Team"}</span>
              <span style={{ flexShrink: 0 }}>{currentMode.label}</span>
            </div>
          </div>
        </div>
        </div>
        </div>
      </div>


    </>
  )
}