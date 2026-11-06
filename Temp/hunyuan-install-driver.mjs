// Vexa Hunyuan3D-2 (open-source, portable) install driver — UNCLE-bounded,
// unlimited, keyless. Replicates the exact pipeline from electron/main.js
// (download pack parts -> 7zr extract -> weights -> gradio :8080 + bridge
// :8081 -> health) inside the app's OWN userData dir, fully local/offline.
import { createServer } from "node:http"
import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import https from "node:https"

const USER_DATA = process.env.VEXA_USER_DATA || path.join(process.env.APPDATA || "", "Vexa")
const HUNYUAN_PACK_PORT = 8080
const HUNYUAN_BRIDGE_PORT = 8081
const LOCAL_HUNYUAN_URL = `http://127.0.0.1:${HUNYUAN_BRIDGE_PORT}`
const PACK_REPO = "YanWenKun/Hunyuan3D-2-WinPortable"
const SEVENZIP_URL = "https://www.7-zip.org/a/7zr.exe"

const packDir = path.join(USER_DATA, "hunyuan-pack")
const partsDir = path.join(packDir, "parts")
const unpackedDir = path.join(packDir, "unpacked")
const packPartsDone = path.join(packDir, "parts-ok.txt")
const packExtractDone = path.join(packDir, "extract-ok.txt")
const packModelsDone = path.join(packDir, "models-ok.txt")
const seven = path.join(packDir, "7zr.exe")

const logFile = path.join(os.tmpdir(), "opencode", "hunyuan-install-driver.log")
const log = (...a) => {
  const s = new Date().toISOString() + " " + a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ")
  console.log(s)
  try { fs.appendFileSync(logFile, s + "\n") } catch {}
}

async function jfetch(u, opts) {
  const r = await fetch(u, { ...opts, headers: { "user-agent": "Vexa", ...(opts?.headers || {}) } })
  if (!r.ok) throw new Error("HTTP " + r.status + " " + u)
  return r
}

async function releaseAssets() {
  const j = await (await jfetch(`https://api.github.com/repos/${PACK_REPO}/releases/latest`)).json()
  return (j.assets || [])
    .filter((a) => /\.7z(\.\d{3})?$/i.test(a.name))
    .map((a) => ({ name: a.name, url: a.browser_download_url, size: a.size || 0 }))
}

function downloadFile(u, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const tmp = dest + ".part"
    let have = 0
    try { have = fs.existsSync(tmp) ? fs.statSync(tmp).size : 0 } catch { have = 0 }
    const attempt = (url, redirects) => {
      const headers = { accept: "*/*" }
      if (have > 0) headers.range = `bytes=${have}-`
      const req = https.get(url, { headers }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume()
          if (redirects > 6) return reject(new Error("too many redirects"))
          return attempt(new URL(res.headers.location, url).toString(), redirects + 1)
        }
        if (res.statusCode !== 200 && res.statusCode !== 206) {
          res.resume()
          return reject(new Error("HTTP " + res.statusCode + " (" + url.slice(0, 80) + ")"))
        }
        if (res.statusCode === 200) have = 0
        const total = Number(res.headers["content-length"] || 0) + have
        const out = fs.createWriteStream(tmp, have > 0 ? { flags: "a" } : undefined)
        let got = have
        res.pipe(out)
        res.on("data", (c) => { got += c.length; onProgress?.(got, total) })
        res.on("end", () => {
          out.end(() => {
            try {
              fs.renameSync(tmp, dest)
              fs.writeFileSync(dest + ".size", String(got))
            } catch (e) { return reject(e) }
            resolve()
          })
        })
      })
      req.on("error", reject)
    }
    attempt(u, 0)
  })
}

async function dl7zr() {
  const dest = seven
  if (fs.existsSync(dest)) return
  log("download 7zr:", SEVENZIP_URL)
  await downloadFile(SEVENZIP_URL, dest)
}

async function dlParts() {
  if (fs.existsSync(packPartsDone)) return
  fs.mkdirSync(partsDir, { recursive: true })
  const assets = await releaseAssets()
  log("assets:", assets.map((a) => a.name + " " + Math.round(a.size / 1e6) + "MB").join(", "))
  for (const a of assets) {
    const dest = path.join(partsDir, a.name)
    if (fs.existsSync(dest) && fs.statSync(dest).size >= a.size) continue
    log("download:", a.name, Math.round(a.size / 1e6) + "MB")
    await downloadFile(a.url, dest, (got, total) => log(a.name, Math.round((got / (total || 1)) * 100) + "%", Math.round(got / 1e6) + "MB"))
  }
  fs.writeFileSync(packPartsDone, new Date().toISOString())
}

async function extractParts() {
  if (fs.existsSync(packExtractDone)) return
  await dl7zr()
  const first = fs.readdirSync(partsDir).filter((f) => /\.7z(\.001)?$/i.test(f)).sort()[0]
  if (!first) throw new Error("nessuna parte")
  fs.mkdirSync(unpackedDir, { recursive: true })
  log("estrazione:", first)
  await new Promise((resolve, reject) => {
    const p = spawn(seven, ["x", path.join(partsDir, first), `-o${unpackedDir}`, "-y"], {
      cwd: packDir,
      windowsHide: true,
      stdio: ["ignore", "pipfa", "pipe"],
    })
    let err = ""
    p.stderr?.on("data", (c) => { err += c })
    p.on("error", reject)
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error("7z exit " + code + ": " + err.slice(-200)))))
  })
  fs.writeFileSync(packExtractDone, new Date().toISOString())
}

