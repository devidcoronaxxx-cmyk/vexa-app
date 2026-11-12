// Vexa keep-alive + Hunyuan progress monitor (detached, resume-aware)
// Scopo: riavviare vexa (Electron) in modo che NON muoia quando finisce il
// mio comando, riprenderà da solo il download Hunyuan pack (.7z.001.part già
// a 1286MB), estrazione e pesi, e ogni 20s logga lo stato su vexa-monitor.log
import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"

const VEXA_DIR = "C:\\Users\\Windows 11\\Documents\\Vexa Project\\vexa"
const ELECTRON = path.join(VEXA_DIR, "node_modules", "electron", "dist", "electron.exe")
const USER_DATA = path.join(process.env.APPDATA || "", "Vexa")
const PACK = path.join(USER_DATA, "hunyuan-pack")
const PARTS = path.join(PACK, "parts")
const LOGFILE = path.join(os.tmpdir(), "opencode", "vexa-monitor.log")
const OUTLOG = path.join(os.tmpdir(), "opencode", "vexa-dev.out.log")
const ERRLOG = path.join(os.tmpdir(), "opencode", "vexa-dev.err.log")

function log(s) {
  const line = new Date().toISOString() + " " + s
  try { fs.appendFileSync(LOGFILE, line + "\n") } catch {}
  console.log(line)
}

function mb(p) { try { return (fs.statSync(p).size / 1048576).toFixed(1) } catch { return "0" } }
function exists(p) { return fs.existsSync(p) }

async function checkHealth() {
  for (const [name, port] of [["hunyuan-pack:8080", 8080], ["bridge:8081", 8081]]) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(2000) })
      log(`health ${name} => ${r.ok} (${r.status})`)
    } catch (e) { log(`health ${name} => DOWN (${e.message.slice(0, 60)})`) }
  }
}

async function partsState() {
  if (!exists(PARTS)) { log("parts: cartella assente"); return }
  fs.readdirSync(PARTS).filter((n) => n.endsWith(".part") || n.endsWith(".001")).forEach((n) => {
    log(`part ${n} = ${mb(path.join(PARTS, n))} MB`)
  })
  const markers = ["parts-ok", "extract-ok", "models-ok"].map((m) => path.join(PACK, m + ".txt"))
  const done = markers.filter((m) => exists(m)).map((m) => path.basename(m))
  log("marker completi: " + (done.length ? done.join(", ") : "nessuno ancora"))
}

async function main() {
  if (!exists(ELECTRON)) { log("ERRORE: electron.exe non trovato"); process.exit(1) }
  // riavvia electron se non è già in ascolto su 8080/8081
  const electronRunning = (await Promise.all([8080, 8081].map((p) =>
    fetch(`http://127.0.0.1:${p}/health`).then(() => true).catch(() => false)
  ))).some(Boolean)
  if (electronRunning) {
    log("vexa già attiva su una porta — non riavvio, solo monitor")
  } else {
    log(`avvio electron: ${ELECTRON}`)
    const proc = spawn(ELECTRON, ["."], { cwd: VEXA_DIR, windowsHide: true, detached: true, stdio: ["ignore", "pipe", "pipe"] })
    proc.unref()
    proc.stdout?.on("data", (c) => {
      const s = c.toString()
      try { fs.appendFileSync(OUTLOG, s) } catch {}
    })
    proc.stderr?.on("data", (c) => {
      const s = c.toString()
      try { fs.appendFileSync(ERRLOG, s) } catch {}
    })
    proc.on("error", (e) => log("spawn error: " + e.message))
    log(`electron PID ${proc.pid} avviato (detached)`)
  }
  // poll loop
  setInterval(async () => {
    await partsState()
    await checkHealth()
  }, 20000)
  // subito il primo stato
  await partsState()
  await checkHealth()
}

main().catch((e) => { log("FATALE: " + e.stack); process.exit(1) })
