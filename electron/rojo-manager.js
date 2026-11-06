"use strict"

// ---------------------------------------------------------------------------
// RojoManager
// Starts and supervises a local Rojo server and writes generated content into
// a real Rojo project on disk, so Studio syncs it through the official Rojo
// plugin (no custom bridge, no MCP server).
// ---------------------------------------------------------------------------

const fs = require("fs")
const path = require("path")
const net = require("net")
const { spawn, execFile } = require("child_process")

const ROJO_PORT = 34872
const DEFAULT_PROJECT = "default.project.json"
const SERVICES = [
  "ServerScriptService",
  "ReplicatedStorage",
  "ReplicatedFirst",
  "StarterGui",
  "StarterPlayer",
  "Workspace",
  "Lighting",
  "SoundService",
  "ServerStorage",
]

const PROJECT_JSON = {
  name: "Vexa",
  tree: {
    $className: "DataModel",
    ServerScriptService: { $path: "src/ServerScriptService" },
    ReplicatedStorage: { $path: "src/ReplicatedStorage" },
    ReplicatedFirst: { $path: "src/ReplicatedFirst" },
    StarterGui: { $path: "src/StarterGui" },
    StarterPlayer: {
      $className: "StarterPlayer",
      StarterPlayerScripts: { $path: "src/StarterPlayer/StarterPlayerScripts" },
      StarterCharacterScripts: { $path: "src/StarterPlayer/StarterCharacterScripts" },
    },
    Workspace: { $path: "src/Workspace" },
    Lighting: { $path: "src/Lighting" },
    SoundService: { $path: "src/SoundService" },
    ServerStorage: { $path: "src/ServerStorage" },
  },
}

function portOpen(port, host = "127.0.0.1", timeout = 700) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host })
    let settled = false
    const done = (ok) => {
      if (settled) return
      settled = true
      try { socket.destroy() } catch {}
      resolve(ok)
    }
    socket.setTimeout(timeout)
    socket.once("connect", () => done(true))
    socket.once("timeout", () => done(false))
    socket.once("error", () => done(false))
  })
}

function safeName(name, fallback) {
  const raw = String(name || fallback || "Item").trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
  return raw || fallback || "Item"
}

// Rojo's .model.json expects typed values. Generated payloads use Lua-ish
// strings ("1,1,1", "255,0,0", "Enum.Material.Neon"): convert what we can and
// drop what would make Rojo refuse the whole project.
function vec3FromObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const x = value.X ?? value.x ?? value[0]
  const y = value.Y ?? value.y ?? value[1]
  const z = value.Z ?? value.z ?? value[2]
  if (![x, y, z].every((n) => typeof n === "number" && Number.isFinite(n))) return null
  return [x, y, z]
}
function colorFromObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const r = value.R ?? value.r ?? value[0]
  const g = value.G ?? value.g ?? value[1]
  const b = value.B ?? value.b ?? value[2]
  if (![r, g, b].every((n) => typeof n === "number" && Number.isFinite(n))) return null
  return [r, g, b]
}
function sanitizeProperties(props) {
  const out = {}
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined) continue
    if (typeof value === "number" || typeof value === "boolean") { out[key] = value; continue }
    if (typeof value === "string") {
      const text = value.trim()
      const enumMatch = text.match(/^Enum\.[A-Za-z0-9_]+\.([A-Za-z0-9_]+)$/)
      if (enumMatch) { out[key] = enumMatch[1]; continue }
      const parts = text.split(",").map((n) => parseFloat(n.trim()))
      if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
        if (/color/i.test(key)) out[key] = parts.map((n) => Math.max(0, Math.min(1, n > 1 ? n / 255 : n)))
        else out[key] = parts
        continue
      }
      if (text.length > 0 && text.length < 80 && !/[{}]/.test(text)) out[key] = text
      continue
    }
    if (Array.isArray(value) && value.every((n) => typeof n === "number")) {
      if (/color/i.test(key)) out[key] = value.map((n) => Math.max(0, Math.min(1, n > 1 ? n / 255 : n)))
      else out[key] = value
      continue
    }
    if (typeof value === "object") {
      const isColor = /color/i.test(key)
      const vec = isColor ? colorFromObject(value) : vec3FromObject(value)
      if (vec) {
        out[key] = isColor ? vec.map((n) => Math.max(0, Math.min(1, n > 1 ? n / 255 : n))) : vec
        continue
      }
    }
  }
  return out
}