function weightsDownloader() {
  const u = unpackedDir
  const py = path.join(u, "python", "python.exe")
  if (fs.existsSync(py) && fs.existsSync(path.join(u, "download_models.py"))) {
    return { cmd: py, args: [path.join(u, "download_models.py")], cwd: u }
  }
  const bat = fs.readdirSync(u).find((n) => /^2-download-models/i.test(n) && n.endsWith(".bat"))
  if (bat) return { cmd: "cmd.exe", args: ["/c", path.join(u, bat)], cwd: u }
  return null
}

async function dlWeights() {
  if (fs.existsSync(packModelsDone)) return
  const dl = weightsDownloader()
  if (!dl) { log("nessun downloader pesi (pack gia' completo)"); fs.writeFileSync(packModelsDone, new Date().toISOString()); return }
  log("download pesi:", dl.cmd, dl.args.join(" "))
  await new Promise((resolve, reject) => {
    const p = spawn(dl.cmd, dl.args, { cwd: dl.cwd, windowsHide: true, env: { ...process.env, PYTHONUTF8: "1" }, stdio: ["ignore", "pipe", "pipe"] })
    let err = ""
    p.stdout?.on("data", (c) => log("w", c.toString().trim().slice(-160)))
    p.stderr?.on("data", (c) => { err += c })
    p.on("error", reject)
    p.on("close", (code) => {
      if (code === 0) fs.writeFileSync(packModelsDone, new Date().toISOString())
      else reject(new Error("exit " + code + ": " + err.slice(-200)))
    })
  })
}

function serverScript() {
  const u = unpackedDir
  const py = path.join(u, "python", "python.exe")
  if (fs.existsSync(py) && fs.existsSync(path.join(u, "gradio_app.py"))) {
    return { cmd: py, args: [path.join(u, "gradio_app.py")], cwd: u }
  }
  const bat = ["3-start.bat", "3-start.bat(English)"].map((n) => path.join(u, n)).find((p) => fs.existsSync(p))
  if (bat) return { cmd: "cmd.exe", args: ["/c", bat], cwd: u }
  return null
}

async function bootServer() {
  const s = serverScript()
  if (!s) { log("nessun runner server nel pack"); return false }
  log("boot server:", s.cmd, s.args.join(" "))
  const p = spawn(s.cmd, s.args, { cwd: s.cwd, windowsHide: true, env: { ...process.env, PYTHONUTF8: "1" }, stdio: ["ignore", "pipe", "pipe"] })
  p.stdout?.on("data", (c) => log("srv", c.toString().trim().slice(-120)))
  p.stderr?.on("data", (c) => log("srv-err", c.toString().trim().slice(-120)))
  p.on("error", (e) => log("srv error:", e.message))
  return true
}

async function isReady(url, ms = 2500) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(ms) })
    if (!r.ok) return false
    const j = await r.json().catch(() => ({}))
    return j?.status === "ready"
  } catch { return false }
}
async function waitReady(url, ms) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    if (await isReady(url)) return true
    await new Promise((r) => setTimeout(r, 3000))
  }
  return false
}

async function bridgeScript() {
  const candidates = [
    path.join(USER_DATA, "..", "electron", "hunyuan-bridge.mjs"),
    path.join(process.env.APPDATA || "", "Vexa", "..", "electron", "hunyuan-bridge.mjs"),
  ]
  for (const c of candidates) {
    const p = path.resolve(c)
    if (fs.existsSync(p)) return p
  }
  const repo = path.join("C:\\Users\\Windows 11\\Documents\\Vexa Project\\vexa", "electron", "hunyuan-bridge.mjs")
  if (fs.existsSync(repo)) return repo
  return null
}
async function bootBridge() {
  const script = await bridgeScript()
  const port = String(HUNYUAN_BRIDGE_PORT)
  const bridgeProc = spawn(process.execPath, [script], {
    windowsHide: true,
    env: { ...process.env, VEXA_BRIDGE_PORT: port, VEXA_HUNYUAN_URL: `http://127.0.0.1:${HUNYUAN_PACK_PORT}` },
    stdio: ["ignore", "pipe", "pipe"],
  })
  bridgeProc.stdout?.on("data", (c) => log("bridge", c.toString().trim().slice(-160)))
  bridgeProc.stderr?.on("data", (c) => log("bridge-err", c.toString().trim().slice(-160)))
  bridgeProc.on("error", (e) => log("bridge spawn err:", e.message))
  const ok = await waitReady(`http://127.0.0.1:${HUNYUAN_BRIDGE_PORT}/health`, 120000)
  log("bridge ready:", ok)
  return ok
}

async function main() {
  log("USER_DATA:", USER_DATA)
  fs.mkdirSync(packDir, { recursive: true })
  log("fase 1: parti pack")
  await dlParts()
  log("fase 2: estrazione")
  await extractParts()
  log("fase 3: pesi")
  await dlWeights()
  log("fase 4: boot server + bridge")
  await bootServer()
  const up = await waitReady(`http://127.0.0.1:${HUNYUAN_PACK_PORT}/health`, 800000)
  log("pack ready:", up)
  const bridgeOk = await bootBridge()
  log("HUNYUAN_READY local:", up, "| bridge:", bridgeOk, "|", LOCAL_HUNYUAN_URL)
  fs.writeFileSync(path.join(packDir, "install-done.txt"), new Date().toISOString())
}
main().catch((e) => { log("FATAL:", e.message); process.exit(1) })
