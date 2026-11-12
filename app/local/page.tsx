"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import LandingStar from "@/app/components/LandingStar";
import ModelInstallerModal from "@/app/components/ModelInstallerModal";
import Settings from "@/app/components/Settings";
import { useI18n } from "@/app/localization/client";
import type { Profile } from "@/lib/supabase";

const INTER = "'Space Grotesk', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const DISPLAY = "'Space Grotesk', Inter, -apple-system, sans-serif";
const SB_URL = "https://urenbjultzmpmamcaogv.supabase.co";
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const LEMON = "#6366f1";
const LEMON_BRIGHT = "#818cf8";

interface LocalProject {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  place_id?: number | null;
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function getProjectsKey(): string {
  if (typeof window === "undefined") return "";
  const u = localStorage.getItem("gx_sb_user_id");
  return u ? `gx_projects_${u}` : "";
}

function loadProjects(): LocalProject[] {
  if (typeof window === "undefined") return [];
  const key = getProjectsKey();
  if (!key) return [];
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function saveProjects(projects: LocalProject[]) {
  if (typeof window === "undefined") return;
  const key = getProjectsKey();
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(projects));
}

function migrateProjects(u: string) {
  if (typeof window === "undefined") return;
  const scopedKey = `gx_projects_${u}`;
  if (localStorage.getItem(scopedKey) === null) {
    localStorage.setItem(scopedKey, "[]");
  }
  localStorage.removeItem("gx_projects");
}

// ── Offline local accounts (used when the cloud backend is unreachable).
// Everything stays on this machine: email + SHA-256 password hash + flags.
interface LocalUser { id: string; email: string; passHash: string; is_admin: boolean; created_at: string }

const ADMIN_EMAIL = "admin@vexa.local";
const ADMIN_PASS = "Vexa-Admin-2026";

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function getLocalUsers(): LocalUser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem("gx_local_users") || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}

function saveLocalUsers(users: LocalUser[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("gx_local_users", JSON.stringify(users));
}

function findLocalUser(email: string): LocalUser | undefined {
  const e = email.trim().toLowerCase();
  return getLocalUsers().find(u => u.email.toLowerCase() === e);
}

function isLocalAdmin(id: string): boolean {
  if (typeof window === "undefined") return false;
  return !!getLocalUsers().find(u => u.id === id && u.is_admin);
}

async function seedAdminIfNeeded(): Promise<void> {
  if (typeof window === "undefined") return;
  const users = getLocalUsers();
  if (users.some(u => u.is_admin)) return;
  const passHash = await sha256(ADMIN_PASS);
  users.push({ id: "admin-local-1", email: ADMIN_EMAIL, passHash, is_admin: true, created_at: new Date().toISOString() });
  saveLocalUsers(users);
  migrateProjects("admin-local-1");
}

async function supabaseReachable(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { apikey: SB_KEY, Authorization: "Bearer invalid-probe" },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return res.status === 401 || res.status === 403 || res.ok;
  } catch { return false; }
}

function signInLocal(u: LocalUser, setUserEmail: (e: string) => void, setProjects: (p: LocalProject[]) => void, setLoggedIn: (b: boolean) => void) {
  localStorage.setItem("gx_sb_user_id", u.id);
  localStorage.setItem("gx_sb_email", u.email);
  localStorage.setItem("gx_local_session", u.id);
  localStorage.removeItem("gx_sb_token");
  localStorage.removeItem("gx_sb_refresh");
  migrateProjects(u.id);
  setUserEmail(u.email);
  setProjects(loadProjects());
  setLoggedIn(true);
}

type SortKey = "updated" | "created" | "name";

