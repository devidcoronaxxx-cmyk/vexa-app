"use client"

import { useCallback, useEffect, useState } from "react"
import type { CSSProperties as Properties } from "react"
import { supabase } from "@/lib/supabase"
import type { Profile } from "@/lib/supabase"
import { LOCALES, useI18n, type SupportedLocale } from "@/app/localization/client"

type FullProfile = Profile & {
  avatar_url?: string | null
  roblox_user_id?: number | null
  display_name?: string | null
  username?: string | null
}

const G = {
  fill: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.09)",
  blur: "blur(20px) saturate(1.5)",
  blurHeavy: "blur(40px) saturate(1.8)",
}

const glassPill: Properties = {
  background: G.fill,
  backdropFilter: G.blur,
  WebkitBackdropFilter: G.blur,
  border: "1px solid " + G.border,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07)",
}

const glassModal: Properties = {
  background: "rgba(12,12,14,0.98)",
  backdropFilter: G.blurHeavy,
  WebkitBackdropFilter: G.blurHeavy,
  border: "1px solid rgba(255,255,255,0.10)",
  boxShadow: ["inset 0 1px 0 rgba(255,255,255,0.08)", "0 24px 80px rgba(0,0,0,0.7)"].join(", "),
}

function ToggleRow({ icon, title, sub, value, onChange }: { icon: string; title: string; sub: string; value: boolean; onChange: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
        <i className={"bi " + icon} style={{ fontSize: 16, color: "rgba(255,255,255,.32)", width: 20, textAlign: "center" }} />
        <div>
          <div style={{ fontSize: 14, color: "#e8e9ec", fontWeight: 500 }}>{title}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.32)", marginTop: 2 }}>{sub}</div>
        </div>
      </div>
      <button type="button" onClick={onChange} style={{ width: 42, height: 23, borderRadius: 100, background: value ? "#fff" : "rgba(255,255,255,.09)", border: "1px solid " + (value ? "#fff" : "rgba(255,255,255,.13)"), cursor: "pointer", position: "relative", display: "flex", alignItems: "center", padding: "0 3px", transition: "all .22s ease", flexShrink: 0 }}>
        <span style={{ width: 15, height: 15, borderRadius: "50%", background: value ? "#09090b" : "rgba(255,255,255,.38)", display: "block", transform: value ? "translateX(19px)" : "translateX(0)", transition: "transform .26s cubic-bezier(.34,1.56,.64,1)" }} />
      </button>
    </div>
  )
}