function splitParent(parent) {
  const raw = String(parent || "ServerScriptService")
    .replace(/^game\.?/i, "")
    .split(/[./]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (raw.length === 0) return ["ServerScriptService"]
  const service = SERVICES.find((s) => s.toLowerCase() === raw[0].toLowerCase())
  return [service || "ServerScriptService", ...raw.slice(1)]
}

class RojoManager {
  constructor({ app, isDev } = {}) {
    this.app = app
    this.isDev = !!isDev
    this.proc = null
    this.lastError = null
    this.logLines = []
  }

  log(line) {
    const text = String(line || "").trim()
    if (!text) return
    this.logLines.push(text)
    if (this.logLines.length > 200) this.logLines.shift()
    console.log("[rojo]", text)
  }

  workspaceDir() {
    const base = this.app && this.app.getPath ? this.app.getPath("userData") : path.join(process.env.APPDATA || process.cwd(), "Vexa")
    return path.join(base, "rojo")
  }

  projectFile() {
    return path.join(this.workspaceDir(), DEFAULT_PROJECT)
  }

  cliCandidates() {
    const home = process.env.USERPROFILE || process.env.HOME || ""
    const local = process.env.LOCALAPPDATA || ""
    const exe = process.platform === "win32" ? "rojo.exe" : "rojo"
    const out = []
    if (this.isDev) out.push(path.join(__dirname, "..", "bin", exe))
    // Version managers keep the real binary in tool-storage; the bin/ entry is
    // only a shim that requires an aftman.toml in the current directory.
    for (const root of [
      path.join(home, ".aftman", "tool-storage", "rojo-rbx", "rojo"),
      path.join(home, ".rokit", "tool-storage", "rojo-rbx", "rojo"),
      path.join(local, "aftman", "tool-storage", "rojo-rbx", "rojo"),
      path.join(local, "rokit", "tool-storage", "rojo-rbx", "rojo"),
    ]) {
      try {
        if (!fs.existsSync(root)) continue
        const versions = fs.readdirSync(root)
          .filter((v) => fs.existsSync(path.join(root, v, exe)))
          .sort((a, b) => {
            const parse = (v) => ({ base: v.split("-")[0].split(".").map((n) => parseInt(n, 10) || 0), pre: v.includes("-") ? 1 : 0 })
            const pa = parse(a)
            const pb = parse(b)
            for (let i = 0; i < Math.max(pa.base.length, pb.base.length); i++) {
              if ((pa.base[i] || 0) !== (pb.base[i] || 0)) return (pb.base[i] || 0) - (pa.base[i] || 0)
            }
            return pa.pre - pb.pre
          })
        for (const v of versions) out.push(path.join(root, v, exe))
      } catch {}
    }
    out.push(
      path.join(home, ".aftman", "bin", exe),
      path.join(home, ".rokit", "bin", exe),
      path.join(home, ".cargo", "bin", exe),
      path.join(local, "aftman", "bin", exe),
      path.join(local, "rokit", "bin", exe),
      path.join(local, "Programs", "rojo", exe),
    )
    if (process.resourcesPath) out.push(path.join(process.resourcesPath, "rojo", exe))
    return out.filter(Boolean)
  }

  findCli() {
    for (const candidate of this.cliCandidates()) {
      try { if (fs.existsSync(candidate)) return candidate } catch {}
    }
    return null
  }

  rojoVersion(cli) {
    return new Promise((resolve) => {
      try {
        execFile(cli, ["--version"], { timeout: 5000, windowsHide: true }, (err, stdout) => {
          if (err) return resolve(null)
          const m = String(stdout || "").match(/(\d+\.\d+\.\d+)/)
          resolve(m ? m[1] : String(stdout || "").trim() || null)
        })
      } catch { resolve(null) }
    })
  }

  ensureWorkspace() {
    const root = this.workspaceDir()
    fs.mkdirSync(root, { recursive: true })
    for (const service of SERVICES) {
      if (service === "StarterPlayer") {
        fs.mkdirSync(path.join(root, "src", "StarterPlayer", "StarterPlayerScripts"), { recursive: true })
        fs.mkdirSync(path.join(root, "src", "StarterPlayer", "StarterCharacterScripts"), { recursive: true })
      } else {
        fs.mkdirSync(path.join(root, "src", service), { recursive: true })
      }
    }
    const file = this.projectFile()
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(PROJECT_JSON, null, 2), "utf8")
    }
    return root
  }

  async status() {
    const cli = this.findCli()
    const installed = !!cli
    const version = installed ? await this.rojoVersion(cli) : null
    const running = this.proc ? await portOpen(ROJO_PORT) : await portOpen(ROJO_PORT)
    return {
      installed,
      version,
      cli: cli || null,
      running,
      port: ROJO_PORT,
      url: `localhost:${ROJO_PORT}`,
      workspace: this.workspaceDir(),
      project: this.projectFile(),
      error: this.lastError,
      log: this.logLines.slice(-8),
    }
  }

  async start(attempt = 0) {
    const cli = this.findCli()
    if (!cli) {
      this.lastError = "Rojo non è installato su questo PC."
      return { ok: false, ...(await this.status()), error: this.lastError }
    }
    const root = this.ensureWorkspace()
    if (await portOpen(ROJO_PORT)) {
      this.lastError = null
      return { ok: true, ...(await this.status()) }
    }
    this.lastError = null
    this.log(`serve ${this.projectFile()} --port ${ROJO_PORT}`)
    this.proc = spawn(cli, ["serve", this.projectFile(), "--port", String(ROJO_PORT)], {
      cwd: root,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    })
    this.proc.stdout && this.proc.stdout.on("data", (d) => this.log(d.toString()))
    this.proc.stderr && this.proc.stderr.on("data", (d) => this.log(d.toString()))
    this.proc.on("error", (e) => { this.lastError = e.message; this.log(e.message) })
    this.proc.on("close", (code) => { this.log(`exited ${code}`); this.proc = null })

    for (let i = 0; i < 40; i++) {
      if (await portOpen(ROJO_PORT)) {
        return { ok: true, ...(await this.status()) }
      }
      await new Promise((r) => setTimeout(r, 250))
    }

    // Retry: if a single model file is invalid, Rojo refuses to start.
    // Detect it from the log, delete it, and try again (max 3 times).
    const bad = this.logLines.join("\n").match(/Could not load JSON model: ([^\n]+)/)
    if (bad && attempt < 3) {
      const file = bad[1].trim()
      try { if (file && fs.existsSync(file)) { fs.rmSync(file, { force: true }); this.log("removed invalid model: " + file) } } catch (e) { this.log("rm failed: " + e.message) }
      try { if (this.proc && this.proc.pid) { if (process.platform === "win32") spawn("taskkill", ["/pid", String(this.proc.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }); else this.proc.kill("SIGTERM") } } catch {}
      this.proc = null
      await new Promise((r) => setTimeout(r, 300))
      return this.start(attempt + 1)
    }

    this.lastError = "Rojo non ha aperto la porta in tempo."
    return { ok: false, ...(await this.status()), error: this.lastError }
  }

  async stop() {
    const proc = this.proc
    this.proc = null
    if (!proc || !proc.pid) return { ok: true, ...(await this.status()) }
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" })
      } else {
        proc.kill("SIGTERM")
      }
    } catch (e) { this.log("stop: " + e.message) }
    for (let i = 0; i < 10; i++) {
      if (!(await portOpen(ROJO_PORT))) break
      await new Promise((r) => setTimeout(r, 200))
    }
    return { ok: true, ...(await this.status()) }
  }

  serviceDir(parts) {
    const root = this.workspaceDir()
    if (parts[0] === "StarterPlayer") {
      const sub = parts[1] || "StarterPlayerScripts"
      return path.join(root, "src", "StarterPlayer", sub, ...parts.slice(2))
    }
    return path.join(root, "src", parts[0], ...parts.slice(1))
  }

  writeScript(script) {
    const parts = splitParent(script.parent)
    const name = safeName(script.name, "Script")
    const dir = this.serviceDir(parts)
    fs.mkdirSync(dir, { recursive: true })
    const type = String(script.type || "Script")
    const ext = type === "LocalScript" ? ".client.lua" : type === "ModuleScript" ? ".lua" : ".server.lua"
    const file = path.join(dir, name + ext)
    fs.writeFileSync(file, String(script.code || ""), "utf8")
    return file
  }

  writeInstance(instance) {
    const parts = splitParent(instance.parent || "Workspace")
    const name = safeName(instance.name, "Instance")
    const dir = this.serviceDir(parts)
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, name + ".model.json")
    const model = {
      ClassName: instance.className || instance.class || "Part",
      Properties: sanitizeProperties(instance.properties || {}),
    }
    fs.writeFileSync(file, JSON.stringify(model, null, 2), "utf8")
    return file
  }

  async apply(payload) {
    const running = await portOpen(ROJO_PORT)
    if (!running) {
      return { ok: false, error: "Rojo non è in esecuzione. Avvialo da “Connetti a Rojo”.", written: [], deleted: [], skipped: 0 }
    }
    this.ensureWorkspace()
    const written = []
    const deleted = []
    let skipped = 0

    const scripts = Array.isArray(payload && payload.scripts) ? payload.scripts : []
    const instances = Array.isArray(payload && payload.instances) ? payload.instances : []
    const deletions = Array.isArray(payload && payload.deletions) ? payload.deletions : []

    for (const script of scripts) {
      try { written.push(this.writeScript(script)) } catch (e) { skipped++; this.log("script: " + e.message) }
    }
    for (const instance of instances) {
      try { written.push(this.writeInstance(instance)) } catch (e) { skipped++; this.log("instance: " + e.message) }
    }
    for (const del of deletions) {
      const parts = splitParent(del && del.parent)
      const dir = this.serviceDir(parts)
      const name = safeName(del && del.name, "")
      if (!name || !fs.existsSync(dir)) { skipped++; continue }
      const hits = fs.readdirSync(dir).filter((f) => f === name || f.startsWith(name + "."))
      for (const hit of hits) {
        try { fs.rmSync(path.join(dir, hit), { force: true }); deleted.push(path.join(dir, hit)) } catch { skipped++ }
      }
    }

    return {
      ok: true,
      written,
      deleted,
      skipped,
      workspace: this.workspaceDir(),
      url: `localhost:${ROJO_PORT}`,
    }
  }
}

module.exports = { RojoManager, ROJO_PORT }