function NewProjectModal({ open, onClose, onCreate, creating }: { open: boolean; onClose: () => void; onCreate: (name: string) => void; creating: boolean }) {
  const [name, setName] = useState("");
  const [closing, setClosing] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  const inputRef = useRef<HTMLInputElement>(null);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setClosing(false);
      setName("");
    }
  }

  const close = useCallback(() => { setClosing(true); setTimeout(() => { setClosing(false); setName(""); onClose(); }, 220); }, [onClose]);
  const submit = () => { if (!name.trim() || creating) return; onCreate(name.trim().slice(0, 32)); };
  useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => { if (e.key === "Escape") close(); }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, [close, open]);
  useEffect(() => { if (!open) return; setTimeout(() => inputRef.current?.focus(), 80); }, [open]);
  if (!open && !closing) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: closing ? "gFadeOut .22s ease forwards" : "gFadeIn .18s ease forwards" }}>
      <button type="button" onClick={close} style={{ position: "absolute", inset: 0, background: "rgba(4,10,16,0.55)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "none", cursor: "default" }} />
      <div style={{ position: "relative", width: "min(480px,calc(100vw - 32px))", background: "rgba(13,16,21,0.98)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 24px 80px rgba(0,0,0,0.55)", borderRadius: 22, overflow: "hidden", animation: closing ? "gScaleOut .22s ease forwards" : "gScaleIn .3s cubic-bezier(.16,1,.3,1) forwards" }}>
        <div style={{ padding: "22px 22px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>New project</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.4)", marginTop: 3 }}>Give your project a name to get started</div>
          </div>
          <button type="button" onClick={close} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,.5)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div style={{ padding: "18px 22px 14px" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Project name</label>
          <input ref={inputRef} value={name} onChange={e => setName(e.target.value.slice(0, 32))} onKeyDown={e => e.key === "Enter" && submit()} placeholder="e.g. Combat System, Admin Panel..." maxLength={32} style={{ width: "100%", height: 42, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.10)", borderRadius: 11, padding: "0 14px", fontSize: 14, color: "#fff", fontFamily: "inherit", outline: "none" }} />
        </div>
        <div style={{ height: 1, background: "rgba(255,255,255,.07)", margin: "0 22px" }} />
        <div style={{ padding: "14px 22px 20px" }}>
          <button type="button" onClick={submit} disabled={creating || !name.trim()} style={{ width: "100%", height: 44, borderRadius: 12, background: name.trim() ? `linear-gradient(135deg, ${LEMON_BRIGHT} 0%, ${LEMON} 60%, #4338ca 100%)` : "rgba(255,255,255,0.06)", border: "none", fontSize: 14, fontWeight: 800, color: name.trim() ? "#141005" : "rgba(255,255,255,0.3)", cursor: name.trim() && !creating ? "pointer" : "not-allowed", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: name.trim() ? "0 8px 28px rgba(252,216,70,0.40)" : "none" }}>
            {creating ? <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(0,0,0,.15)", borderTopColor: "rgba(0,0,0,.6)", animation: "gSpin .7s linear infinite" }} /> : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>Create project</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ open, projectName, onConfirm, onCancel }: { open: boolean; projectName: string; onConfirm: () => void; onCancel: () => void }) {
  const [closing, setClosing] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setClosing(false);
  }

  const close = useCallback(() => { setClosing(true); setTimeout(() => { setClosing(false); onCancel(); }, 220); }, [onCancel]);
  useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => { if (e.key === "Escape") close(); }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, [close, open]);
  if (!open && !closing) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: closing ? "gFadeOut .22s ease forwards" : "gFadeIn .18s ease forwards" }}>
      <button type="button" onClick={close} style={{ position: "absolute", inset: 0, background: "rgba(4,10,16,0.55)", backdropFilter: "blur(14px)", border: "none", cursor: "default" }} />
      <div style={{ position: "relative", width: "min(400px,calc(100vw - 40px))", background: "rgba(13,16,21,0.98)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 24px 80px rgba(0,0,0,0.55)", borderRadius: 20, overflow: "hidden", animation: closing ? "gScaleOut .22s ease forwards" : "gScaleIn .28s cubic-bezier(.16,1,.3,1) forwards" }}>
        <div style={{ padding: "24px 24px 20px" }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(252,129,129,.10)", border: "1px solid rgba(252,129,129,.20)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fc8181" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, letterSpacing: "-0.02em", color: "#fff" }}>Delete project?</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.55 }}><span style={{ color: "rgba(255,255,255,.8)", fontWeight: 600 }}>{projectName}</span> will be permanently deleted.</div>
        </div>
        <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />
        <div style={{ display: "flex", gap: 10, padding: "16px 24px" }}>
          <button type="button" onClick={close} style={{ flex: 1, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,.75)", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button type="button" onClick={onConfirm} style={{ flex: 1, height: 40, borderRadius: 10, background: "rgba(252,129,129,.14)", border: "1px solid rgba(252,129,129,.28)", fontSize: 14, fontWeight: 700, color: "#fc8181", cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

type RojoStatus = {
  installed?: boolean;
  running?: boolean;
  version?: string | null;
  port?: number;
  url?: string;
  workspace?: string;
  error?: string | null;
};

type RojoApi = {
  status: () => Promise<RojoStatus>;
  start: () => Promise<RojoStatus & { ok?: boolean; error?: string }>;
  stop: () => Promise<unknown>;
  openWorkspace: () => Promise<{ ok?: boolean; dir?: string }>;
};

function rojoApi(): RojoApi | null {
  if (typeof window === "undefined") return null;
  const api = (window as Window & { electronAPI?: { rojo?: RojoApi } }).electronAPI;
  return api?.rojo ?? null;
}

function ConnectStudioModal({ open, onClose, onConnected }: { open: boolean; onClose: () => void; onConnected: (status: string) => void }) {
  const [closing, setClosing] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<{ ok: boolean; running: boolean; text: string }>({ ok: false, running: false, text: "Controllo Rojo…" });
  const [prevOpen, setPrevOpen] = useState(open);
  const [attempt, setAttempt] = useState(0);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) { setClosing(false); setChecking(true); setState({ ok: false, running: false, text: "Controllo Rojo…" }); }
  }

  const close = useCallback(() => { setClosing(true); setTimeout(() => { setClosing(false); onClose(); }, 220); }, [onClose]);
  useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => { if (e.key === "Escape") close(); }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, [close, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const check = async () => {
      await Promise.resolve();
      if (cancelled) return;
      setChecking(true);
      const api = rojoApi();
      if (!api) {
        setState({ ok: false, running: false, text: "Apri l'app desktop Vexa: Rojo gira solo nella versione installata." });
        setChecking(false);
        return;
      }
      try {
        const s = await api.status();
        if (cancelled) return;
        if (!s.installed) {
          setState({ ok: false, running: false, text: "Rojo non è installato su questo PC. Installalo con aftman/rokit o da rojo.space, poi premi Re-check." });
        } else if (s.running) {
          setState({ ok: true, running: true, text: `Server Rojo attivo su ${s.url ?? "localhost:34872"}. In Studio apri il plugin Rojo, premi Connect e inserisci quell'indirizzo.` });
          onConnected("rojo");
        } else {
          setState({ ok: false, running: false, text: `Rojo ${s.version ? s.version + " " : ""}rilevato ma spento. Premi "Avvia Rojo" per aprire il server locale sulla porta ${s.port ?? 34872}.` });
        }
      } catch {
        if (!cancelled) setState({ ok: false, running: false, text: "Impossibile leggere lo stato di Rojo. Riavvia l'app." });
      } finally { if (!cancelled) setChecking(false); }
    };
    check();
    return () => { cancelled = true; };
  }, [open, attempt, onConnected]);

  const startRojo = async () => {
    const api = rojoApi();
    if (!api) { setAttempt(v => v + 1); return; }
    setBusy(true);
    try { await api.start(); } catch { /* status check below shows the reason */ }
    setBusy(false);
    setAttempt(v => v + 1);
  };

  const stopRojo = async () => {
    const api = rojoApi();
    if (!api) return;
    setBusy(true);
    try { await api.stop(); } catch { /* ignore */ }
    setBusy(false);
    setAttempt(v => v + 1);
  };

  if (!open && !closing) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: closing ? "gFadeOut .22s ease forwards" : "gFadeIn .18s ease forwards" }}>
      <button type="button" onClick={close} style={{ position: "absolute", inset: 0, background: "rgba(4,10,16,0.55)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "none", cursor: "default" }} />
      <div style={{ position: "relative", width: "min(440px,calc(100vw - 32px))", background: "rgba(13,16,21,0.98)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 24px 80px rgba(0,0,0,0.55)", borderRadius: 22, overflow: "hidden", animation: closing ? "gScaleOut .22s ease forwards" : "gScaleIn .3s cubic-bezier(.16,1,.3,1) forwards" }}>
        <div style={{ padding: "22px 22px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>Connetti a Studio</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.4)", marginTop: 3 }}>Sync dei file con Roblox Studio via Rojo</div>
          </div>
          <button type="button" onClick={close} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,.5)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div style={{ padding: "22px 22px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
          {checking ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "rgba(255,255,255,.5)", fontSize: 13 }}>
              <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,.12)", borderTopColor: "rgba(255,255,255,.65)", animation: "gSpin .7s linear infinite" }} />
              {state.text}
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: state.ok ? "#4ade80" : state.running ? "#f59e0b" : "#3f3f46", flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: state.ok ? "#4ade80" : state.running ? "#f59e0b" : "rgba(255,255,255,.55)" }}>
                  {state.ok ? "Rojo attivo" : state.running ? "Rojo in avvio" : "Rojo spento"}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)", lineHeight: 1.5 }}>{state.text}</div>
              {!state.ok && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 16px", background: "rgba(255,255,255,0.04)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", fontSize: 13, color: "rgba(255,255,255,.65)", lineHeight: 1.6 }}>
                  <span><b style={{ color: "#fff" }}>1.</b> Installa Rojo (aftman/rokit oppure rojo.space). Vexa lo rileva da solo.</span>
                  <span><b style={{ color: "#fff" }}>2.</b> Premi <b style={{ color: "#fff" }}>Avvia Rojo</b>: parte il server locale sulla porta 34872.</span>
                  <span><b style={{ color: "#fff" }}>3.</b> In Studio apri il plugin Rojo, premi <b style={{ color: "#fff" }}>Connect</b> e inserisci <b style={{ color: "#fff" }}>localhost:34872</b>.</span>
                </div>
              )}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {!state.ok && (
                  <button type="button" onClick={startRojo} disabled={busy} style={{ flex: 1, minWidth: 130, padding: "12px 18px", background: `linear-gradient(135deg, ${LEMON_BRIGHT} 0%, ${LEMON} 60%, #4338ca 100%)`, color: "#141005", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: busy ? "wait" : "pointer", fontFamily: "inherit", boxShadow: "0 6px 24px rgba(99,102,241,0.40)", opacity: busy ? 0.7 : 1 }}>
                    {busy ? "Avvio…" : "Avvia Rojo"}
                  </button>
                )}
                <button type="button" onClick={() => setAttempt(v => v + 1)} style={{ flex: 1, minWidth: 100, padding: "12px 18px", background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,.85)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  Re-check
                </button>
                {state.ok && (
                  <button type="button" onClick={stopRojo} disabled={busy} style={{ padding: "12px 18px", background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,.85)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: busy ? "wait" : "pointer", fontFamily: "inherit" }}>
                    Ferma
                  </button>
                )}
                <button type="button" onClick={() => { rojoApi()?.openWorkspace().catch(() => {}); }} style={{ padding: "12px 18px", background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,.85)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  Cartella
                </button>
                <button type="button" onClick={close} style={{ padding: "12px 18px", background: "transparent", color: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  Chiudi
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LocalDashboard() {
  const [showModelWizard, setShowModelWizard] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [regEmail, setRegEmail] = useState("");
  const [regPass, setRegPass] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState("");
  const [regNotice, setRegNotice] = useState("");
  const [regStep, setRegStep] = useState<"form" | "code">("form");
  const [regCode, setRegCode] = useState("");
  const [regCodeError, setRegCodeError] = useState("");
  const [regCodeLoading, setRegCodeLoading] = useState(false);
  const [regDevCode, setRegDevCode] = useState("");
  const [regCooldown, setRegCooldown] = useState(0);
  const [projects, setProjects] = useState<LocalProject[]>(() => loadProjects());
  const [newOpen, setNewOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState("");
  const [search, setSearch] = useState("");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [loadingProject, setLoadingProject] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [studioConnected, setStudioConnected] = useState(false);
  const [modelList, setModelList] = useState<{ id: string; name: string; provider?: string; kind?: string }[]>([]);
  const [modelDefault, setModelDefault] = useState("");
  const [modelBackends, setModelBackends] = useState<{ local_llm?: string | null; hunyuan3d?: string | null; trellis?: string | null }>({});
  const [selModel, setSelModel] = useState(() => {
    try {
      const s = localStorage.getItem("gx_model") || "";
      return s === "vexa-team" || s === "local/qwen3-8b" || s === "hunyuan3d-2.1" ? s : "vexa-team";
    } catch { return "vexa-team"; }
  });
  const [modelOpen, setModelOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [listOpen, setListOpen] = useState(true);
  const [sortDesc, setSortDesc] = useState(true);
  const [acctMenuOpen, setAcctMenuOpen] = useState(false);
  const [projMenuOpen, setProjMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [sendOnEnter, setSendOnEnter] = useState(true);
  const [compactMode, setCompactMode] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const acctMenuRef = useRef<HTMLDivElement>(null);
  const projMenuRef = useRef<HTMLDivElement>(null);
  const { locale, setLocale } = useI18n();

  const meProfile = useMemo<Profile>(() => ({
    id: typeof window !== "undefined" ? (localStorage.getItem("gx_sb_user_id") || "local-user") : "local-user",
    username: (userEmail || "user").split("@")[0],
    display_name: (userEmail || "user").split("@")[0],
    avatar_url: null, roblox_user_id: null, open_cloud_api_key: null,
    discord_id: null, discord_username: null, discord_avatar: null,
    is_admin: false, created_at: new Date().toISOString(),
  }), [userEmail]);

  useEffect(() => {
    const tryRefresh = async () => {
      const online = await supabaseReachable();
      if (!online) {
        // Cloud is gone: work fully offline with local accounts.
        await seedAdminIfNeeded();
        const sessionId = localStorage.getItem("gx_local_session") || "";
        const me = getLocalUsers().find(u => u.id === sessionId);
        if (me) {
          setUserEmail(me.email);
          setProjects(loadProjects());
          setLoggedIn(true);
        } else {
          setLoggedIn(false);
        }
        setAuthChecked(true);
        return;
      }
      const token = localStorage.getItem("gx_sb_token");
      const refresh = localStorage.getItem("gx_sb_refresh");
      if (token && refresh) {
        try {
          const res = await fetch(`${SB_URL}/auth/v1/token?grant_type=refresh_token`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: SB_KEY },
            body: JSON.stringify({ refresh_token: refresh }),
          });
          const data = await res.json();
          if (res.ok && data.access_token) {
            localStorage.setItem("gx_sb_token", data.access_token);
            localStorage.setItem("gx_sb_refresh", data.refresh_token);
            const u = data.user?.id || "";
            if (u) {
              localStorage.setItem("gx_sb_user_id", u);
              migrateProjects(u);
            }
            if (data.user?.email) {
              localStorage.setItem("gx_sb_email", data.user.email);
              setUserEmail(data.user.email);
            }
          } else {
            localStorage.removeItem("gx_sb_token");
            localStorage.removeItem("gx_sb_refresh");
          }
        } catch {
          // Keep existing token on network error
        }
      }
      setLoggedIn(!!localStorage.getItem("gx_sb_token"));
      setUserEmail(localStorage.getItem("gx_sb_email") || "");
      setAuthChecked(true);
      if (localStorage.getItem("gx_sb_token")) setProjects(loadProjects());
    };
    tryRefresh();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginLoading) return;
    setLoginLoading(true);
    setLoginError("");
    const localFallback = async (): Promise<boolean> => {
      await seedAdminIfNeeded();
      const u = findLocalUser(loginEmail);
      if (!u) { setLoginError("No local account with this email. Register first."); return false; }
      const h = await sha256(loginPass);
      if (h !== u.passHash) { setLoginError("Invalid email or password"); return false; }
      signInLocal(u, setUserEmail, setProjects, setLoggedIn);
      return true;
    };
    try {
      const res = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SB_KEY },
        body: JSON.stringify({ email: loginEmail, password: loginPass }),
      });
      const data = await res.json();
      if (!res.ok || !data.access_token) {
        setLoginError(data.error_description || data.msg || "Invalid email or password");
        setLoginLoading(false);
        return;
      }
      localStorage.setItem("gx_sb_token", data.access_token);
      localStorage.setItem("gx_sb_refresh", data.refresh_token);
      const u = data.user?.id || "";
      if (u) {
        localStorage.setItem("gx_sb_user_id", u);
        migrateProjects(u);
      }
      if (data.user?.email) {
        localStorage.setItem("gx_sb_email", data.user.email);
        setUserEmail(data.user.email);
      }
      setProjects(loadProjects());
      setLoggedIn(true);
    } catch {
      // Cloud unreachable: fall back to offline local accounts.
      try { await localFallback(); } catch { setLoginError("Login failed"); }
    }
    setLoginLoading(false);
  };

  const sendRegCode = async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: regEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRegError(data.error || "Invio codice fallito");
        return false;
      }
      setRegDevCode(data.devCode || "");
      setRegStep("code");
      setRegCode("");
      setRegCodeError("");
      setRegCooldown(30);
      return true;
    } catch {
      setRegError("Invio codice fallito");
      return false;
    }
  };

  useEffect(() => {
    if (regCooldown <= 0) return;
    const t = setTimeout(() => setRegCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [regCooldown]);

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regCodeLoading) return;
    setRegCodeLoading(true);
    setRegCodeError("");
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: regEmail, code: regCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRegCodeError(data.error || "Verifica fallita");
        setRegCodeLoading(false);
        return;
      }
      await seedAdminIfNeeded();
      if (findLocalUser(regEmail)) {
        setRegCodeError("Esiste già un account con questa email. Accedi.");
        setRegCodeLoading(false);
        return;
      }
      const now = new Date().toISOString();
      const u: LocalUser = { id: uid(), email: regEmail.trim(), passHash: await sha256(regPass), is_admin: false, created_at: now };
      const users = getLocalUsers();
      users.push(u);
      saveLocalUsers(users);
      signInLocal(u, setUserEmail, setProjects, setLoggedIn);
    } catch { setRegCodeError("Verifica fallita"); }
    setRegCodeLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regLoading) return;
    setRegLoading(true);
    setRegError("");
    setRegNotice("");
    const localFallback = async (): Promise<boolean> => {
      return sendRegCode();
    };
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: regEmail, password: regPass }),
      });
      const data = await res.json();
      if (!res.ok) {
        // The API route itself failed to reach the cloud (dead backend):
        // fall back to an offline local account instead of erroring.
        if (/fetch failed|failed to fetch|network|ENOTFOUND|ECONNREFUSED|timeout|timed out/i.test(data.error || "")) {
          try {
            if (await localFallback()) { setRegLoading(false); return; }
          } catch { /* fall through to error below */ }
          setRegLoading(false);
          return;
        }
        setRegError(data.error || "Registration failed");
        setRegLoading(false);
        return;
      }
      if (data.needs_confirmation || !data.access_token) {
        setRegNotice("Account created! Check your email for the confirmation link, then sign in.");
        setRegLoading(false);
        return;
      }
      localStorage.setItem("gx_sb_token", data.access_token);
      localStorage.setItem("gx_sb_refresh", data.refresh_token);
      const u = data.user?.id || "";
      if (u) {
        localStorage.setItem("gx_sb_user_id", u);
        migrateProjects(u);
      }
      if (data.user?.email) {
        localStorage.setItem("gx_sb_email", data.user.email);
        setUserEmail(data.user.email);
      }
      setProjects(loadProjects());
      setLoggedIn(true);
    } catch {
      // Cloud unreachable: create an offline local account instead.
      try { await localFallback(); } catch { setRegError("Registration failed"); }
    }
    setRegLoading(false);
  };

  useEffect(() => {
    let dead = false;
    fetch("/models", { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        if (dead) return;
        if (Array.isArray(d.models)) setModelList(d.models);
        if (typeof d.default === "string") setModelDefault(d.default);
        if (d.backends && typeof d.backends === "object") setModelBackends(d.backends);
      })
      .catch(() => {});
    return () => { dead = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const api = rojoApi();
      if (!api) { if (!cancelled) setStudioConnected(false); return; }
      try {
        const s = await api.status();
        if (!cancelled) setStudioConnected(s.running === true);
      } catch { if (!cancelled) setStudioConnected(false); }
    };
    check(); const iv = setInterval(check, 30000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  useEffect(() => {
    try {
      setTimeout(() => {
        setReduceMotion(localStorage.getItem("vexa_reduce_motion") === "true");
        setSendOnEnter(localStorage.getItem("vexa_send_on_enter") !== "false");
        setCompactMode(localStorage.getItem("vexa_compact_mode") === "true");
      }, 0)
    } catch {}
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (acctMenuRef.current && !acctMenuRef.current.contains(e.target as Node)) setAcctMenuOpen(false);
      if (projMenuRef.current && !projMenuRef.current.contains(e.target as Node)) setProjMenuOpen(false);
    };
    if (acctMenuOpen || projMenuOpen) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [acctMenuOpen, projMenuOpen]);

  useEffect(() => {
    const el = promptRef.current; if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(Math.max(el.scrollHeight, 54), 220) + "px";
  }, [prompt]);

  useEffect(() => {
    const api = (window as Window & { electronAPI?: { models?: { status: () => Promise<{ hasAny: boolean }> } } }).electronAPI;
    if (!api?.models) return;
    api.models.status().then(s => { if (!s.hasAny) setShowModelWizard(true); }).catch(() => {});
  }, []);

  const shortName = (id: string) => (id.includes("/") ? id.split("/").pop() as string : id);

  const modelOptions = (() => {
    const opts: { id: string; label: string; sub: string; disabled?: boolean }[] = [
      { id: "vexa-team", label: "Vexa Team", sub: "qwen · hunyuan · team" },
      { id: "local/qwen3-8b", label: "Qwen 3", sub: modelBackends.local_llm ? "local · online · free" : "local · free" },
    ];
    const hunyuanAlive = modelList.some(m => m.id === "hunyuan3d-2.1") || !!modelBackends.hunyuan3d;
    if (hunyuanAlive) opts.push({ id: "hunyuan3d-2.1", label: "Hunyuan3D 2.1", sub: "local 3D · online" });
    else opts.push({ id: "hunyuan3d-2.1", label: "Hunyuan3D 2.1", sub: "local 3D · offline", disabled: true });
    return opts;
  })();

  const selLabel = (() => {
    const found = modelOptions.find(o => o.id === selModel && !o.disabled);
    if (found) return found.label;
    return "Vexa Team";
  })();

  const pickModel = (id: string) => {
    setSelModel(id);
    try { localStorage.setItem("gx_model", id); } catch {}
    setModelOpen(false);
  };

  const handleSignOut = () => {
    localStorage.removeItem("gx_sb_token");
    localStorage.removeItem("gx_sb_refresh");
    localStorage.removeItem("gx_sb_user_id");
    localStorage.removeItem("gx_sb_email");
    localStorage.removeItem("gx_local_session");
    setProjects([]);
    setUserEmail("");
    setLoggedIn(false);
  };

  const displayed = (() => {
    let list = [...projects];
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter(p => p.name.toLowerCase().includes(q)); }
    const ts = (p: LocalProject) => new Date(p.updated_at || p.created_at || "").getTime();
    list.sort((a, b) => sortDesc ? ts(b) - ts(a) : ts(a) - ts(b));
    return list;
  })();

  const createAndOpen = (name: string, description?: string, autostart?: boolean) => {
    const now = new Date().toISOString();
    const project: LocalProject = { id: uid(), name, description, created_at: now, updated_at: now };
    const updated = [project, ...projects];
    setProjects(updated); saveProjects(updated);
    if (autostart) { try { localStorage.setItem(`gx_autostart_${project.id}`, "1"); } catch {} }
    openProject(project.id);
    return project;
  };

  const handleCreate = (name: string, description?: string) => {
    setCreating(true);
    createAndOpen(name, description);
    setNewOpen(false); setCreating(false);
  };

  const submitPrompt = () => {
    const text = prompt.trim();
    if (!text || generating) return;
    setGenerating(true);
    try {
      const name = text.length > 32 ? text.slice(0, 32) : text;
      createAndOpen(name, text, true);
      setPrompt("");
    } finally {
      setGenerating(false);
    }
  };

  const promptDelete = (id: string, name: string) => { setDeleteId(id); setDeleteName(name); setDeleteOpen(true); };
  const confirmDelete = () => { if (!deleteId) return; const updated = projects.filter(p => p.id !== deleteId); setProjects(updated); saveProjects(updated); setDeleteOpen(false); setDeleteId(null); setDeleteName(""); };

  const openProject = (id: string) => { setLoadingProject(true); setTimeout(() => { window.location.href = `/project/${id}`; }, 800); };

  if (!authChecked) {
    return (
      <div style={{ minHeight: "100vh", background: "#101013", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: INTER }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid rgba(255,255,255,.25)", borderTopColor: "#fff", animation: "gSpin .75s linear infinite" }} />
        <style>{`@keyframes gSpin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: ${INTER}; -webkit-font-smoothing: antialiased; color: #ececec; background: #101013; }
          ::placeholder { color: rgba(255,255,255,0.30); }
          input:focus { outline: none; border-color: rgba(252,216,70,0.55) !important; box-shadow: 0 0 0 3px rgba(252,216,70,0.14) !important; }
          @keyframes gSpin { to { transform: rotate(360deg) } }
          @keyframes gCardIn { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
          .lm-auth-btn:hover { filter: brightness(1.07); }
          .lm-auth-btn:active { transform: scale(0.99); }
        `}</style>
        <div style={{ minHeight: "100vh", background: "radial-gradient(60% 40% at 50% 0%, rgba(252,216,70,0.05) 0%, rgba(252,216,70,0) 70%), #101013", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: INTER }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 26 }}>
            <img src="/icons/vexa-mark-cream.png" alt="Vexa" width={48} height={48} style={{ objectFit: "contain", borderRadius: 13 }} />
          </div>
          <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 33, color: "#fff", textAlign: "center", marginBottom: 30, letterSpacing: "-0.01em" }}>{!showRegister ? "Accedi" : "Crea account"}</div>
          <div style={{ width: "100%", maxWidth: 400, background: "#17171b", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 20, padding: 28, boxShadow: "0 24px 80px rgba(0,0,0,0.5)", animation: "gCardIn .45s cubic-bezier(.16,1,.3,1) both" }}>
            {!showRegister ? (
              <>
                {loginError && <div style={{ padding: "10px 14px", background: "rgba(245,101,101,0.08)", border: "1px solid rgba(245,101,101,0.25)", borderRadius: 10, color: "#fc8181", fontSize: 13, marginBottom: 12, textAlign: "center" }}>{loginError}</div>}
                <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="Inserisci la tua email" required style={{ width: "100%", height: 46, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, padding: "0 15px", fontSize: 14, color: "#fff", fontFamily: "inherit", outline: "none" }} />
                  <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} placeholder="Password" required style={{ width: "100%", height: 46, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, padding: "0 15px", fontSize: 14, color: "#fff", fontFamily: "inherit", outline: "none" }} />
                  <button type="submit" disabled={loginLoading} className="lm-auth-btn" style={{ height: 48, borderRadius: 12, background: `linear-gradient(135deg, ${LEMON_BRIGHT} 0%, ${LEMON} 60%, #4338ca 100%)`, border: "none", fontSize: 14.5, fontWeight: 800, color: "#141005", cursor: loginLoading ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: "0 8px 28px rgba(252,216,70,0.30)", opacity: loginLoading ? 0.6 : 1, transition: "all .18s ease" }}>
                    {loginLoading ? "Accesso..." : "Continua con email"}
                  </button>
                </form>
                <p style={{ marginTop: 16, fontSize: 13, color: "rgba(255,255,255,0.40)", textAlign: "center" }}>
                  Non hai un account?{" "}
                  <button type="button" onClick={() => { setShowRegister(true); setRegStep("form"); setRegError(""); setRegCodeError(""); }} style={{ background: "none", border: "none", color: LEMON, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>Registrati</button>
                </p>
              </>
            ) : (
              <>
                {regError && <div style={{ padding: "10px 14px", background: "rgba(245,101,101,0.08)", border: "1px solid rgba(245,101,101,0.25)", borderRadius: 10, color: "#fc8181", fontSize: 13, marginBottom: 12, textAlign: "center" }}>{regError}</div>}
                {regNotice && <div style={{ padding: "10px 14px", background: "rgba(252,216,70,0.08)", border: "1px solid rgba(252,216,70,0.28)", borderRadius: 10, color: LEMON, fontSize: 13, marginBottom: 12, textAlign: "center" }}>{regNotice}</div>}
                {regStep === "form" ? (
                <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="Inserisci la tua email" required style={{ width: "100%", height: 46, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, padding: "0 15px", fontSize: 14, color: "#fff", fontFamily: "inherit", outline: "none" }} />
                  <input type="password" value={regPass} onChange={e => setRegPass(e.target.value)} placeholder="Password (min 6)" required minLength={6} style={{ width: "100%", height: 46, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, padding: "0 15px", fontSize: 14, color: "#fff", fontFamily: "inherit", outline: "none" }} />
                  <button type="submit" disabled={regLoading} className="lm-auth-btn" style={{ height: 48, borderRadius: 12, background: `linear-gradient(135deg, ${LEMON_BRIGHT} 0%, ${LEMON} 60%, #4338ca 100%)`, border: "none", fontSize: 14.5, fontWeight: 800, color: "#141005", cursor: regLoading ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: "0 8px 28px rgba(252,216,70,0.30)", opacity: regLoading ? 0.6 : 1, transition: "all .18s ease" }}>
                    {regLoading ? "Invio codice..." : "Invia codice"}
                  </button>
                </form>
                ) : (
                <form onSubmit={handleVerifyCode} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", textAlign: "center", lineHeight: 1.6 }}>
                    Ti abbiamo inviato un codice a<br /><b style={{ color: "#fff" }}>{regEmail}</b>
                  </div>
                  {regDevCode && <div style={{ padding: "10px 14px", background: "rgba(252,216,70,0.08)", border: "1px solid rgba(252,216,70,0.28)", borderRadius: 10, color: LEMON, fontSize: 13, textAlign: "center" }}>Email non configurata — codice: <b style={{ fontSize: 17, letterSpacing: 3 }}>{regDevCode}</b></div>}
                  {regCodeError && <div style={{ padding: "10px 14px", background: "rgba(245,101,101,0.08)", border: "1px solid rgba(245,101,101,0.25)", borderRadius: 10, color: "#fc8181", fontSize: 13, textAlign: "center" }}>{regCodeError}</div>}
                  <input value={regCode} onChange={e => setRegCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Codice a 6 cifre" required minLength={6} maxLength={6} inputMode="numeric" autoFocus style={{ width: "100%", height: 52, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, padding: "0 15px", fontSize: 20, letterSpacing: 6, textAlign: "center", color: "#fff", fontFamily: "inherit", outline: "none", fontWeight: 700 }} />
                  <button type="submit" disabled={regCodeLoading || regCode.length < 6} className="lm-auth-btn" style={{ height: 48, borderRadius: 12, background: `linear-gradient(135deg, ${LEMON_BRIGHT} 0%, ${LEMON} 60%, #4338ca 100%)`, border: "none", fontSize: 14.5, fontWeight: 800, color: "#141005", cursor: regCodeLoading || regCode.length < 6 ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: "0 8px 28px rgba(252,216,70,0.30)", opacity: regCodeLoading || regCode.length < 6 ? 0.6 : 1, transition: "all .18s ease" }}>
                    {regCodeLoading ? "Verifica..." : "Verifica e crea account"}
                  </button>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                    <button type="button" onClick={() => { setRegStep("form"); setRegCodeError(""); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.45)", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>← Cambia email</button>
                    <button type="button" disabled={regCooldown > 0 || regLoading} onClick={async () => { setRegLoading(true); await sendRegCode(); setRegLoading(false); }} style={{ background: "none", border: "none", color: regCooldown > 0 ? "rgba(255,255,255,0.25)" : LEMON, fontWeight: 700, fontSize: 12.5, cursor: regCooldown > 0 ? "default" : "pointer", fontFamily: "inherit" }}>
                      {regCooldown > 0 ? `Reinvia tra ${regCooldown}s` : "Reinvia codice"}
                    </button>
                  </div>
                </form>
                )}
                <p style={{ marginTop: 16, fontSize: 13, color: "rgba(255,255,255,0.40)", textAlign: "center" }}>
                  Hai già un account?{" "}
                  <button type="button" onClick={() => { setShowRegister(false); setRegError(""); setRegStep("form"); }} style={{ background: "none", border: "none", color: LEMON, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>Accedi</button>
                </p>
              </>
            )}
            <p style={{ marginTop: 20, fontSize: 11.5, color: "rgba(255,255,255,0.32)", lineHeight: 1.6, textAlign: "center" }}>
              Continuando, dichiari di aver preso visione dell&apos;Informativa sulla privacy di Vexa.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: ${INTER}; -webkit-font-smoothing: antialiased; color: #fff; background: transparent; }
        ::placeholder { color: rgba(255,255,255,0.35); }
        textarea:focus { outline: none; }
        input:focus { outline: none; }
        @keyframes gSpin { to { transform: rotate(360deg) } }
        @keyframes gFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes gFadeOut { from { opacity: 1 } to { opacity: 0 } }
        @keyframes gScaleIn { from { opacity: 0; transform: scale(0.94) translateY(8px) } to { opacity: 1; transform: scale(1) translateY(0) } }
        @keyframes gScaleOut { from { opacity: 1; transform: scale(1) translateY(0) } to { opacity: 0; transform: scale(0.94) translateY(6px) } }
        @keyframes gHeroIn { from { opacity: 0; transform: translateY(22px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes gPillIn { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes lmMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .lm-marquee { animation: lmMarquee 28s linear infinite; }
        .lm-marquee:hover { animation-play-state: paused; }
        .lm-side-row:hover { background: rgba(255,255,255,0.09) !important; }
        .lm-side-row:hover span:first-of-type { color: #fff !important; }
        .lm-pill:hover { background: rgba(255,255,255,0.10) !important; border-color: rgba(252,216,70,0.35) !important; transform: translateY(-1px); }
        .lm-pill:active { transform: translateY(0) scale(0.98); }
        .lm-new-btn:hover { filter: brightness(0.94); transform: translateY(-1px); }
        .lm-new-btn:active { transform: translateY(0) scale(0.98); }
        .lm-generate:hover { filter: brightness(1.06); transform: translateY(-1px); box-shadow: 0 10px 32px rgba(252,216,70,0.55) !important; }
        .lm-generate:active { transform: translateY(0) scale(0.98); }
        .lm-gen-row:hover { background: rgba(255,255,255,0.06) !important; }
        .lm-del { opacity: 0; transition: opacity .15s ease; }
        .lm-side-row:hover .lm-del { opacity: 1; }
        .lm-del:hover { color: #fc8181 !important; }
        .cl-icon:hover { background: rgba(255,255,255,0.08) !important; color: #fff !important; }
        .cl-icon2:hover { background: rgba(255,255,255,0.08) !important; color: #fff !important; }
        .cl-link:hover { color: #fff !important; }
        .cl-input::placeholder { color: #8f8e87; }
      `}</style>

      {loadingProject && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(6,20,30,0.70)", backdropFilter: "blur(12px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, animation: "gFadeIn 0.18s ease forwards" }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.25)", borderTopColor: "#fff", animation: "gSpin 0.7s linear infinite" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.75)", letterSpacing: "0.04em" }}>Loading project...</span>
        </div>
      )}

      <NewProjectModal open={newOpen} onClose={() => setNewOpen(false)} onCreate={handleCreate} creating={creating} />
      <DeleteConfirmModal open={deleteOpen} projectName={deleteName} onConfirm={confirmDelete} onCancel={() => { setDeleteOpen(false); setDeleteId(null); setDeleteName(""); }} />
      <ConnectStudioModal open={connectOpen} onClose={() => setConnectOpen(false)} onConnected={() => { setStudioConnected(true); setConnectOpen(false); }} />

      <div style={{ display: "flex", minHeight: "100vh", height: "100vh", fontFamily: INTER, background: "#1b1a18", overflow: "hidden" }}>
        {/* ============ SIDEBAR ============ */}
        <aside style={{ width: sidebarOpen ? 264 : 52, flexShrink: 0, background: "#212120", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", height: "100vh", transition: "width .18s ease", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "10px 8px 4px" }}>
            <button type="button" className="cl-icon" title={sidebarOpen ? "Nascondi barra" : "Mostra barra"} onClick={() => setSidebarOpen(v => !v)} style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", color: "rgba(255,255,255,0.6)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "#fff" }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.6)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2.5" /><line x1="9.5" y1="3" x2="9.5" y2="21" /></svg>
            </button>
            {sidebarOpen && (
              <>
                <button type="button" className="cl-icon" title="Indietro" onClick={() => window.history.back()} style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", color: "rgba(255,255,255,0.6)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "#fff" }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.6)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 5 5 12 12 19" /></svg>
                </button>
                <button type="button" className="cl-icon" title="Avanti" onClick={() => window.history.forward()} style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", color: "rgba(255,255,255,0.6)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "#fff" }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.6)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                </button>
                <button type="button" className="cl-icon" title="Cerca" onClick={() => searchRef.current?.focus()} style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", color: "rgba(255,255,255,0.6)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "#fff" }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.6)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="11" cy="11" r="3.2" /><line x1="13.6" y1="13.6" x2="16.2" y2="16.2" /></svg>
                </button>
              </>
            )}
          </div>

          {sidebarOpen && (
            <>
              <div style={{ padding: "8px 12px 10px" }}>
                <div style={{ position: "relative" }}>
                  <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7.5" /><line x1="20" y1="20" x2="16.5" y2="16.5" /></svg>
                  <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca" style={{ width: "100%", height: 34, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 9, paddingLeft: 32, paddingRight: 10, fontSize: 13, color: "#fff", fontFamily: "inherit", outline: "none" }} />
                </div>
              </div>

              <div style={{ padding: "0 10px 6px", display: "flex", flexDirection: "column", gap: 2 }}>
                <button type="button" className="lm-new-btn" onClick={() => setNewOpen(true)} style={{ width: "100%", height: 36, borderRadius: 9, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.06)", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 9, padding: "0 10px", transition: "all .15s ease" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  Nuovo
                </button>
                <button type="button" className="lm-gen-row" onClick={() => setListOpen(v => !v)} style={{ width: "100%", height: 34, borderRadius: 9, background: "transparent", border: "none", color: "rgba(255,255,255,0.75)", fontSize: 13.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 9, padding: "0 10px", transition: "background .15s ease" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2h9A1.5 1.5 0 0 1 21 9.5v8A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" /></svg>
                  <span style={{ flex: 1, textAlign: "left" }}>Progetti</span>
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ opacity: 0.45, transform: listOpen ? "rotate(180deg)" : "none", transition: "transform .18s ease" }}><path d="M1.5 3.5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <button type="button" className="lm-gen-row" onClick={() => setSettingsOpen(true)} style={{ width: "100%", height: 34, borderRadius: 9, background: "transparent", border: "none", color: "rgba(255,255,255,0.75)", fontSize: 13.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 9, padding: "0 10px", transition: "background .15s ease" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>
                  Personalizzazione
                </button>
              </div>

              {listOpen && (
                <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 10px 12px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px", marginBottom: 4 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,0.55)" }}>Recenti</span>
                    <button type="button" title={sortDesc ? "Più vecchi prima" : "Più recenti prima"} onClick={() => setSortDesc(v => !v)} className="cl-icon" style={{ width: 24, height: 24, borderRadius: 7, border: "none", background: "transparent", color: "rgba(255,255,255,0.45)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transform: sortDesc ? "none" : "rotate(180deg)", transition: "transform .18s ease" }}><path d="M7 4v16" /><polyline points="3 8 7 4 11 8" /><path d="M17 20V4" /><polyline points="21 16 17 20 13 16" /></svg>
                    </button>
                  </div>
                  {displayed.length === 0 ? (
                    <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.30)", padding: "6px 8px", lineHeight: 1.5 }}>
                      {search ? "Nessun progetto trovato." : "Ancora nessun progetto."}
                    </div>
                  ) : (
                    displayed.map(p => (
                      <div key={p.id} className="lm-side-row" onClick={() => openProject(p.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 9, cursor: "pointer", transition: "background .15s ease" }}>
                        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: "rgba(255,255,255,0.88)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                        <button type="button" className="lm-del" onClick={(e) => { e.stopPropagation(); promptDelete(p.id, p.name); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 2 }}>×</button>
                      </div>
                    ))
                  )}
                </div>
              )}

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "8px 10px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                <div ref={acctMenuRef} style={{ position: "relative", flex: 1, minWidth: 0 }}>
                  <button type="button" className="lm-gen-row" onClick={() => setAcctMenuOpen(v => !v)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", borderRadius: 9, padding: "6px 7px", cursor: "pointer", fontFamily: "inherit", transition: "background .15s ease" }}>
                    <span style={{ width: 22, height: 22, borderRadius: "50%", background: `linear-gradient(135deg, ${LEMON_BRIGHT}, ${LEMON})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#141005", flexShrink: 0 }}>
                      {(userEmail || "V").charAt(0).toUpperCase()}
                    </span>
                    <span style={{ flex: 1, textAlign: "left", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(userEmail || "").split("@")[0] || "ospite"}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>Free</span>
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ opacity: 0.45, transform: acctMenuOpen ? "rotate(180deg)" : "none", transition: "transform .18s ease" }}><path d="M1.5 3.5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                  {acctMenuOpen && (
                    <div style={{ position: "absolute", bottom: "calc(100% + 8px)", left: 0, width: 220, background: "#2a2a27", border: "1px solid #3b3a37", borderRadius: 13, padding: 5, zIndex: 120, boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
                      <div style={{ padding: "9px 11px", fontSize: 11.5, color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{userEmail || "account locale"}</div>
                      <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "3px 0" }} />
                      <button type="button" className="lm-gen-row" onClick={handleSignOut} style={{ width: "100%", padding: "9px 11px", borderRadius: 9, border: "none", background: "transparent", color: "#fc8181", cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontSize: 13 }}>Esci</button>
                    </div>
                  )}
                </div>
                <button type="button" className="cl-icon" title="Impostazioni" onClick={() => setSettingsOpen(true)} style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", color: "rgba(255,255,255,0.55)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10.6 3.09V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 16.11 4.6h.08A1.65 1.65 0 0 0 18 4.27l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 20.5 9v.09a1.65 1.65 0 0 0 1.51 1H22a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                </button>
              </div>
            </>
          )}
        </aside>

        {/* ============ MAIN ============ */}
        <main style={{ flex: 1, minWidth: 0, background: "#1b1a18", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", padding: "80px 24px 40px", overflowY: "auto" }}>
          <div style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "rgba(255,255,255,0.62)", whiteSpace: "nowrap" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: studioConnected ? "#4ade80" : "rgba(255,255,255,0.28)", boxShadow: studioConnected ? "0 0 8px rgba(74,222,128,0.7)" : "none", flexShrink: 0 }} />
            <span>{studioConnected ? "Rojo connesso" : "Rojo non connesso"}</span>
            <span style={{ color: "rgba(255,255,255,0.28)" }}>·</span>
            <button type="button" className="cl-link" onClick={() => setConnectOpen(true)} style={{ background: "none", border: "none", padding: 0, fontFamily: "inherit", fontSize: 13, fontWeight: 500, color: "#f0efea", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3, textDecorationColor: "rgba(255,255,255,0.45)" }}>{studioConnected ? "Riconnetti" : "Connetti a Rojo"}</button>
          </div>

          <div style={{ width: "100%", maxWidth: 760, display: "flex", flexDirection: "column", alignItems: "center", animation: "gHeroIn .55s cubic-bezier(.16,1,.3,1) both" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 13, marginBottom: 26, textAlign: "center" }}>
              <LandingStar size={30} />
              <h1 style={{ margin: 0, fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 400, fontSize: "clamp(26px, 2.7vw, 37px)", letterSpacing: "-0.012em", lineHeight: 1.15, color: "#f6f5f0" }}>
                {(() => {
                  const h = new Date().getHours();
                  const part = h >= 5 && h < 12 ? "Buongiorno" : h >= 12 && h < 18 ? "Buon pomeriggio" : h >= 18 && h < 23 ? "Buonasera" : "Buonanotte";
                  const who = (userEmail || "").split("@")[0] || "ospite";
                  return `${part}, ${who}`;
                })()}
              </h1>
            </div>

            <div style={{ width: "100%", maxWidth: 720, background: "#262624", border: "1px solid #3a3936", borderRadius: 16, padding: "16px 18px 12px", boxShadow: "0 20px 60px rgba(0,0,0,0.30)" }}>
              <textarea
                ref={promptRef}
                className="cl-input"
                value={prompt}
                autoFocus
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitPrompt(); } }}
                placeholder="Come posso aiutarti oggi?"
                rows={1}
                style={{ width: "100%", background: "transparent", border: "none", boxShadow: "none", resize: "none", color: "#f0efea", fontSize: 15.5, lineHeight: 1.55, fontFamily: "inherit", minHeight: 54, maxHeight: 220, overflowY: "auto", padding: 0 }}
              />
              <div style={{ display: "flex", alignItems: "center", marginTop: 4 }}>
                <button type="button" onClick={() => setNewOpen(true)} title="Nuovo progetto" className="cl-icon2" style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", color: "rgba(255,255,255,0.72)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                </button>
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  onClick={submitPrompt}
                  disabled={!prompt.trim() || generating}
                  title="Invia (Invio)"
                  style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: prompt.trim() ? LEMON : "transparent", color: prompt.trim() ? "#141310" : "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", cursor: prompt.trim() && !generating ? "pointer" : "not-allowed", transition: "all .18s ease", marginLeft: 4 }}
                >
                  {generating
                    ? <span style={{ width: 13, height: 13, borderRadius: "50%", border: "2px solid rgba(0,0,0,.25)", borderTopColor: "rgba(0,0,0,.7)", animation: "gSpin .7s linear infinite" }} />
                    : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="13 6 19 12 13 18" /></svg>}
                </button>
              </div>
            </div>

            <div style={{ width: "100%", maxWidth: 720, marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div ref={projMenuRef} style={{ position: "relative" }}>
                <button type="button" className="cl-link" onClick={() => setProjMenuOpen(v => !v)} style={{ background: "none", border: "none", padding: 0, fontFamily: "inherit", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.55)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
                  Progetto
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ opacity: 0.55, transform: projMenuOpen ? "rotate(180deg)" : "none", transition: "transform .18s ease" }}><path d="M1.5 3.5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                {projMenuOpen && (
                  <div style={{ position: "absolute", bottom: "calc(100% + 10px)", left: 0, width: 250, background: "#2a2a27", border: "1px solid #3b3a37", borderRadius: 13, padding: 6, zIndex: 120, boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
                    <button type="button" className="lm-gen-row" onClick={() => { setProjMenuOpen(false); setNewOpen(true); }} style={{ width: "100%", padding: "9px 11px", borderRadius: 9, border: "none", background: "transparent", color: "#f0efea", cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontSize: 13 }}>Nuovo progetto</button>
                    {projects.length > 0 && <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "3px 0" }} />}
                    {projects.slice(0, 5).map(p => (
                      <button key={p.id} type="button" className="lm-gen-row" onClick={() => { setProjMenuOpen(false); openProject(p.id); }} style={{ width: "100%", padding: "9px 11px", borderRadius: 9, border: "none", background: "transparent", color: "rgba(255,255,255,0.7)", cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ position: "relative" }}>
                  <button type="button" className="cl-link" onClick={() => setModelOpen(o => !o)} style={{ background: "none", border: "none", padding: 0, fontFamily: "inherit", fontSize: 13, fontWeight: 500, color: "#f0efea", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
                    {selLabel}
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ opacity: 0.55, transform: modelOpen ? "rotate(180deg)" : "none", transition: "transform .18s ease" }}><path d="M1.5 3.5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                  {modelOpen && (
                    <div style={{ position: "absolute", zIndex: 62, bottom: "calc(100% + 10px)", right: 0, width: 240, maxHeight: 320, overflowY: "auto", background: "#2a2a27", border: "1px solid #3b3a37", borderRadius: 13, padding: 6, boxShadow: "0 20px 50px rgba(0,0,0,0.55)" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "5px 10px" }}>Modello</div>
                      {modelOptions.map(o => (
                        <button key={o.id || "__auto__"} type="button" disabled={o.disabled} onClick={() => pickModel(o.id)} className="lm-gen-row" style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 10px", background: selModel === o.id ? "rgba(255,255,255,0.07)" : "transparent", border: "none", borderRadius: 9, cursor: o.disabled ? "default" : "pointer", fontFamily: "inherit", textAlign: "left", opacity: o.disabled ? 0.45 : 1 }}>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.label}</span>
                            <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{o.sub}</span>
                          </span>
                          {selModel === o.id && !o.disabled && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={LEMON} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} profile={meProfile}
        locale={locale} setLocale={setLocale}
        reduceMotion={reduceMotion} setReduceMotion={setReduceMotion}
        sendOnEnter={sendOnEnter} setSendOnEnter={setSendOnEnter}
        compactMode={compactMode} setCompactMode={setCompactMode} />
      <ModelInstallerModal open={showModelWizard} onClose={() => setShowModelWizard(false)} />
    </>
  );
}