function ConfirmBanner({
  icon,
  message,
  phrase,
  confirmLabel,
  onConfirm,
  onCancel,
  loading,
}: {
  icon: string
  message: string
  phrase: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  const [typed, setTyped] = useState("")
  const match = typed.trim().toLowerCase() === phrase.toLowerCase()
  return (
    <div style={{ marginTop: 8, padding: "13px 15px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", borderRadius: 12, animation: "gSlideDown .2s cubic-bezier(.16,1,.3,1) both" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
        <i className={"bi " + icon} style={{ fontSize: 14, color: "#f87171", marginTop: 1, flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,.62)", lineHeight: 1.5 }}>{message}</p>
      </div>
      <div style={{ marginBottom: 10 }}>
        <p style={{ margin: "0 0 6px", fontSize: 12, color: "rgba(255,255,255,.35)" }}>
          Type <span style={{ fontFamily: "monospace", color: "#f87171", letterSpacing: "0.02em" }}>{phrase}</span> to confirm
        </p>
        <input
          value={typed}
          onChange={e => setTyped(e.target.value)}
          placeholder={phrase}
          autoFocus
          style={{ width: "100%", height: 36, background: "rgba(255,255,255,.045)", borderRadius: 9, padding: "0 12px", fontSize: 13, color: "#e8e9ec", fontFamily: "inherit", outline: "none", boxSizing: "border-box", transition: "border-color .15s", border: `1px solid ${typed.length > 0 ? (match ? "rgba(252,216,70,0.45)" : "rgba(239,68,68,0.4)") : "rgba(255,255,255,.09)"}` }}
        />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!match || loading}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, fontFamily: "inherit", transition: "opacity .2s", cursor: (!match || loading) ? "not-allowed" : "pointer", opacity: (!match || loading) ? 0.35 : 1 }}
        >
          {loading
            ? <div style={{ width: 13, height: 13, borderRadius: "50%", border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", animation: "gSpin .7s linear infinite" }} />
            : <><i className="bi bi-exclamation-triangle" style={{ fontSize: 12 }} />{confirmLabel}</>
          }
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          style={{ padding: "7px 14px", background: "transparent", color: "rgba(255,255,255,.45)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 9, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function Settings({
  open,
  onClose,
  profile,
  reduceMotion,
  setReduceMotion,
  sendOnEnter,
  setSendOnEnter,
  compactMode,
  setCompactMode,
  locale,
  setLocale,
  isMobile = false,
}: {
  open: boolean
  onClose: () => void
  profile: Profile
  reduceMotion?: boolean
  setReduceMotion?: (v: boolean) => void
  sendOnEnter?: boolean
  setSendOnEnter?: (v: boolean) => void
  compactMode?: boolean
  setCompactMode?: (v: boolean) => void
  locale?: SupportedLocale
  setLocale?: (v: SupportedLocale) => void
  isMobile?: boolean
}) {
  const i18n = useI18n()
  const fp = profile as FullProfile
  const [closing, setClosing] = useState(false)
  const [prevOpen, setPrevOpen] = useState(open)
  const [dname, setDname] = useState(fp.display_name || "")
  const [uname, setUname] = useState(fp.username || "")
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState("")
  const [tab, setTab] = useState<"appearance" | "language" | "account">("appearance")
  const [localeSearch, setLocaleSearch] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [dangerLoading, setDangerLoading] = useState<"delete" | "clear" | null>(null)
  const [dangerMsg, setDangerMsg] = useState("")
  const [openCloudKey, setOpenCloudKey] = useState(() => { try { return localStorage.getItem("vexa_open_cloud_key") || "" } catch { return "" } })
  const [savingKey, setSavingKey] = useState(false)
  const [keyMsg, setKeyMsg] = useState("")

  const activeLocale = locale ?? i18n.locale
  const currentLocale = LOCALES.find(l => l.code === activeLocale) ?? LOCALES[0]
  const filteredLocales = localeSearch.trim()
    ? LOCALES.filter(l =>
        l.label.toLowerCase().includes(localeSearch.toLowerCase()) ||
        l.native.toLowerCase().includes(localeSearch.toLowerCase()) ||
        l.code.includes(localeSearch.toLowerCase())
      )
    : LOCALES

  const close = useCallback(() => {
    setClosing(true)
    setTimeout(() => {
      setClosing(false)
      setConfirmDelete(false)
      setConfirmClear(false)
      setDangerMsg("")
      onClose()
    }, 240)
  }, [onClose])
  const setActiveLocale = (next: SupportedLocale) => { setLocale?.(next); i18n.setLocale(next) }

  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setClosing(false)
      setLocaleSearch("")
      setConfirmDelete(false)
      setConfirmClear(false)
      setDangerMsg("")
    }
  }

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") close() }
    document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [close, open])

  if (!open && !closing) return null

  const save = async () => {
    setSaving(true); setSaveMsg("")
    try {
      const { error } = await supabase.from("profiles").update({
        display_name: dname.trim().slice(0, 32),
        username: uname.trim().replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24),
      }).eq("id", profile.id)
      if (error) throw error
      setSaveMsg(i18n.t("common.saved"))
    } catch { setSaveMsg(i18n.t("common.failed")) }
    finally { setSaving(false) }
  }

  const saveOpenCloudKey = async () => {
    setSavingKey(true); setKeyMsg("")
    try {
      const val = openCloudKey.trim()
      if (val) { localStorage.setItem("vexa_open_cloud_key", val) } else { localStorage.removeItem("vexa_open_cloud_key") }
      try { await supabase.from("profiles").update({ open_cloud_api_key: val || null }).eq("id", profile.id) } catch {}
      setKeyMsg("API key saved")
    } catch { setKeyMsg("Failed to save") }
    finally { setSavingKey(false) }
  }

  const clearData = async () => {
    setDangerLoading("clear")
    setDangerMsg("")
    try {
      // Clear messages / conversation history for this user
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("user_id", profile.id)
      if (error) throw error
      setConfirmClear(false)
      setDangerMsg("Data cleared.")
    } catch {
      setDangerMsg("Failed to clear data. Please try again.")
    } finally {
      setDangerLoading(null)
    }
  }

  const deleteAccount = async () => {
    setDangerLoading("delete")
    setDangerMsg("")
    try {
      // Delete profile row — cascade should handle related data via FK constraints
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", profile.id)
      if (error) throw error

      // Sign out and redirect after deletion
      await supabase.auth.signOut()
      window.location.href = "/"
    } catch {
      setDangerLoading(null)
      setDangerMsg("Failed to delete account. Please try again.")
      setConfirmDelete(false)
    }
  }

  const inp: Properties = {
    width: "100%", height: 42, background: "rgba(255,255,255,.045)", border: "1px solid rgba(255,255,255,.09)",
    borderRadius: 11, padding: "0 14px", fontSize: 14, color: "#e8e9ec", fontFamily: "inherit", outline: "none",
    boxSizing: "border-box", transition: "border-color .2s",
  }

  const tabs = [
    { id: "appearance" as const, label: i18n.t("common.appearance"), icon: "bi-palette" },
    { id: "language" as const, label: i18n.t("common.language"), icon: "bi-translate" },
    { id: "account" as const, label: i18n.t("common.account"), icon: "bi-person" },
  ]

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: closing ? "gFadeOut .24s ease forwards" : "gFadeIn .18s ease forwards" }}>
      <button type="button" onClick={close} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.68)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "none", cursor: "default" }} />
      <div style={{ position: "relative", width: isMobile ? "calc(100vw - 24px)" : "min(480px, calc(100vw - 40px))", maxHeight: "88vh", ...glassModal, borderRadius: 24, overflow: "hidden", display: "flex", flexDirection: "column", animation: closing ? "gScaleOut .24s ease forwards" : "gScaleIn .3s cubic-bezier(.16,1,.3,1) forwards" }}>
        <div style={{ padding: "22px 22px 18px", borderBottom: "1px solid rgba(255,255,255,.07)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>{i18n.t("common.settings")}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.32)", marginTop: 3 }}>{i18n.t("settings.subtitle")}</div>
          </div>
          <button type="button" onClick={close} style={{ width: 30, height: 30, borderRadius: 9, ...glassPill, border: "1px solid rgba(255,255,255,.09)", color: "rgba(255,255,255,.38)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, transition: "all .18s ease" }}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div style={{ display: "flex", padding: "0 22px", borderBottom: "1px solid rgba(255,255,255,.07)", flexShrink: 0 }}>
          {tabs.map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 8px", background: "transparent", border: "none", cursor: "pointer", color: tab === t.id ? "#fff" : "rgba(255,255,255,.36)", fontWeight: tab === t.id ? 600 : 400, fontSize: 13, fontFamily: "inherit", borderBottom: tab === t.id ? "2px solid #fff" : "2px solid transparent", transition: "all .18s ease", marginBottom: -1, whiteSpace: "nowrap" }}>
              <i className={"bi " + t.icon} style={{ fontSize: 14 }} />{t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "4px 0 8px" }}>
          {tab === "appearance" && (
            <div style={{ padding: "16px 22px" }}>
              <ToggleRow icon="bi-wind" title={i18n.t("settings.reduceMotion")} sub={i18n.t("settings.reduceMotion.help")} value={reduceMotion ?? false} onChange={() => setReduceMotion?.(!reduceMotion)} />
              <ToggleRow icon="bi-layout-sidebar-inset" title={i18n.t("settings.compactMode")} sub={i18n.t("settings.compactMode.help")} value={compactMode ?? false} onChange={() => setCompactMode?.(!compactMode)} />
              <ToggleRow icon="bi-send" title={i18n.t("settings.sendOnEnter")} sub={isMobile ? i18n.t("settings.sendOnEnter.mobile") : i18n.t("settings.sendOnEnter.desktop")} value={sendOnEnter ?? true} onChange={() => { if (!isMobile) setSendOnEnter?.(!sendOnEnter) }} />
            </div>
          )}

          {tab === "language" && (
            <div style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 14 }}>
                <span style={{ fontSize: 26, lineHeight: 1 }}>{currentLocale.flag}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#e8e9ec" }}>{currentLocale.label}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,.35)", marginTop: 2 }}>{currentLocale.native} · {currentLocale.code.toUpperCase()}</div>
                </div>
                <div style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,.28)", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)", borderRadius: 6, padding: "3px 8px" }}>{i18n.t("common.active")}</div>
              </div>

              <div style={{ position: "relative" }}>
                <i className="bi bi-search" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "rgba(255,255,255,.26)", pointerEvents: "none" }} />
                <input value={localeSearch} onChange={e => setLocaleSearch(e.target.value)} placeholder={i18n.t("settings.searchLanguages")} style={{ ...inp, paddingLeft: 36 }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {filteredLocales.length === 0 && <div style={{ textAlign: "center", padding: "28px 0", fontSize: 13, color: "rgba(255,255,255,.28)" }}>{i18n.t("settings.noLanguages", { query: localeSearch })}</div>}
                {filteredLocales.map((l, i) => {
                  const isSelected = l.code === activeLocale
                  return (
                    <button key={l.code} type="button" onClick={() => setActiveLocale(l.code)} style={{ display: "flex", alignItems: "center", gap: 13, padding: "10px 13px", background: isSelected ? "rgba(255,255,255,.07)" : "transparent", border: isSelected ? "1px solid rgba(255,255,255,.13)" : "1px solid transparent", borderRadius: 12, cursor: "pointer", textAlign: "left", fontFamily: "inherit", width: "100%", transition: "all .15s ease", animation: `gSlideDown .22s ${i * 0.02}s cubic-bezier(.16,1,.3,1) both` }}>
                      <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{l.flag}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: isSelected ? 600 : 400, color: isSelected ? "#fff" : "#c9cbd4" }}>{l.label}</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,.30)", marginTop: 1 }}>{l.native}</div>
                      </div>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,.22)", fontFamily: "monospace", flexShrink: 0 }}>{l.code.toUpperCase()}</span>
                      {isSelected && <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, animation: "gBounceIn .25s cubic-bezier(.34,1.56,.64,1)" }}><circle cx="7.5" cy="7.5" r="6.5" stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" /><path d="M4.5 7.5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </button>
                  )
                })}
              </div>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,.22)", lineHeight: 1.6, margin: 0 }}>{i18n.t("settings.languageNote")}</p>
            </div>
          )}

          {tab === "account" && (
            <div style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: 15 }}>
              {/* Profile fields */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.38)", marginBottom: 7 }}>{i18n.t("settings.displayName")}</div>
                <input value={dname} onChange={e => setDname(e.target.value.slice(0, 32))} placeholder={i18n.t("settings.yourName")} style={inp} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.38)", marginBottom: 7 }}>{i18n.t("common.username")}</div>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,.28)", fontSize: 14 }}>@</span>
                  <input value={uname} onChange={e => setUname(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24))} placeholder={i18n.t("settings.handle")} style={{ ...inp, paddingLeft: 28 }} />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button type="button" onClick={save} disabled={saving} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", background: "linear-gradient(135deg, #fcd846 0%, #fcd846 50%, #ffe98a 100%)", color: "#060810", border: "none", borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1, fontFamily: "inherit", boxShadow: "0 6px 20px rgba(252,216,70,0.35)", transition: "opacity .2s, transform .2s cubic-bezier(.34,1.56,.64,1), box-shadow .2s" }}>
                  {saving ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", animation: "gSpin .7s linear infinite" }} /> : <><i className="bi bi-check-lg" style={{ fontSize: 13 }} />{i18n.t("common.save")}</>}
                </button>
                {saveMsg && <span style={{ fontSize: 12, color: saveMsg === i18n.t("common.failed") ? "#fc8181" : "rgba(255,255,255,.38)", animation: "gFadeIn .2s ease" }}>{saveMsg}</span>}
              </div>

              {/* Roblox Open Cloud API Key */}
              <div style={{ marginTop: 8, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                  <i className="bi bi-cloud" style={{ fontSize: 13, color: "#a78bfa" }} />
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#a78bfa" }}>Roblox Open Cloud</span>
                </div>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,.30)", lineHeight: 1.5, margin: "0 0 10px" }}>
                  API key lets Vexa create game passes, badges, developer products and upload assets to your games.
                </p>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.22)", lineHeight: 1.7, margin: "0 0 10px", padding: "10px 12px", background: "rgba(167,139,250,0.06)", borderRadius: 10, border: "1px solid rgba(167,139,250,0.10)" }}>
                  <div style={{ fontWeight: 600, color: "rgba(255,255,255,.40)", marginBottom: 4 }}>How to get your key:</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 2 }}><span style={{ color: "#a78bfa", fontWeight: 700, minWidth: 14 }}>1.</span> Go to <a href="https://create.roblox.com/dashboard/credentials" target="_blank" rel="noopener" style={{ color: "#a78bfa", textDecoration: "none" }}>Creator Dashboard &rarr;</a></div>
                  <div style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 2 }}><span style={{ color: "#a78bfa", fontWeight: 700, minWidth: 14 }}>2.</span> Click <b style={{ color: "rgba(255,255,255,.45)" }}>Create API Key</b></div>
                  <div style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 2 }}><span style={{ color: "#a78bfa", fontWeight: 700, minWidth: 14 }}>3.</span> Name it (e.g. &quot;Vexa AI&quot;)</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 2 }}><span style={{ color: "#a78bfa", fontWeight: 700, minWidth: 14 }}>4.</span> Enable: <b style={{ color: "rgba(255,255,255,.45)" }}>Game Passes, Badges, Developer Products</b></div>
                  <div style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 2 }}><span style={{ color: "#a78bfa", fontWeight: 700, minWidth: 14 }}>5.</span> Click <b style={{ color: "rgba(255,255,255,.45)" }}>Save &amp; Copy Key</b></div>
                  <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}><span style={{ color: "#a78bfa", fontWeight: 700, minWidth: 14 }}>6.</span> Paste it below and click <b style={{ color: "rgba(255,255,255,.45)" }}>Save Key</b></div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="password"
                    value={openCloudKey}
                    onChange={e => setOpenCloudKey(e.target.value)}
                    placeholder="Paste your Open Cloud API key"
                    style={{ ...inp, flex: 1, fontFamily: "monospace", fontSize: 12 }}
                  />
                  <button
                    type="button"
                    onClick={saveOpenCloudKey}
                    disabled={savingKey}
                    style={{ padding: "9px 14px", background: "rgba(167,139,250,0.15)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.30)", borderRadius: 11, fontSize: 12, fontWeight: 600, cursor: savingKey ? "not-allowed" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap", transition: "all .18s ease" }}
                  >
                    {savingKey ? "Saving..." : "Save Key"}
                  </button>
                </div>
                {keyMsg && <span style={{ fontSize: 12, color: keyMsg.includes("Failed") ? "#fc8181" : "rgba(255,255,255,.38)", marginTop: 6, display: "block", animation: "gFadeIn .2s ease" }}>{keyMsg}</span>}
              </div>

              {/* Danger Zone */}
              <div style={{ marginTop: 8, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
                  <i className="bi bi-shield-exclamation" style={{ fontSize: 13, color: "rgba(239,68,68,0.55)" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(239,68,68,0.55)" }}>Danger Zone</span>
                </div>

                {/* Clear Data */}
                <div style={{ padding: "13px 15px", background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 13, marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                      <i className="bi bi-trash3" style={{ fontSize: 15, color: "rgba(255,255,255,.32)", width: 20, textAlign: "center" }} />
                      <div>
                        <div style={{ fontSize: 14, color: "#e8e9ec", fontWeight: 500 }}>Clear data</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,.28)", marginTop: 2 }}>Delete all your messages and history</div>
                      </div>
                    </div>
                    {!confirmClear && (
                      <button
                        type="button"
                        onClick={() => { setConfirmClear(true); setConfirmDelete(false); setDangerMsg("") }}
                        style={{ padding: "6px 13px", background: "transparent", color: "rgba(255,255,255,.45)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 9, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", transition: "all .18s ease" }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {confirmClear && (
                    <ConfirmBanner
                      icon="bi-exclamation-triangle-fill"
                      message="This will permanently delete all your messages and conversation history. This cannot be undone."
                      phrase="clear my data"
                      confirmLabel="Yes, clear everything"
                      onConfirm={clearData}
                      onCancel={() => setConfirmClear(false)}
                      loading={dangerLoading === "clear"}
                    />
                  )}
                </div>

                {/* Delete Account */}
                <div style={{ padding: "13px 15px", background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.14)", borderRadius: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                      <i className="bi bi-person-x" style={{ fontSize: 15, color: "rgba(239,68,68,0.6)", width: 20, textAlign: "center" }} />
                      <div>
                        <div style={{ fontSize: 14, color: "#fca5a5", fontWeight: 500 }}>Delete account</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,.28)", marginTop: 2 }}>Permanently remove your account</div>
                      </div>
                    </div>
                    {!confirmDelete && (
                      <button
                        type="button"
                        onClick={() => { setConfirmDelete(true); setConfirmClear(false); setDangerMsg("") }}
                        style={{ padding: "6px 13px", background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", transition: "all .18s ease" }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  {confirmDelete && (
                    <ConfirmBanner
                      icon="bi-exclamation-octagon-fill"
                      message="Your account and all associated data will be permanently deleted. You will be signed out immediately. This cannot be undone."
                      phrase="delete my account"
                      confirmLabel="Yes, delete my account"
                      onConfirm={deleteAccount}
                      onCancel={() => setConfirmDelete(false)}
                      loading={dangerLoading === "delete"}
                    />
                  )}
                </div>

                {dangerMsg && (
                  <p style={{ margin: "10px 0 0", fontSize: 12, color: dangerMsg.includes("Failed") ? "#f87171" : "rgba(255,255,255,.38)", animation: "gFadeIn .2s ease" }}>
                    {dangerMsg}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes gSpin { to { transform: rotate(360deg) } }
        @keyframes gFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes gFadeOut { from { opacity: 1 } to { opacity: 0 } }
        @keyframes gScaleIn { from { opacity: 0; transform: scale(0.94) translateY(8px) } to { opacity: 1; transform: scale(1) translateY(0) } }
        @keyframes gScaleOut { from { opacity: 1; transform: scale(1) translateY(0) } to { opacity: 0; transform: scale(0.94) translateY(6px) } }
        @keyframes gSlideDown { from { opacity: 0; transform: translateY(-8px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes gBounceIn { from { opacity: 0; transform: scale(.8) } to { opacity: 1; transform: scale(1) } }
      `}</style>
    </div>
  )
}